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
  'should report resource loads happening after page load': async function(browser) {
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/resource-observer/resources.ejs'));

    const imageSpan = await browser.globals.findSpan(
      span => span.tags['http.url'] && span.tags['http.url'].endsWith('splunk-white-black.png')
    );

    await browser.assert.ok(imageSpan, 'Image span not found.');
    await browser.assert.strictEqual(imageSpan.tags['component'], 'splunk-resource-obs');
    const imgUrl = browser.globals.getUrl('/integration-tests/assets/', []) + 'splunk-white-black.png';
    await browser.assert.strictEqual(imageSpan.tags['http.url'], imgUrl);
    await browser.assert.strictEqual(imageSpan.annotations.length, 9, 'Missing network events');

    const scriptSpan = await browser.globals.findSpan(
      span => span.tags['http.url'] && span.tags['http.url'].endsWith('test.js')
    );

    await browser.assert.strictEqual(scriptSpan.tags['component'], 'splunk-resource-obs');
    const scriptUrl = browser.globals.getUrl('/integration-tests/assets/', []) + 'test.js';
    await browser.assert.strictEqual(scriptSpan.tags['http.url'], scriptUrl);
    await browser.assert.strictEqual(scriptSpan.annotations.length, 9, 'Missing network events');
  },
  'resources can be ignored': async function(browser) {
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/resource-observer/resources-ignored.ejs'));
    
    await browser.globals.findSpan(span => span.name === 'guard-span');
    const url = browser.globals.getUrl('/integration-tests/assets/', []);
    await browser.assert.not.ok(browser.globals.receivedSpans.find(span => span.tags['http.url'] === url + 'test.js'));
    await browser.assert.not.ok(browser.globals.receivedSpans.find(span => span.tags['http.url'] === url + 'splunk-white-black.png'));
  }
};
