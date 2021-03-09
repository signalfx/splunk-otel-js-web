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

function isSupported(browser) {
  const SUPPORTED_BROWSERS = ['chrome', 'edge'];
  const currentBrowser = browser.options.desiredCapabilities.browserName;
  return SUPPORTED_BROWSERS.includes(currentBrowser.toLowerCase());
}

module.exports = {
  beforeEach: function(browser) {
    browser.globals.clearReceivedSpans();  
  },
  'reports a longtask': async function(browser) {
    await browser.url(browser.globals.getUrl('/longtask/index.ejs'));
    await browser.click('#btnLongtask');

    if (isSupported(browser)) {
      const longtaskSpan = await browser.globals.findSpan(span => span.name === 'longtask');
      await browser.assert.ok(!!longtaskSpan, 'Checking longtask span presence.');
      await browser.assert.strictEqual(longtaskSpan.tags['component'], 'splunk-longtask', 'component');
      await browser.assert.strictEqual(longtaskSpan.tags['longtask.name'], 'self', 'longtask.name');
      await browser.assert.strictEqual(longtaskSpan.tags['longtask.entry_type'], 'longtask', 'longtask.entry_type');
      await browser.assert.strictEqual(longtaskSpan.tags['longtask.attribution.name'], 'unknown', 'longtask.attribution.name');
      await browser.assert.strictEqual(longtaskSpan.tags['longtask.attribution.entry_type'], 'taskattribution', 'longtask.attribution.entry_type');
      await browser.assert.strictEqual(longtaskSpan.tags['longtask.attribution.start_time'], '0', 'longtask.attribution.start_time');
      await browser.assert.strictEqual(longtaskSpan.tags['longtask.attribution.duration'], '0', 'longtask.attribution.duration');
      await browser.assert.strictEqual(longtaskSpan.tags['longtask.attribution.container_type'], 'window', 'longtask.attribution.container_type');
      await browser.assert.strictEqual(longtaskSpan.tags['longtask.attribution.container_src'], '', 'longtask.attribution.container_src');
      await browser.assert.strictEqual(longtaskSpan.tags['longtask.attribution.container_id'], '', 'longtask.attribution.container_id');
      await browser.assert.strictEqual(longtaskSpan.tags['longtask.attribution.container_name'], '', 'longtask.attribution.container_name');
  
      const duration = parseFloat(longtaskSpan.tags['longtask.duration']);
      await browser.assert.ok(duration >  50, `Duration (${duration}) must be over 50ms by definition.`);
      // note: our longtask simulator targets 55ms, but headless chrome doesn't understand throttling
      await browser.assert.ok(duration < 1000, `Duration (${duration}) must be less than 1s by definition.`);
    }

    await browser.globals.assertNoErrorSpans();
  },
  'can be disabled': async function(browser) {
    if (!isSupported(browser)) {
      return; // Skip this test
    }

    await browser.url(browser.globals.getUrl('/longtask/index.ejs'));
    await browser.click('#btnLongtask');
    await browser.globals.waitForTestToFinish();

    browser.assert.ok(!!browser.globals.getReceivedSpans().find(({name}) => name === 'longtask'), 'Checking presence of longtask span.');
    await browser.globals.assertNoErrorSpans();

    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/longtask/index.ejs?disableCapture=longtask'));
    await browser.click('#btnLongtask');
    await browser.globals.waitForTestToFinish();

    browser.assert.not.ok(browser.globals.getReceivedSpans().find(({name}) => name === 'longtask'), 'Checking presence of longtask span.');
    await browser.globals.assertNoErrorSpans();
  }
};
