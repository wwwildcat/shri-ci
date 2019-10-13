const path = require('path');
const express = require('express');
const requestAPI = require('request');
const bodyParser = require('body-parser');
const {exec} = require('child_process');
const config = require('./agentConfig');

const registerOptions = {
	method: 'POST',
	uri: config.hostServer + '/notify_agent',
	json: true,
	body: {
		host: 'http://localhost',
		port: config.port
	}
}

const buildOptions = {
	method: 'POST',
	uri: config.hostServer + '/notify_build_result',
	json: true
}

const agentRequestCallback = (error, response, body) => {
	if (!error && response && response.statusCode === 200) {
		console.log(body);
	}
	else {
		console.log('error');
	}
}
//Запрос на регистрацию у сервера
requestAPI.post(registerOptions, agentRequestCallback);

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
//Сборка
app.post('/build', (request, response) => {
	const id = request.body.id;
	const hash = request.body.hash;
	const command = request.body.command;
	const url = request.body.url;
	exec('git clone ' + url, {cwd: config.workDirectory}, (err) => {
		if (err) {
			throw err;
		}
		else {
			const repoName = url.split('/').reverse()[0];
			const newWorkDirectory = path.join(config.workDirectory, repoName);
			exec('git checkout ' + hash, {cwd: newWorkDirectory}, (err) => {
				if (err) {
					throw err;
				}
				else {
					const startDate = new Date();
					exec(command, {cwd: newWorkDirectory}, (err, stdout, stderr) => {
						const endDate = new Date();
						buildOptions.body = {
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
								port: config.port
							}
						};
						//Запрос на сохранение сборки
						requestAPI(buildOptions, agentRequestCallback);
					})
				}
			});
		}
	});
	response.send(id + ' go to build');
});

app.listen(config.port);