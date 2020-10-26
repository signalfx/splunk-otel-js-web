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
  'cache should be flushed when window is de-focused': async function(browser) {
    await browser.url(browser.globals.defaultUrl);
    // TODO: try opening 2 tabs

    browser.globals.clearReceivedSpans();
    await browser.click('#rejectBtn');
    await new Promise(resolve => setTimeout(resolve, 10));

    // trigger unload, but don't kill the window just yet
    await browser.url(`${browser.globals.baseUrl}empty-page`);
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // consider updating results (if this assertion fails) in browserstack using their REST api
    await browser.assert.ok(browser.globals.receivedSpans.some(span => span.name === 'unhandledrejection'));
    await browser.end();
  },
};
