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

    events2hash = function(eventsArr) {
      const answer = {};
      if (!eventsArr) {
        return answer;
      }
      eventsArr.forEach(event => {
        answer[event.value] = event;
      });
      return answer;
    }

    const url = browser.globals.getUrl('/docload/docload.ejs');
    await browser.url(url);
    const docFetch = await browser.globals.findSpan(span => span.name === 'documentFetch');
    const scriptFetch = await browser.globals.findSpan(span => span.name === 'resourceFetch' && span.tags['http.url'].includes('splunk-rum.js'));
    const docLoad = await browser.globals.findSpan(span => span.name === 'documentLoad');
    
    await browser.assert.ok(docFetch);
    await browser.assert.ok(scriptFetch);
    await browser.assert.ok(docLoad);

    // FIXME need events for each too
    // docFetch
    await browser.assert.strictEqual(docFetch.tags['component'], 'document-load');
    await browser.assert.strictEqual(docFetch.tags['location.href'], url);
    await browser.assert.ok(events2hash(docFetch.annotations).fetchStart);
    await browser.assert.ok(events2hash(docFetch.annotations).domainLookupStart);
    await browser.assert.ok(events2hash(docFetch.annotations).domainLookupEnd);
    await browser.assert.ok(events2hash(docFetch.annotations).connectStart);
    await browser.assert.ok(events2hash(docFetch.annotations).connectEnd);
    await browser.assert.ok(events2hash(docFetch.annotations).requestStart);
    await browser.assert.ok(events2hash(docFetch.annotations).responseStart);
    await browser.assert.ok(events2hash(docFetch.annotations).responseEnd);
    // FIXME good way to know when this should be available?
    //await browser.assert.ok(span.tags['http.response_content_length'] >= 0);

    // scriptFetch
    await browser.assert.strictEqual(scriptFetch.tags['component'], 'document-load');
    await browser.assert.strictEqual(scriptFetch.tags['location.href'], url);
    //await browser.assert.ok(span.tags['http.response_content_length'] >= 0);

    // documentLoad
    await browser.assert.strictEqual(docLoad.tags['component'], 'document-load');
    await browser.assert.strictEqual(docLoad.tags['location.href'], url);
    await browser.assert.ok(docLoad.tags['screen.xy'].match(/[0-9]+x[0-9]+/));
    await browser.assert.ok(events2hash(docLoad.annotations).fetchStart);
    await browser.assert.ok(events2hash(docLoad.annotations).domContentLoadedEventStart);
    await browser.assert.ok(events2hash(docLoad.annotations).domContentLoadedEventEnd);
    await browser.assert.ok(events2hash(docLoad.annotations).domComplete);
    await browser.assert.ok(events2hash(docLoad.annotations).loadEventStart);
    await browser.assert.ok(events2hash(docLoad.annotations).loadEventEnd);



    await browser.end();
  }
};