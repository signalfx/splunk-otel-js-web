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
  'documentFetch, resourceFetch, and documentLoad spans': async function(browser) {

    const timesMakeSense = async function(eventsArr, startName, endName) {
      const name2time = {};
      eventsArr.forEach(event => {
        name2time[event.value] = event.timestamp;
      });
      await browser.assert.ok(name2time[startName]);
      await browser.assert.ok(name2time[endName]);
      await browser.assert.ok(name2time[startName] <= name2time[endName]);
      const diff = name2time[endName] - name2time[startName];
      // times reported in zipkin as micros
      // looking for egregiously incorrect response times here, not a tight bound
      const fiveMinutes = 5 * 60 * 1000 * 1000;
      await browser.assert.ok(diff < fiveMinutes); 
      // Also looking for rough synchronization with reality (at least from our CI systems/laptops...)
      const nowMicros = new Date().getTime() * 1000;
      let clockSkew = name2time[startName] - nowMicros;
      if (clockSkew < 0) {
        clockSkew = -clockSkew;
      }
      await browser.assert.ok(clockSkew <= fiveMinutes);
    };

    const url = browser.globals.getUrl('/docload/docload.ejs');
    await browser.url(url);

    const docFetch = await browser.globals.findSpan(span => span.name === 'documentFetch');
    const scriptFetch = await browser.globals.findSpan(span => span.name === 'resourceFetch' && span.tags['http.url'].includes('splunk-rum.js'));
    const docLoad = await browser.globals.findSpan(span => span.name === 'documentLoad');
    const brokenImgFetch = await browser.globals.findSpan(span => span.name === 'resourceFetch' && span.tags['http.url'].includes('/nosuchimage.jpg'));
    
    await browser.assert.ok(docFetch);
    await browser.assert.ok(scriptFetch);
    await browser.assert.ok(docLoad);
    await browser.assert.ok(brokenImgFetch);

    await browser.assert.ok(docLoad.traceId.match(/[a-f0-9]+/));
    await browser.assert.ok(docLoad.id.match(/[a-f0-9]+/));
    await browser.assert.strictEqual(docFetch.traceId, docLoad.traceId);
    await browser.assert.strictEqual(docFetch.parentId, docLoad.id);

    // FIXME otel is broken at the moment - need to fix up their code that makes this all the same trace
    // await browser.assert.strictEqual(scriptFetch.traceId, docLoad.traceId);
    // await browser.assert.strictEqual(scriptFetch.parentId, docLoad.id);
    // await browser.assert.strictEqual(brokenImgFetch.traceId, docLoad.traceId);
    // await browser.assert.strictEqual(brokenImgFetch.parentId, docLoad.id);

    // docFetch
    await browser.assert.strictEqual(docFetch.tags['component'], 'document-load');
    await browser.assert.strictEqual(docFetch.tags['location.href'], url);
    await timesMakeSense(docFetch.annotations, 'domainLookupStart', 'domainLookupEnd');
    await timesMakeSense(docFetch.annotations, 'connectStart', 'connectEnd');
    await timesMakeSense(docFetch.annotations, 'requestStart', 'responseStart');
    await timesMakeSense(docFetch.annotations, 'responseStart', 'responseEnd');
    await timesMakeSense(docFetch.annotations, 'fetchStart', 'responseEnd');
    if (browser.options.desiredCapabilities.browserName !== 'Safari') {
      await browser.assert.ok(docFetch.tags['http.response_content_length'] >= 0);
      await browser.assert.ok(docFetch.tags['link.traceId']);
      await browser.assert.ok(docFetch.tags['link.spanId']);
    }

    // scriptFetch
    await browser.assert.strictEqual(scriptFetch.tags['component'], 'document-load');
    await browser.assert.strictEqual(scriptFetch.tags['location.href'], url);
    if (browser.options.desiredCapabilities.browserName !== 'Safari') {
      await browser.assert.ok(scriptFetch.tags['http.response_content_length'] >= 0);
      await browser.assert.ok(docFetch.tags['link.traceId']);
      await browser.assert.ok(docFetch.tags['link.spanId']);
    }
    // http.url has already been checked by the findSpan
    
    // documentLoad
    await browser.assert.strictEqual(docLoad.tags['component'], 'document-load');
    await browser.assert.strictEqual(docLoad.tags['location.href'], url);
    await browser.assert.ok(docLoad.tags['screen.xy'].match(/[0-9]+x[0-9]+/));
    await timesMakeSense(docLoad.annotations, 'domContentLoadedEventStart', 'domContentLoadedEventEnd');
    await timesMakeSense(docLoad.annotations, 'loadEventStart', 'loadEventEnd');
    await timesMakeSense(docLoad.annotations, 'fetchStart', 'domInteractive');
    await timesMakeSense(docLoad.annotations, 'fetchStart', 'domComplete');



    await browser.end();
  }
};