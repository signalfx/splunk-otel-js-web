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

const { isBrowser } = require('../../utils/helpers');
const { inspect } = require('util');

module.exports = {
  '@disabled': true, // too flaky, will fix when migrating from nightwatch
  beforeEach: function(browser) {
    browser.globals.clearReceivedSpans();
  },
  'should report resource loads happening after page load': async function(browser) {
    if (isBrowser(browser, {
      safari: true,
      edge: true,
      ie: true,
    })) {
      return;
    }
    await browser.url(browser.globals.getUrl('/resource-observer/resources.ejs'));

    await browser.globals.findSpan(span => span.name === 'guard-span');

    const plAgentSpans = browser.globals.getReceivedSpans().filter( 
      span => span.tags['http.url'] && span.tags['http.url'].endsWith('splunk-otel-web.js')
    );
    const plImageSpans = browser.globals.getReceivedSpans().filter( 
      span => span.tags['http.url'] && span.tags['http.url'].endsWith('no-cache.png')
    );
    
    await browser.assert.strictEqual(plAgentSpans.length, 1);
    await browser.assert.strictEqual(plImageSpans.length, 1);
  
    const imageSpan = await browser.globals.findSpan(
      span => span.tags['http.url'] && span.tags['http.url'].endsWith('splunk-black.png?t=100')
    );

    await browser.assert.ok(!!imageSpan, 'Image span found.');
    await browser.assert.strictEqual(imageSpan.tags['component'], 'splunk-post-doc-load-resource');
    const imgUrl = browser.globals.getUrl('/utils/devServer/assets/', []) + 'splunk-black.png?t=100';
    await browser.assert.strictEqual(imageSpan.tags['http.url'], imgUrl);
    await browser.assert.strictEqual(imageSpan.annotations.length, 9, 'Missing network events');

    const scriptSpan = await browser.globals.findSpan(
      span => span.tags['http.url'] && span.tags['http.url'].endsWith('test.js')
    );

    await browser.assert.strictEqual(scriptSpan.tags['component'], 'splunk-post-doc-load-resource');
    const scriptUrl = browser.globals.getUrl('/utils/devServer/assets/', []) + 'test.js';
    await browser.assert.strictEqual(scriptSpan.tags['http.url'], scriptUrl);
    await browser.assert.strictEqual(scriptSpan.annotations.length, 9, 'Missing network events');
  },
  'resources can be ignored': async function(browser) {
    if (isBrowser(browser, {
      safari: true,
      edge: true,
      ie: true,
    })) {
      return;
    }
    await browser.url(browser.globals.getUrl('/resource-observer/resources-ignored.ejs'));
    
    await browser.globals.findSpan(span => span.name === 'guard-span');
    const url = browser.globals.getUrl('/utils/devServer/assets/', []);
    await browser.assert.not.ok(browser.globals.getReceivedSpans().find(
      span => span.tags['http.url'] === url + 'test.js' && span.tags['component'] === 'splunk-post-doc-load-resource'
    ));
    const imgSpan = browser.globals.getReceivedSpans().find(
      span => span.tags['http.url'] === url + 'splunk-black.png' && span.tags['component'] === 'splunk-post-doc-load-resource'
    );
    await browser.assert.not.ok(imgSpan);
  },
  'should create one span for cached resource': async function(browser) {
    if (isBrowser(browser, {
      safari: true,
      edge: true,
      ie: true,
    })) {
      return;
    }
    await browser.url(browser.globals.getUrl('/resource-observer/resources-twice.ejs'));
    await browser.globals.findSpan(span => span.name === 'guard-span');

    const imageSpans = await browser.globals.getReceivedSpans().filter(
      span => span.tags['http.url'] && span.tags['http.url'].endsWith('splunk-black.png')
    );
      
    // for debugging flaky tests
    if (imageSpans.length !== 0) {
      console.log('imageSpans.length');
      console.log(inspect(imageSpans, { depth: 10 } ));
    }

    await browser.assert.strictEqual(imageSpans.length , 1);
    await browser.assert.strictEqual(imageSpans[0].tags['component'] , 'document-load');
  },
  'should create two spans for non cached resource': async function(browser) {
    if (isBrowser(browser, {
      safari: true,
      edge: true,
      ie: true,
    })) {
      return;
    }
    if (browser.options.desiredCapabilities.browserName.toLowerCase() === 'firefox') {
      // Can't get fx to stop caching the image.
      return;
    }
    await browser.url(browser.globals.getUrl('/resource-observer/resources-twice-no-cache.ejs'));
    await browser.globals.findSpan(span => span.name === 'guard-span');

    const imageSpans = await browser.globals.getReceivedSpans().filter(
      span => span.tags['http.url'] && span.tags['http.url'].endsWith('no-cache.png')
    );
    
    // for debugging flaky tests
    if (imageSpans.length !== 2) {
      console.log('imageSpans.length');
      console.log(inspect(imageSpans, { depth: 10 } ));
    }
    await browser.assert.strictEqual(imageSpans.length , 2);
    const docLoadImage = imageSpans.find( span => span.tags['component'] === 'document-load');
    const afterLoadImage = imageSpans.find( span => span.tags['component'] === 'splunk-post-doc-load-resource');

    await browser.assert.notEqual(docLoadImage.traceId, afterLoadImage.traceId);
  }
};
