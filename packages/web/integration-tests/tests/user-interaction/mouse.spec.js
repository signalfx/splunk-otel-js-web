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
  'handles mouse click': async function(browser) {
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/user-interaction/mouse.ejs'));
    await browser.click('#btn1');

    const clickSpan = await browser.globals.findSpan(span => span.name === 'click');
    await browser.assert.ok(!!clickSpan, 'Checking click span presence.');

    await browser.assert.strictEqual(clickSpan.tags['component'], 'user-interaction');
    await browser.assert.strictEqual(clickSpan.tags['event_type'], 'click');
    await browser.assert.strictEqual(clickSpan.tags['target_element'], 'BUTTON');
    await browser.assert.strictEqual(clickSpan.tags['target_xpath'], '//*[@id="btn1"]');

    await browser.globals.assertNoErrorSpans();
  },
  'handles mouse down': async function(browser) {
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/user-interaction/mouse.ejs'));
    await browser.click('#btn1');

    const mouseDownSpan = await browser.globals.findSpan(span => span.name === 'mousedown');
    await browser.assert.ok(!!mouseDownSpan, 'Checking mousedown span presence.');

    await browser.assert.strictEqual(mouseDownSpan.tags['component'], 'user-interaction');
    await browser.assert.strictEqual(mouseDownSpan.tags['event_type'], 'mousedown');
    await browser.assert.strictEqual(mouseDownSpan.tags['target_element'], 'BUTTON');
    await browser.assert.strictEqual(mouseDownSpan.tags['target_xpath'], '//*[@id="btn1"]');
  },
  'handles mouse up': async function(browser) {
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/user-interaction/mouse.ejs'));
    await browser.click('#btn1');

    const mouseUpSpan = await browser.globals.findSpan(span => span.name === 'mouseup');
    await browser.assert.ok(!!mouseUpSpan, 'Checking mouseup span presence.');

    await browser.assert.strictEqual(mouseUpSpan.tags['component'], 'user-interaction');
    await browser.assert.strictEqual(mouseUpSpan.tags['event_type'], 'mouseup');
    await browser.assert.strictEqual(mouseUpSpan.tags['target_element'], 'BUTTON');
    await browser.assert.strictEqual(mouseUpSpan.tags['target_xpath'], '//*[@id="btn1"]');
  },
  'handles disabling of mouse events': async function(browser) {
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/user-interaction/mouse-disabled.ejs'));
    await browser.click('#btn1');
    await browser.click('#btnGuard');

    const guardSpan = await browser.globals.findSpan(span => span.name === 'guard');
    await browser.assert.ok(guardSpan, 'Checking presence of guard span.');

    await browser.assert.not.ok(
      browser.globals.getReceivedSpans().find(span => span.name === 'mouseup'),
      'Ensuring no mouseup span arrived.'
    );
    await browser.assert.not.ok(
      browser.globals.getReceivedSpans().find(span => span.name === 'mousedown'),
      'Ensuring no mousedown span arrived.'
    );
    await browser.assert.not.ok(
      browser.globals.getReceivedSpans().find(span => span.name === 'click'),
      'Ensuring no click span arrived.'
    );
  },
  'handles clicks with event listener on document': async function (browser) {
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/user-interaction/mouse-document.ejs'));
    await browser.click('#btn1');

    const clickSpan = await browser.globals.findSpan(span => span.name === 'click');
    await browser.assert.ok(!!clickSpan, 'Checking click span presence.');

    await browser.assert.strictEqual(clickSpan.tags['component'], 'user-interaction');
    await browser.assert.strictEqual(clickSpan.tags['event_type'], 'click');
    await browser.assert.strictEqual(clickSpan.tags['target_element'], 'BUTTON');
    await browser.assert.strictEqual(clickSpan.tags['target_xpath'], '//*[@id="btn1"]');

    await browser.globals.assertNoErrorSpans();
  },
  'this is bubbled event is correct (open-telemetry/opentelemetry-js-contrib#643)': async function (browser) {
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/user-interaction/mouse-bubble.ejs'));
    await browser.click('#inner');

    await browser.globals.findSpan(span => span.name === 'click');
    await browser.expect.element('#result').text.to.equal('container');

    await browser.globals.assertNoErrorSpans();
  },
  'handles svg interactions': async function(browser) {
    browser.globals.clearReceivedSpans();

    await browser.url(browser.globals.getUrl('/user-interaction/mouse.ejs'));
    await browser.click('#btn-svg-target');

    const clickSpan = await browser.globals.findSpan(span => span.name === 'click');
    await browser.assert.ok(!!clickSpan, 'Checking click span presence.');

    await browser.assert.strictEqual(clickSpan.tags['component'], 'user-interaction');
    await browser.assert.strictEqual(clickSpan.tags['event_type'], 'click');
    await browser.assert.strictEqual(clickSpan.tags['target_element'], 'rect');
    await browser.assert.strictEqual(clickSpan.tags['target_xpath'], '//*[@id="btn-svg-target"]');

    const mouseDownSpan = await browser.globals.findSpan(span => span.name === 'mousedown');
    await browser.assert.ok(!!mouseDownSpan, 'Checking mousedown span presence.');

    await browser.assert.strictEqual(mouseDownSpan.tags['component'], 'user-interaction');
    await browser.assert.strictEqual(mouseDownSpan.tags['event_type'], 'mousedown');
    await browser.assert.strictEqual(mouseDownSpan.tags['target_element'], 'rect');
    await browser.assert.strictEqual(mouseDownSpan.tags['target_xpath'], '//*[@id="btn-svg-target"]');

    const mouseUpSpan = await browser.globals.findSpan(span => span.name === 'mouseup');
    await browser.assert.ok(!!mouseUpSpan, 'Checking mouseup span presence.');

    await browser.assert.strictEqual(mouseUpSpan.tags['component'], 'user-interaction');
    await browser.assert.strictEqual(mouseUpSpan.tags['event_type'], 'mouseup');
    await browser.assert.strictEqual(mouseUpSpan.tags['target_element'], 'rect');
    await browser.assert.strictEqual(mouseUpSpan.tags['target_xpath'], '//*[@id="btn-svg-target"]');

    await browser.globals.assertNoErrorSpans();
  },
};
