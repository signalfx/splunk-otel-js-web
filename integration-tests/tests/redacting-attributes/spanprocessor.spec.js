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
  'redacting attributes with custom spanProcessor': async function(browser) {


    const url = browser.globals.getUrl('/spanprocessor/spanprocessor.ejs');
    await browser.url(url);
    const resourceFetch = await browser.globals.findSpan(span => span.name === 'resourceFetch');
    
    await browser.assert.ok(resourceFetch);

    await browser.assert.strictEqual(resourceFetch.tags['http.url'], 'redacted');
    //    const allSpans = await browser.globals.
  }
};
