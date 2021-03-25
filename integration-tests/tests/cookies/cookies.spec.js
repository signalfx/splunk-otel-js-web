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

    // This should create two streams of documentLoad sequences, all with the same sessionId but having
    // two scriptInstances (one from parent, one from iframe)
    const parent = await browser.globals.findSpan(span => span.name === 'documentFetch' && span.tags['location.href'].includes('cookies.ejs'));
    await browser.assert.ok(parent.tags['splunk.rumSessionId']);
    await browser.assert.notEqual(parent.tags['splunk.scriptInstance'], parent.tags['splunk.rumSessionId']);

    const iframe = await browser.globals.findSpan(span => span.name === 'documentFetch' && span.tags['location.href'].includes('iframe.ejs'));
    await browser.assert.ok(iframe.tags['splunk.rumSessionId']);
    await browser.assert.notEqual(iframe.tags['splunk.scriptInstance'], iframe.tags['splunk.rumSessionId']);

    // same session id
    await browser.assert.equal(parent.tags['splunk.rumSessionId'], iframe.tags['splunk.rumSessionId']);
    // but different scriptInstance
    await browser.assert.notEqual(parent.tags['splunk.scriptInstance'], iframe.tags['splunk.scriptInstance']);

    const cookie = await browser.getCookie('_splunk_rum_sid');
    await browser.assert.ok(cookie);
    // FIXME we previously tested that the cookie was marked SameSite=Strict but new session implementation
    // has a race between iframes and parents from the same domain.

    await browser.globals.assertNoErrorSpans();
    await browser.end();
  },
  'setting session cookie in iframe should work': async function(browser) {
    await browser.url(browser.globals.getUrl('/cookies/cookies.iframe.ejs'));

    const fetchSpan = await browser.globals.findSpan(span => span.name === 'documentFetch' && span.tags.app === 'iframe');
    await browser.assert.ok(fetchSpan.tags['splunk.rumSessionId']);
    const cookie = await browser.getCookie('_splunk_rum_sid');
    await browser.assert.ok(cookie);
    await browser.assert.ok(fetchSpan);
    await browser.assert.ok(cookie.secure);
    if (browser.options.desiredCapabilities.browserName.toLowerCase() !==  'safari') {
      await browser.assert.equal(cookie.sameSite, 'None');
    }

    await browser.end();
  },
  'setting invalid cookieDomain in options does not set the cookie': async function(browser) {
    await browser.url(browser.globals.getUrl('/cookies/cookies-domain.ejs'));

    await browser.globals.findSpan(span => span.name === 'documentFetch');
    const cookie = await browser.getCookie('_splunk_rum_sid');

    await browser.assert.not.ok(cookie);

    await browser.globals.assertNoErrorSpans();
    await browser.end();
  },
};
