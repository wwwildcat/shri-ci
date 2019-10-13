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

const serverRequest = () => {
	requestAPI(serverOptions).then(response => {
		console.log(response);
	}).catch((error) => {
		console.log(error.message);
	})
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
		url: config.url
	};
	if (agentsList.length) {
		const freeAgents = agentsList.filter(agent => agent.status === 'free');
		if (freeAgents.length) {
			const agent = freeAgents.pop();
			agent.status = 'working';
			console.log(agentsList);
			response.send('Задача запущена.');
			//Запрос на сборку
			serverOptions.uri = agent.host + ':' + agent.port + '/build',
			serverOptions.body = task;
			serverRequest();
		}
		else {
			tasksList.push(task);
			response.send('Нет свободных агентов, задача поставлена в очередь. Дождитесь окончания работы одного из них или запустите нового.');
		}
	}
	else {
		tasksList.push(task);
		response.send('Нет запущенных агентов, задача поставлена в очередь. Запустите нового агента.');
	}
});
//Регистрация нового агента
app.post('/notify_agent', (request, response) => {
	if (agentsList.length) {
		agentsList.forEach(agent => {
			if (agent.port === request.body.port) {
				response.send(agent.host + ':' + agent.port + ' has been already registered');
			}
		});
	}
	else {
		if (tasksList.length) {
			console.log(tasksList);
			const agent = {
				host: request.body.host,
				port: request.body.port,
				status: 'working'
			};
			agentsList.push(agent);
			const task = tasksList.pop();
			//Запрос на сборку
			serverOptions.uri = agent.host + ':' + agent.port + '/build',
			serverOptions.body = task;
			serverRequest();
			response.status(200).send(agent.host + ':' + agent.port + ' was successfully registered');
		}
		else {
			const agent = {
				host: request.body.host,
				port: request.body.port,
				status: 'free'
			};
			agentsList.push(agent);
			console.log(agentsList);
			response.status(200).send(agent.host + ':' + agent.port + ' was successfully registered');
		}
	}
});
//Получение от агента данных о новой сборке и их сохранение
app.post('/notify_build_result', (request, response) => {
	agentsList.forEach(agent => {
		if (agent.port === request.body.agent.port) {
			agent.status = 'free';
			console.log(agentsList);
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