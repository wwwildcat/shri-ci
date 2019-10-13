const rimraf = require('rimraf');
const path = require('path');
const express = require('express');
const requestAPI = require('request-promise-native');
const bodyParser = require('body-parser');
const {exec} = require('child_process');
const config = require('./agentConfig');

//Порт, на котором запускается агент, получается из командной строки, а если там нет дополнительных параметров - из файла конфигурации
const port = process.argv[2] ? +process.argv[2] : config.port;

//В случае ошибки повторять запрос на регистрацию каждые 1000 мс
const agentRequest = () => {
	requestAPI(agentOptions).then(response => console.log(response)).catch((error) => {
		console.log(error.message);
		agentOptions.uri = config.hostServer + '/notify_agent';
		setTimeout(agentRequest, 1000);
	})
}

const agentOptions = {
	method: 'POST',
	uri: config.hostServer + '/notify_agent',
	json: true,
	body: {
		host: 'http://localhost',
		port: port
	}
}

//Запрос на регистрацию у сервера
agentRequest();

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
//Сборка
app.post('/build', (request, response) => {
	const id = request.body.id;
	const hash = request.body.hash;
	const command = request.body.command;
	const url = request.body.url;
	//Клонирование репозитория
	exec('git clone ' + url, {cwd: config.workDirectory}, (err) => {
		if (err) {
			throw err;
		}
		else {
			const repoName = url.split('/').reverse()[0];
			const newWorkDirectory = path.join(config.workDirectory, repoName);
			//Чекаут на нужный коммит
			exec('git checkout ' + hash, {cwd: newWorkDirectory}, (err) => {
				if (err) {
					throw err;
				}
				else {
					const startDate = new Date();
					//Выполнение сборочной команды
					exec(command, {cwd: newWorkDirectory}, (err, stdout, stderr) => {
						const endDate = new Date();
						agentOptions.uri = config.hostServer + '/notify_build_result';
						agentOptions.body = {
							build: {
								id: id,
								hash: hash,
								command: command,
								status: stderr ? 'fail' : 'success',
								stdout: stdout,
								stderr: stderr,
								startDate: startDate,
								endDate: endDate
							},
							agent: {
								host: 'http://localhost',
								port: port
							}
						};
						//Запрос на сохранение сборки
						agentRequest();
						//Очистка рабочего каталога
						rimraf(newWorkDirectory, (err) => {
							if (err) {
								throw err;
							}
						});
						response.status(200).send(id + ' has been succesfully build');
					});
				}
			});
		}
	});
});

app.listen(port);