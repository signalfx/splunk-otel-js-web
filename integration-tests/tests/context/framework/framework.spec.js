/*
Copyright 2021 Splunk Inc.

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
  'Vue 2 with async': async function(browser) {
    await browser.url(browser.globals.getUrl('/context/framework/vue2.ejs'));
    await browser.click('#btn1');
    await browser.globals.waitForTestToFinish();
    
    const clickSpan = await browser.globals.findSpan(span => span.name === 'click');
    const customSpan = await browser.globals.findSpan(span => span.name === 'custom-span');
    
    browser.assert.not.ok(clickSpan.parentId, 'Click span does not have a parent.');
    browser.assert.strictEqual(customSpan.parentId, clickSpan.id, 'Child span belongs to user interaction trace.');
    browser.assert.strictEqual(customSpan.traceId, clickSpan.traceId, 'Spans have same traceId');
    
    await browser.globals.assertNoErrorSpans();
  },
  'React 17 with async': async function(browser) {
    browser.globals.clearReceivedSpans();

    await browser.url(browser.globals.getUrl('/context/framework/react17.ejs'));
    await browser.click('#btn1');
    await browser.globals.waitForTestToFinish();
    
    //Investigate: for some reason for react there are several nested clicks

    const customSpan = await browser.globals.findSpan(span => span.name === 'custom-span');
    const clickSpans = browser.globals.getReceivedSpans().filter(span => span.name === 'click');
    
    clickSpans.forEach( span => {
      browser.assert.strictEqual(customSpan.traceId, span.traceId, 'Spans have same traceId');
    });

    await browser.globals.assertNoErrorSpans();
  }
};