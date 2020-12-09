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
  'can produce websocket events': async function(browser) {
    const UNSUPPORTED_BROWSERS = ['Safari'];
    const currentBrowser = browser.options.desiredCapabilities.browserName;
    if (UNSUPPORTED_BROWSERS.includes(currentBrowser)) {
      return;
    }

    browser.globals.clearReceivedSpans();
    const url = browser.globals.getUrl('/websocket/websocket.ejs');
    await browser.url(url);

    await browser.click('#connectWebsocketsBtn');
    const wsConnectionSpan = await browser.globals.findSpan(span => span.name === 'connect');          
    await browser.url(`${browser.globals.baseUrl}empty-page`);

    await browser.assert.strictEqual(wsConnectionSpan.tags['location.href'], url);
    await browser.assert.strictEqual(wsConnectionSpan.tags['app'], 'splunk-otel-js-dummy-app');
    await browser.assert.strictEqual(wsConnectionSpan.tags['component'], 'websocket');
    await browser.assert.strictEqual(wsConnectionSpan.tags['ot.status_code'], 'UNSET'); //pointless check, always OK
    await browser.assert.strictEqual(wsConnectionSpan.tags['error'], undefined);
  },
  'websocket url can be ignored': async function(browser) {
    const UNSUPPORTED_BROWSERS = ['Safari'];
    const currentBrowser = browser.options.desiredCapabilities.browserName;
    if (UNSUPPORTED_BROWSERS.includes(currentBrowser)) {
      return;
    }
    
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/websocket/websocket-ignored.ejs'));
    await browser.click('#connectWebsocketsBtn');

    await browser.globals.findSpan(span => span.name === 'websocket-guard-span');   
    await browser.assert.not.ok(browser.globals.receivedSpans.find(span => span.name === 'connect'));
  }
};
