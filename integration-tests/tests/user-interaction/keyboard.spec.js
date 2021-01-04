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
  'handles keyboard events': async function(browser) {
    browser.globals.clearReceivedSpans();

    const startUrl = browser.globals.getUrl('/user-interaction/keyboard.ejs');
    await browser.url(startUrl);
    await browser.sendKeys('body', 'a');

    const keydownSpan = await browser.globals.findSpan(span => span.name === 'keydown');
    await browser.assert.ok(!!keydownSpan, 'Checking keyboard span presence.');

    await browser.assert.strictEqual(keydownSpan.tags['component'], 'user-interaction');
    await browser.assert.strictEqual(keydownSpan.tags['event_type'], 'keydown');
    await browser.assert.strictEqual(keydownSpan.tags['target_element'], 'BODY');
    await browser.assert.strictEqual(keydownSpan.tags['target_xpath'], '//html/body');

    const keyupSpan = await browser.globals.findSpan(span => span.name === 'keyup');
    await browser.assert.ok(!!keyupSpan, 'Checking keyboard span presence.');

    await browser.assert.strictEqual(keyupSpan.tags['component'], 'user-interaction');
    await browser.assert.strictEqual(keyupSpan.tags['event_type'], 'keyup');
    await browser.assert.strictEqual(keyupSpan.tags['target_element'], 'BODY');
    await browser.assert.strictEqual(keyupSpan.tags['target_xpath'], '//html/body');
  },
};
