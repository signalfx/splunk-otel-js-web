/*
Copyright 2020 Splunk Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

module.exports = {
  afterEach : function(browser) {
    browser.globals.clearReceivedSpans();  
  },
  'setting session cookie should work': async function(browser) {
    await browser.url(browser.globals.getUrl('/cookies/cookies.ejs'));

    const fetchSpan = await browser.globals.findSpan(span => span.name === 'documentFetch');
    const cookie = await browser.getCookie('_splunk_rum_sid');

    await browser.assert.ok(fetchSpan.tags['splunk.rumSessionId']);
    await browser.assert.notEqual(fetchSpan.tags['splunk.scriptInstance'], fetchSpan.tags['splunk.rumSessionId']);
    await browser.assert.equal(cookie.sameSite, 'Strict');

    await browser.end();
  },
  'setting session cookie in iframe should work': async function(browser) {
    await browser.url(browser.globals.getUrl('/cookies/cookies.iframe.ejs'));

    const fetchSpan = await browser.globals.findSpan(span => span.name === 'documentFetch' && span.tags.app === 'iframe');
    const cookie = await browser.getCookie('_splunk_rum_sid');
    await browser.assert.ok(fetchSpan);
    await browser.assert.ok(cookie.secure);
    await browser.assert.equal(cookie.sameSite, 'None');

    await browser.end();
  }
};
