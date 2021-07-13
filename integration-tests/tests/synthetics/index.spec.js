
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

const { buildBackendContext } = require("../../utils/globals");

module.exports = {
  'applies Synthetics Run Id attribute on all spans': async function(browser) {
    const backendCtx = await buildBackendContext(browser);

    browser.globals.clearReceivedSpans();
    await browser.url(backendCtx.getUrl('/synthetics/index.ejs', undefined, {
      syntheticsRunId: 'abcd1234'.repeat(4),
    }).toString());

    const guardSpan = await backendCtx.findSpan(s => s.name === 'guard-span');
    await browser.assert.ok(guardSpan, 'Ensuring guard-span has arrived before we start inspecting spans.');

    for (const span of backendCtx.getReceivedSpans()) {
      await browser.assert.strictEqual(span.tags['Synthetics-RunId'], 'abcd1234'.repeat(4));
    }

    await backendCtx._closeBackend();
  },

  'does not apply Synthetics Run Id attribute on all spans if not included': async function(browser) {
    const backendCtx = await buildBackendContext(browser);

    backendCtx.clearReceivedSpans();
    await browser.url(backendCtx.getUrl('/synthetics/index.ejs'));

    const guardSpan = await backendCtx.findSpan(s => s.name === 'guard-span');
    await browser.assert.ok(guardSpan, 'Ensuring guard-span has arrived before we start inspecting spans.');

    for (const span of backendCtx.getReceivedSpans()) {
      await browser.assert.strictEqual(span.tags['Synthetics-RunId'], undefined);
    }

    await backendCtx._closeBackend();
  },
};
