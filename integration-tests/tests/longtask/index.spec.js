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

function valueIsWithin(value, expected, margin) {
  return value >= expected - margin && value <= expected + margin;
}

function isSupported(browser) {
  const SUPPORTED_BROWSERS = ['chrome', 'edge'];
  const currentBrowser = browser.options.desiredCapabilities.browserName;
  return SUPPORTED_BROWSERS.includes(currentBrowser.toLowerCase());
}

module.exports = {
  'reports a longtask': async function(browser) {
    if (!isSupported(browser)) {
      return;
    }

    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/longtask/index.ejs'));
    await browser.click('#btnLongtask');

    const longtaskSpan = await browser.globals.findSpan(span => span.name === 'longtask');
    await browser.assert.ok(!!longtaskSpan, 'Checking longtask span presence.');
    await browser.assert.strictEqual(longtaskSpan.tags['component'], 'splunk-longtask', 'component');
    await browser.assert.strictEqual(longtaskSpan.tags['longtask.name'], 'self', 'longtask.name');
    await browser.assert.strictEqual(longtaskSpan.tags['longtask.entry_type'], 'longtask', 'longtask.entry_type');

    const duration = parseFloat(longtaskSpan.tags['longtask.duration']);
    await browser.assert.ok(valueIsWithin(duration, 55, 15), `Duration (${duration}) is within 15ms of 55ms.`);
    
    await browser.assert.strictEqual(longtaskSpan.tags['longtask.attribution[0].name'], 'unknown', 'longtask.attribution[0].name');
    await browser.assert.strictEqual(longtaskSpan.tags['longtask.attribution[0].entry_type'], 'taskattribution', 'longtask.attribution[0].entry_type');
    await browser.assert.strictEqual(longtaskSpan.tags['longtask.attribution[0].start_time'], '0', 'longtask.attribution[0].start_time');
    await browser.assert.strictEqual(longtaskSpan.tags['longtask.attribution[0].duration'], '0', 'longtask.attribution[0].duration');
    await browser.assert.strictEqual(longtaskSpan.tags['longtask.attribution[0].container_type'], 'window', 'longtask.attribution[0].container_type');
    await browser.assert.strictEqual(longtaskSpan.tags['longtask.attribution[0].container_src'], '', 'longtask.attribution[0].container_src');
    await browser.assert.strictEqual(longtaskSpan.tags['longtask.attribution[0].container_id'], '', 'longtask.attribution[0].container_id');
    await browser.assert.strictEqual(longtaskSpan.tags['longtask.attribution[0].container_name'], '', 'longtask.attribution[0].container_name');
  },
};
