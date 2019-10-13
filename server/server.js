const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const requestAPI = require('request-promise-native');
const config = require('./serverConfig');
const app = express();
const upload = multer();

const serverOptions = {
	method: 'POST',
	json: true
}
//В случае ошибки убрать отвалившегося агента из списка и передать задачу следующему
const serverRequest = (task) => {
	serverOptions.body = task;
	requestAPI(serverOptions).then(response => {
		console.log(response);
	}).catch((error) => {
		console.log(error.message);
		if (error.error.code === 'ECONNRESET' || error.error.code === 'ECONNREFUSED') {
			const errorAgentUri = serverOptions.uri;
			const errorAgentPort = errorAgentUri.match(/(?<=:)\d{4}/)[0];
			agentsList.forEach((agent, number) => {
				if (agent.port === +errorAgentPort) {
					agentsList.splice(number, 1);
				}
			});
			console.log(searchFreeAgents(task));
		}
	 });
}
//Поиск свободных агентов для выполнения задачи
const searchFreeAgents = (task) => {
	if (agentsList.length) {
		const freeAgents = agentsList.filter(agent => agent.status === 'free');
		if (freeAgents.length) {
			const agent = freeAgents.pop();
			agent.status = 'working';
			task.status = 'inProgress';
			//Запрос на сборку
			serverOptions.uri = agent.host + ':' + agent.port + '/build',
			serverRequest(task);
			return 'Задача запущена.';
		}
		else return 'Нет свободных агентов, задача поставлена в очередь. Дождитесь окончания работы одного из них или запустите нового.';
	}
	else return 'Нет запущенных агентов, задача поставлена в очередь. Запустите нового агента.';
}

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const agentsList = [];
const tasksList = [];

//Главная страница
app.get('/', (request, response) => {
	response.sendFile(__dirname + '/public/index.html');
});
//Страница сборки
app.get('/build/:buildID', (request, response) => {
	fs.readFile('./builds.json', (err, data) => {
		if (err) throw err;
		else {
			const builds = JSON.parse(data);
			builds.forEach(build => {
				if (build.id === request.params['buildID']) {
					response.json(build);
				}
			})
		}
	});
});
//Информация обо всех сборках
app.get('/builds', (request, response) => {
	fs.readFile('./builds.json', (err, data) => {
		if (err) throw err;
		else {
			response.json(JSON.parse(data));
		}
	});
});
//Получение данных из формы и создание новой задачи на сборку
app.post('/newBuild', upload.none(), (request, response) => {
	const task = {
		id: (+new Date).toString(16),
		hash: request.body.hash,
		command: request.body.command,
		url: config.url,
		status: 'wait',
	};
	tasksList.push(task);
	response.send(searchFreeAgents(task));
});
//Регистрация нового агента
app.post('/notify_agent', (request, response) => {
	if (agentsList.some(agent => agent.port === request.body.port)) {
		response.send('This agent has been already registered');
	}
	else {
		const agent = {
			host: request.body.host,
			port: request.body.port,
			status: 'free'
		};
		agentsList.push(agent);
		console.log(agent.host + ':' + agent.port + ' was successfully registered');
		//Если в момент регистрации агента в очереди уже есть нераспределенные задания, он сразу получает одно из них
		if (tasksList.length) {
			const waitingTasks = tasksList.filter(task => task.status === 'wait');
			if (waitingTasks.length) {
				const currentTask = waitingTasks.pop();
				currentTask.status = 'inProgress'
				agent.status = 'working';
				//Запрос на сборку
				serverOptions.uri = agent.host + ':' + agent.port + '/build',
				serverRequest(currentTask);
			}
		}
		response.status(200).send(agent.host + ':' + agent.port + ' was successfully registered');
	}
});
//Получение от агента данных о новой сборке и их сохранение
app.post('/notify_build_result', (request, response) => {
	agentsList.forEach(agent => {
		if (agent.port === request.body.agent.port) {
			agent.status = 'free';
		}
	})
	fs.readFile('./builds.json', (err, data) => {
		if (err) throw err;
		else {
			const builds = JSON.parse(data);
			builds.push(request.body.build);
			fs.writeFile('./builds.json', JSON.stringify(builds), err => {
				if (err) throw err;
				else {
					tasksList.forEach((task, number) => {
						if (task.id === request.body.build.id) {
							tasksList.splice(number, 1);
						}
					});
					response.status(200).send(request.body.build.id + ' successfully saved on server');
				}
			});
		}
	});
});
app.use(function(request, response,) {
	response.status(404).send('URL not found');
});

app.listen(config.port);