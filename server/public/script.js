function getBuilds(builds) {
	builds.forEach(build => getRow(build));
}

function getRow(json) {
	const row = document.createElement('tr');
	const tableBody = document.querySelector('tbody');
	const status = json.status ? json.status : json.exitCode ? 'fail' : 'success';
	row.insertAdjacentHTML('afterbegin', '<td><a href="/build/' + json.id + '">'+ json.id + '</a></td><td>' + json.startDate + '</td><td>' + json.command + '</td><td>' + status + '</td>');
	tableBody.append(row);
}

fetch(window.location.href + 'builds').then(response => response.json()).then(builds => getBuilds(builds));

const form = document.querySelector('form');
form.onsubmit = async (event) => {
	event.preventDefault();
	fetch(window.location.href + 'newBuild', {
		method: 'POST',
		body: new FormData(form)
	}).then(response => response.json())
		.then(json => {
			getRow(json);
			alert(json.message);
		});
};