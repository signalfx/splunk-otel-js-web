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
  '@tags': ['safari-10.1', 'skip-ie11'],
  beforeEach: function(browser) {
    browser.globals.clearReceivedSpans();  
  },
  'span created for fetch includes all properties': async function(browser) {
    await browser.url(browser.globals.getUrl('/fetch/fetch.ejs'));

    const fetchSpan = await browser.globals.findSpan(span => span.tags['http.url'] === '/some-data');
    await browser.assert.ok(!!fetchSpan, 'Fetch span found.');
    await browser.assert.strictEqual(fetchSpan.tags['component'], 'fetch');
    await browser.assert.strictEqual(fetchSpan.tags['http.status_code'], '200');
    await browser.assert.strictEqual(fetchSpan.tags['http.status_text'], 'OK');
    await browser.assert.strictEqual(fetchSpan.tags['http.method'], 'GET');
    await browser.assert.strictEqual(fetchSpan.tags['http.url'], '/some-data');

    if (browser.options.desiredCapabilities.browserName !==  'Safari') {
      await browser.assert.strictEqual(fetchSpan.tags['http.response_content_length'], '49');
    }
    await browser.assert.ok(fetchSpan.tags['link.traceId'], 'got link.traceId');
    await browser.assert.ok(fetchSpan.tags['link.spanId'], 'got link.spanId');
    if (browser.options.desiredCapabilities.browserName !== 'Safari' && browser.options.desiredCapabilities.browser_version !== '10.1') {
      await browser.timesMakeSense(fetchSpan.annotations, 'domainLookupStart', 'domainLookupEnd');
      await browser.timesMakeSense(fetchSpan.annotations, 'connectStart', 'connectEnd');
      await browser.timesMakeSense(fetchSpan.annotations, 'secureConnectionStart', 'connectEnd');
      await browser.timesMakeSense(fetchSpan.annotations, 'requestStart', 'responseStart');
      await browser.timesMakeSense(fetchSpan.annotations, 'responseStart', 'responseEnd');
      await browser.timesMakeSense(fetchSpan.annotations, 'fetchStart', 'responseEnd');
    }
    await browser.globals.assertNoErrorSpans();
  },
  'fetch request can be ignored': async function(browser) {
    await browser.url(browser.globals.getUrl('/fetch/fetch-ignored.ejs'));
    
    await browser.globals.findSpan(span => span.name === 'guard-span');
    await browser.globals.assertNoErrorSpans();

    await browser.assert.not.ok(browser.globals.getReceivedSpans().find(span => span.tags['http.url'] === '/some-data'));
    await browser.assert.not.ok(browser.globals.getReceivedSpans().find(span => span.tags['http.url'] === '/no-server-timings'));
  },
  'fetch reported over CORS': async function(browser) {
    const backend2 = await browser.globals.buildInstrumentationBackend();
    await browser.url(backend2.getUrl('/fetch/fetch.ejs', undefined, { beaconPort: browser.globals.httpPort }).toString());

    const fetchSpan = await browser.globals.findSpan(span => span.tags['http.url'] === '/some-data');
    await browser.assert.ok(!!fetchSpan, 'Fetch span found.');
    await browser.assert.strictEqual(fetchSpan.tags['component'], 'fetch');
    await browser.assert.strictEqual(fetchSpan.tags['http.status_code'], '200');
    await browser.assert.strictEqual(fetchSpan.tags['http.status_text'], 'OK');
    await browser.assert.strictEqual(fetchSpan.tags['http.method'], 'GET');
    await browser.assert.strictEqual(fetchSpan.tags['http.url'], '/some-data');
    await browser.assert.strictEqual(fetchSpan.tags['http.host'], `${backend2.httpHostname}:${backend2.httpPort}`);

    await browser.globals.assertNoErrorSpans();
    await backend2.close();
  },
  'can be disabled (with xhr switch)': async function(browser) {
    await browser.url(browser.globals.getUrl('/fetch/fetch.ejs'));
    await browser.globals.waitForTestToFinish();

    await browser.assert.ok(!!browser.globals.getReceivedSpans().find(span => span.tags['http.url'] === '/some-data'));

    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/fetch/fetch.ejs?disableInstrumentation=xhr,fetch'));
    await browser.globals.waitForTestToFinish();

    await browser.assert.not.ok(browser.globals.getReceivedSpans().find(span => span.tags['http.url'] === '/some-data'));
  }
};
