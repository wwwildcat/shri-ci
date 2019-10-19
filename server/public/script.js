function getBuilds(builds) {
	builds.forEach(build => {
		const row = document.createElement('tr');
		const tableBody = document.querySelector('tbody');
		const status = build.status ? 'fail' : 'success';
		row.insertAdjacentHTML('afterbegin', '<td><a href="/build/' + build.id + '">'+ build.id + '</a></td><td>' + status + '</td>');
		tableBody.append(row);
	});
}

fetch(window.location.href + 'builds').then(response => response.json()).then(builds => getBuilds(builds));

const form = document.querySelector('form');
form.onsubmit = async (event) => {
	event.preventDefault();
	fetch(window.location.href + 'newBuild', {
		method: 'POST',
		body: new FormData(form)
	}).then(response => response.text()).then(text => alert(text));
};