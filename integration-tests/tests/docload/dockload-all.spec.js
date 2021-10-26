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
  'resources before load event are correctly captured': async function(browser) {
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/docload/docload-all.ejs'));

    const docLoad = await browser.globals.findSpan(span => span.name === 'documentLoad');
    await browser.assert.ok(!!docLoad, 'documentLoad present');
    
    //t=300 to defer load event until xhr/fetch/beacon can be potentially sent so we can test that they are not sent
    const resources = [
      'css-font-img.css', 'splunk-black.png?t=300', 'iframe.ejs', 'splunk.woff'
    ];
    const receivedSpans = await browser.globals.getReceivedSpans();
    for (const urlEnd of resources) {
      const resourceSpan = receivedSpans.filter(
        span => span.tags['http.url'] && span.tags['http.url'].endsWith(urlEnd)
      )[0];
      await browser.assert.ok(!!resourceSpan, urlEnd);
      await browser.assert.strictEqual(docLoad.traceId, resourceSpan.traceId, `${urlEnd} has correct traceId`);
    }

    // no xhr, fetch, beacon span 
    // t=1 because otherwise xhr and fetch identical
    const ignoredResources = ['/some-data', '/some-data?t=1', '/api/v2/spans'];
    for (const urlEnd of ignoredResources) {
      const resourceSpan = receivedSpans.filter(
        span => span.tags['component'] === 'document-load' && span.tags['http.url'] && span.tags['http.url'].endsWith(urlEnd)

      )[0];
      await browser.assert.not.ok(!!resourceSpan, `${urlEnd} is ignored`);
    }
  }
};