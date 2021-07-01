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
  'applies Synthetics Run Id attribute on all spans': async function(browser) {
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/synthetics/index.ejs'));

    const guardSpan = await browser.globals.findSpan(s => s.name === 'documentLoad');
    await browser.assert.ok(guardSpan, 'Ensuring docload span has arrived before we start inspecting spans.');

    for (const span of browser.globals.getReceivedSpans()) {
      await browser.assert.strictEqual(span.tags['Synthetics-RunId'], 'abcd1234'.repeat(4));
    }
  },
};
