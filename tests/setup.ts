import { afterEach, beforeEach } from "vitest";

afterEach(() => {
	assertSessionIsEmpty();
});

function assertSessionIsEmpty() {
	try {
		if (!!localStorage['_splunk_rum_sid']) {
			throw new Error('Session is expected to be empty, but is set in localStorage.');
		}

		if (document.cookie.indexOf('_splunk_rum_sid') >= 0) {
			throw new Error(`Session is expected to be empty, but is set in cookies: ${document.cookie}`);
		}
	} finally {
		delete localStorage['_splunk_rum_sid'];
		document.cookie = '_splunk_rum_sid=;expires=Thu, 01 Jan 1970 00:00:00 GMT'
	}
}
