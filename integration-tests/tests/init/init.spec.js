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
  'init fails when no beacon url set': async function(browser) {
    await browser.url(`${browser.globals.baseUrl}init/init.ejs`);
    try {
      await browser.globals.findSpan(() => {return true;});
      await browser.assert.ok(false);
    } catch (e) {
      await browser.assert.ok(true);
    }

    await browser.end();
  }
};