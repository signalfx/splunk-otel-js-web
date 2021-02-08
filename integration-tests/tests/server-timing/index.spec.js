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
  'traceId should be attached to documentFetch span if Server-Timing was sent': async function(browser) {
    // TODO: restructure into a proper feature support matrix
    const UNSUPPORTED_BROWSERS = ['Safari', 'IE', 'iPhone'];
    const currentBrowser = browser.options.desiredCapabilities.browserName;
    if (UNSUPPORTED_BROWSERS.includes(currentBrowser)) {
      return;
    }

    // preload the page once for firefox
    // in some cases firefox will report negative fetchStart for localhost pages
    // in that case opentelemetry-plugin-document-load will not report any spans
    await browser.url(browser.globals.baseUrl);

    browser.globals.clearReceivedSpans();    
    await browser.url(browser.globals.getUrl('/server-timing/index.ejs'));
    const expectedTraceId = browser.globals._backend.getLastServerTiming().traceId;  
    const docFetchSpan = await browser.globals.findSpan(span => span.name === 'documentFetch' && span.tags['link.traceId'] === expectedTraceId);

    await browser.assert.strictEqual(docFetchSpan.tags['link.traceId'], expectedTraceId);
    await browser.assert.strictEqual(docFetchSpan.tags['location.href'], browser.globals.getUrl('/server-timing/index.ejs'));
    await browser.assert.strictEqual(docFetchSpan.tags['app'], 'splunk-otel-js-dummy-app');
    await browser.assert.strictEqual(docFetchSpan.tags['component'], 'document-load');
    await browser.assert.strictEqual(docFetchSpan.tags['splunk.rumVersion'], browser.globals.rumVersion);
    await browser.assert.strictEqual(docFetchSpan.tags['ot.status_code'], 'UNSET');

    await browser.globals.assertNoErrorSpans();
  },
};
