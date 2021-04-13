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
  '@tags': ['skip-ie11'],
  'JS unhandled error': async function(browser) {
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/cdn/index.ejs'));

    const errorSpan = await browser.globals.findSpan(s => s.name === 'onerror');
    await browser.assert.ok(!!errorSpan, 'Checking presence of error span.');

    const tags = errorSpan.tags;
    await browser.assert.strictEqual(tags['component'], 'error');
    await browser.assert.strictEqual(tags['error'], 'true');
    await browser.assert.strictEqual(tags['error.object'], 'TypeError');

    switch (browser.options.desiredCapabilities.browserName.toLowerCase()) {
    case 'chrome':
      await browser.assert.strictEqual(tags['error.message'], 'Cannot set property \'prop1\' of null');
      break;
    case 'firefox':
      await browser.assert.strictEqual(tags['error.message'], 'test is null');
      break;
    case 'safari':
      await browser.assert.strictEqual(tags['error.message'], 'null is not an object (evaluating \'test.prop1 = true\')');
      break;
    }

    const rumScriptFetchSpan = await browser.globals.findSpan(s => s.name === 'resourceFetch');
    await browser.assert.ok(!!rumScriptFetchSpan, 'Checking presence of splunk-otel-web fetch span.');

    const cdnUrl = 'https://cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web.js';
    await browser.assert.strictEqual(rumScriptFetchSpan.tags['http.url'], cdnUrl);
    await browser.assert.strictEqual(rumScriptFetchSpan.tags['splunk.rumVersion'], '0.4.3');
  },
};
