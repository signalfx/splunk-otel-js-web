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
  'handles causality of a mouse click': async function(browser) {
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/user-interaction/causality.ejs'));
    await browser.click('#btn1');

    const clickSpan = await browser.globals.findSpan(span => span.name === 'click');
    await browser.assert.ok(!!clickSpan, 'Checking click span presence.');

    const fetchSpan = await browser.globals.findSpan(span => span.tags['http.url'] === '/some-data');
    await browser.assert.ok(!!fetchSpan, 'Checking fetch span presence.');

    await browser.assert.not.ok(clickSpan.parentId, 'Click span does not have a parent.');
    await browser.assert.strictEqual(fetchSpan.parentId, clickSpan.id, 'Fetch span belongs to user interaction trace.');

    await browser.globals.assertNoErrorSpans();
  },
};
