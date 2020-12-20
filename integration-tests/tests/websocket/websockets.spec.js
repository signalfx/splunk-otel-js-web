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

function isSafari(browser) {
  const UNSUPPORTED_BROWSERS = ['Safari'];
  const currentBrowser = browser.options.desiredCapabilities.browserName;
  return UNSUPPORTED_BROWSERS.includes(currentBrowser);
}

module.exports = {
  afterEach : function(browser) {
    browser.globals.clearReceivedSpans();  
  },
  'can produce websocket events': async function(browser) {
    if (isSafari(browser)) {
      return;
    }
    const url = browser.globals.getUrl('/websocket/websocket.ejs');
    await browser.url(url);

    await browser.click('#connectWs');
    const wsConnectionSpan = await browser.globals.findSpan(span => span.name === 'connect', -1000);          

    await browser.assert.strictEqual(wsConnectionSpan.tags['location.href'], url);
    await browser.assert.strictEqual(wsConnectionSpan.tags['app'], 'splunk-otel-js-dummy-app');
    await browser.assert.strictEqual(wsConnectionSpan.tags['component'], 'websocket');
    await browser.assert.strictEqual(wsConnectionSpan.tags['ot.status_code'], 'UNSET');
    await browser.assert.strictEqual(wsConnectionSpan.tags['error'], undefined);
  },
  'websocket url can be ignored': async function(browser) {
    if (isSafari(browser)) {
      return;
    }
    await browser.url(browser.globals.getUrl('/websocket/websocket-ignored.ejs'));
    await browser.click('#connectWs');

    await browser.globals.findSpan(span => span.name === 'websocket-guard-span');   
    await browser.assert.not.ok(browser.globals.receivedSpans.find(span => span.name === 'connect'));
  },
  'sending send and on message create a span': async function(browser) {
    if (isSafari(browser)) {
      return;
    }
    await browser.url(browser.globals.getUrl('/websocket/websocket.ejs'));
    await browser.click('#connectWs');
    // check for connect span so connection has time to initialize otherwise send will fail
    const wsConnectionSpan = await browser.globals.findSpan(span => span.name === 'connect');     
    await browser.assert.ok(!!wsConnectionSpan, 'Connect span missing');     
    await browser.click('#sendWs');
    const wsMessage = await browser.globals.findSpan(span => span.name === 'onmessage');
    await browser.assert.ok(!!wsMessage);
    await browser.assert.strictEqual(wsMessage.kind, 'CONSUMER');
    await browser.assert.strictEqual(wsMessage.tags['component'], 'websocket');
    await browser.assert.strictEqual(wsMessage.tags['protocol'], '');
    await browser.assert.strictEqual(wsMessage.tags['http.url'], browser.globals.wsBase);
    await browser.assert.strictEqual(wsMessage.tags['http.response_content_length'], '7');

    const wsSend = browser.globals.receivedSpans.find(span => span.name === 'send');
    await browser.assert.ok(!!wsSend);
    await browser.assert.strictEqual(wsSend.kind, 'PRODUCER');
    await browser.assert.strictEqual(wsSend.tags['component'], 'websocket');
    await browser.assert.strictEqual(wsSend.tags['protocol'], '');
    await browser.assert.strictEqual(wsSend.tags['http.url'], browser.globals.wsBase);
    await browser.assert.strictEqual(wsSend.tags['http.request_content_length'], '12');
  },
  'websocket constructor errors are captured': async function(browser) {
    if (isSafari(browser)) {
      return;
    }
    await browser.url(browser.globals.getUrl('/websocket/websocket-construct-errors.ejs'));
    await browser.click('#connectWs');
    const wsConnectionSpan = await browser.globals.findSpan(span => span.name === 'connect', -5000);     
    await browser.assert.ok(!!wsConnectionSpan, 'Connect span missing');
    await browser.assert.strictEqual(wsConnectionSpan.tags['error'], 'true');
  },
  'websocket send errors are captured': async function(browser) {
    if (isSafari(browser)) {
      return;
    }
    await browser.url(browser.globals.getUrl('/websocket/websocket-send-errors.ejs'));
    await browser.click('#connectWs');
    // not many ways to generate these errors, 
    // trying to send msg during connect is the one I know but can be flaky
    const wsSend = await browser.globals.findSpan(span => span.name === 'send');     
    await browser.assert.ok(!!wsSend, 'Send span missing');
    await browser.assert.strictEqual(wsSend.tags['error'], 'true');
    await browser.assert.ok(wsSend.tags['error.message']);
    await browser.assert.ok(wsSend.tags['error.object']);
  },
  'specifying sub-protocols does not break anything': async function(browser) {
    if (isSafari(browser)) {
      return;
    }
    await browser.url(browser.globals.getUrl('/websocket/websocket-sub-protocol.ejs'));
    await browser.click('#connectWs');
    const wsConnectionSpan = await browser.globals.findSpan(span => span.name === 'connect');     
    await browser.assert.strictEqual(wsConnectionSpan.tags['protocols'], '["soap"]');

    await browser.assert.ok(!!wsConnectionSpan, 'Connect span missing');     
    await browser.click('#sendWs');
    const wsMessage = await browser.globals.findSpan(span => span.name === 'onmessage');
    await browser.assert.ok(!!wsMessage);
    await browser.assert.strictEqual(wsMessage.kind, 'CONSUMER');
    await browser.assert.strictEqual(wsMessage.tags['component'], 'websocket');
    await browser.assert.strictEqual(wsMessage.tags['protocol'], 'soap');
    await browser.assert.strictEqual(wsMessage.tags['http.url'], browser.globals.wsBase);
    await browser.assert.strictEqual(wsMessage.tags['http.response_content_length'], '7');

    const wsSend = browser.globals.receivedSpans.find(span => span.name === 'send');
    await browser.assert.ok(!!wsSend);
    await browser.assert.strictEqual(wsSend.kind, 'PRODUCER');
    await browser.assert.strictEqual(wsSend.tags['component'], 'websocket');
    await browser.assert.strictEqual(wsSend.tags['protocol'], 'soap');
    await browser.assert.strictEqual(wsSend.tags['http.url'], browser.globals.wsBase);
    await browser.assert.strictEqual(wsSend.tags['http.request_content_length'], '12');
  },
};
