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
	});
};

const agentOptions = {
	method: 'POST',
	uri: config.hostServer + '/notify_agent',
	json: true,
	body: {
		host: 'http://localhost',
		port: port
	}
};

//Запрос на регистрацию у сервера
agentRequest();

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
//Сборка
app.post('/build', (request, response) => {
	//Клонирование репозитория
	exec('git clone ' + request.body.url, {cwd: config.workDirectory}, (err) => {
		if (err) {
			throw err;
		}
		else {
			const repoName = request.body.url.split('/').reverse()[0];
			const newWorkDirectory = path.join(config.workDirectory, repoName);
			//Чекаут на нужный коммит
			exec('git checkout ' + request.body.hash, {cwd: newWorkDirectory}, (err) => {
				if (err) {
					throw err;
				}
				else {
					//Выполнение сборочной команды
					exec(request.body.command, {cwd: newWorkDirectory}, (err, stdout, stderr) => {
						const endDate = new Date();
						agentOptions.uri = config.hostServer + '/notify_build_result';
						agentOptions.body = {
							build: {
								id: request.body.id,
								hash: request.body.hash,
								command: request.body.command,
								exitCode: err ? err.code : 0,
								stdout: stdout,
								stderr: stderr,
								startDate: request.body.startDate,
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
						response.status(200).send(request.body.id + ' has been succesfully build');
					});
				}
			});
		}
	});
});

app.listen(port);