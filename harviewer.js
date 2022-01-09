'use strict';

import fs from "fs";

const data = fs.readFileSync(process.argv[2]);
const har = JSON.parse(data);

for (const entry of har.log.entries) {
	if (entry.request.method === "OPTIONS") continue;
	if (!entry.request.url.match("_matrix")) continue;
	if (entry.startedDateTime < "2022-01-06T23:56:37.291Z") continue;
	//if (entry.startedDateTime < "2022-01-06T23:56:45.994Z") continue;

	let starred = entry.request.postData?.text?.match(/1641513400081MnRJbA5m8oOdWxbS/) ||
				  entry.response.content?.text?.match(/1641513400081MnRJbA5m8oOdWxbS/);

	let arg = '';
	if (entry.request.postData) {
		const data = JSON.parse(entry.request.postData.text);
		if (data.messages) {
			arg = Object.keys(data.messages).join(',');
		}
	}

	console.log(entry.startedDateTime, starred ? "*" : " ", entry.request.method, entry.request.url.replace(/access_token=.*$/,''), arg, entry.response.status);
	if (entry.request.bodySize > 0 && starred) {
		console.log(entry.startedDateTime, ">", JSON.stringify(JSON.parse(entry.request.postData.text), null, 4));
	}
	if (starred) {
		console.log(entry.startedDateTime, "<", JSON.stringify(JSON.parse(entry.response.content.text), null, 4));
	}
	//if (entry.startedDateTime > "2022-01-06T23:57:38.372Z") break;
	if (entry.startedDateTime > "2022-01-06T23:57:45.736Z") break;
}