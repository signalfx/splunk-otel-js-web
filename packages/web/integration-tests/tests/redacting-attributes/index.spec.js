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
  'redacting attributes with custom exporter': async function(browser) {
    const url = browser.globals.getUrl('/redacting-attributes/index.ejs');
    await browser.url(url);

    await browser.click('#btnClick');

    const clickSpan = await browser.globals.findSpan(span => span.name === 'click');
    await browser.assert.ok(clickSpan);
    await browser.assert.strictEqual(clickSpan.tags['http.url'], '[redacted]');
  }
};
