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
  'DOM resource 4xx': async function(browser) {
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/errors/views/resource-4xx.ejs'));

    const errorSpan = await browser.globals.findSpan(s => s.name === 'eventListener.error');
    await browser.assert.ok(!!errorSpan, 'Checking if error span was found.');

    const tags = errorSpan.tags;
    await browser.assert.strictEqual(tags['component'], 'error');
    await browser.assert.strictEqual(tags['error.type'], 'error');
    await browser.assert.strictEqual(tags['target_element'], 'IMG');
    await browser.assert.strictEqual(tags['target_xpath'], '//html/body/img');
    await browser.assert.ok(tags['target_src'].endsWith('/nonexistent.png'), `Checking target_src: ${tags['target_src']}`);

    await browser.end();
  },
  'JS syntax error': async function(browser) {
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/errors/views/js-syntax-error.ejs'));

    const errorSpan = await browser.globals.findSpan(s => s.name === 'onerror');
    await browser.assert.ok(!!errorSpan, 'Checking presence of error span.');

    const tags = errorSpan.tags;
    await browser.assert.strictEqual(tags['component'], 'error');
    await browser.assert.strictEqual(tags['error'], 'true');
    await browser.assert.strictEqual(tags['error.object'], 'SyntaxError');

    switch (browser.options.desiredCapabilities.browserName.toLowerCase()) {
    case 'chrome':
      await browser.assert.strictEqual(tags['error.message'], 'Unexpected token \';\'');
      break;
    case 'firefox':
      await browser.assert.strictEqual(tags['error.message'], 'expected expression, got \';\'');
      break;
    case 'safari':
      await browser.assert.strictEqual(tags['error.message'], 'Unexpected token \';\'');
      break;
    }

    await browser.end();
  },
  'JS unhandled error': async function(browser) {
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/errors/views/unhandled-error.ejs'));

    const errorSpan = await browser.globals.findSpan(s => s.name === 'onerror');
    await browser.assert.ok(!!errorSpan, 'Checking presence of error span.');

    const tags = errorSpan.tags;
    await browser.assert.strictEqual(tags['component'], 'error');
    await browser.assert.strictEqual(tags['error'], 'true');
    await browser.assert.strictEqual(tags['error.object'], 'TypeError');

    switch (browser.options.desiredCapabilities.browserName.toLowerCase()) {
    case 'chrome':
      await browser.assert.strictEqual(tags['error.message'], 'Cannot set property \'prop1\' of null');
      break;
    case 'firefox':
      await browser.assert.strictEqual(tags['error.message'], 'test is null');
      break;
    case 'safari':
      await browser.assert.strictEqual(tags['error.message'], 'null is not an object (evaluating \'test.prop1 = true\')');
      break;
    }

    await browser.end();
  },
  'unhandled promise rejection': async function(browser) {
    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/errors/views/unhandled-rejection.ejs'));

    const errorSpan = await browser.globals.findSpan(s => s.name === 'unhandledrejection');
    await browser.assert.ok(!!errorSpan, 'Checking presence of error span.');

    const tags = errorSpan.tags;
    await browser.assert.strictEqual(tags['component'], 'error');
    await browser.assert.strictEqual(tags['error'], 'true');
    await browser.assert.strictEqual(tags['error.object'], 'String');
    await browser.assert.strictEqual(tags['error.message'], 'rejection-value');

    await browser.end();
  },
  'manual console.error': async function(browser) {
    const browserName = browser.options.desiredCapabilities.browserName.toLowerCase();
    browser.globals.clearReceivedSpans();
    
    const url = browser.globals.getUrl('/errors/views/console-error.ejs');
    await browser.url(url);

    const errorSpan = await browser.globals.findSpan(s => s.name === 'console.error');
    await browser.assert.ok(!!errorSpan, 'Checking presence of error span.');

    const tags = errorSpan.tags;
    await browser.assert.strictEqual(tags['component'], 'error');
    await browser.assert.strictEqual(tags['error'], 'true');
    await browser.assert.strictEqual(tags['error.object'], 'TypeError');

    const ERROR_MESSAGE_MAP = {
      safari: 'null is not an object (evaluating \'someNull.anyField = \'value\'\')',
      chrome: 'Cannot set property \'anyField\' of null',
      edge: 'Cannot set property \'anyField\' of null',
      firefox: 'someNull is null',
    };
    await browser.assert.strictEqual(tags['error.message'], ERROR_MESSAGE_MAP[browserName]);

    const ERROR_STACK_MAP = {
      safari: `global code@${url}:16:15`,
      chrome: `TypeError: Cannot set property 'anyField' of null\n    at ${url}:16:25`,
      edge: `TypeError: Cannot set property 'anyField' of null\n    at ${url}:16:25`,
      firefox: `@${url}:16:7\n`,
    };
    await browser.assert.strictEqual(tags['error.stack'], ERROR_STACK_MAP[browserName]);

    await browser.end();
  },
  'SplunkRum.error': async function(browser) {
    const browserName = browser.options.desiredCapabilities.browserName.toLowerCase();
    browser.globals.clearReceivedSpans();
    
    const url = browser.globals.getUrl('/errors/views/splunkrum-error.ejs');
    await browser.url(url);

    const errorSpan = await browser.globals.findSpan(s => s.name === 'SplunkRum.error');
    await browser.assert.ok(!!errorSpan, 'Checking presence of error span.');

    const tags = errorSpan.tags;
    await browser.assert.strictEqual(tags['component'], 'error');
    await browser.assert.strictEqual(tags['error'], 'true');
    await browser.assert.strictEqual(tags['error.object'], 'TypeError');

    const ERROR_MESSAGE_MAP = {
      safari: 'null is not an object (evaluating \'someNull.anyField = \'value\'\')',
      chrome: 'Cannot set property \'anyField\' of null',
      edge: 'Cannot set property \'anyField\' of null',
      firefox: 'someNull is null',
    };
    await browser.assert.strictEqual(tags['error.message'], ERROR_MESSAGE_MAP[browserName]);

    const ERROR_STACK_MAP = {
      safari: `global code@${url}:16:15`,
      chrome: `TypeError: Cannot set property 'anyField' of null\n    at ${url}:16:25`,
      edge: `TypeError: Cannot set property 'anyField' of null\n    at ${url}:16:25`,
      firefox: `@${url}:16:7\n`,
    };
    await browser.assert.strictEqual(tags['error.stack'], ERROR_STACK_MAP[browserName]);

    await browser.end();
  }
};
