const {agentsList, tasksList} = require('./server');
const requestAPI = require('request');

module.exports = (request, responce) => {
	// if (tasksList.length) {

	// }
	// else {
		console.log(request.body);
		const agentInfo = {
			host: request.body.host,
			port: request.body.port,
			status: 'free'
		}
		agentsList.push(agentInfo);
	// }
	responce.status(200).send(agentInfo.host + ':' + agentInfo.port + ' was successfully registered')
}