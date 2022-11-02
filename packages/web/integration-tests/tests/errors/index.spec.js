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

module.exports = {
  beforeEach: function (browser) {
    browser.globals.clearReceivedSpans();
  },
  'DOM resource 4xx': async function(browser) {
    await browser.url(browser.globals.getUrl('/errors/views/resource-4xx.ejs'));

    const errorSpan = await browser.globals.findSpan(s => s.name === 'eventListener.error');
    await browser.assert.ok(!!errorSpan, 'Checking if error span was found.');

    const tags = errorSpan.tags;
    await browser.assert.strictEqual(tags['component'], 'error');
    await browser.assert.strictEqual(tags['error.type'], 'error');
    await browser.assert.strictEqual(tags['target_element'], 'IMG');
    await browser.assert.strictEqual(tags['target_xpath'], '//html/body/img');
    await browser.assert.ok(tags['target_src'].endsWith('/nonexistent.png'), `Checking target_src: ${tags['target_src']}`);
  },
  'JS syntax error': async function(browser) {
    await browser.url(browser.globals.getUrl('/errors/views/js-syntax-error.ejs'));

    const errorSpan = await browser.globals.findSpan(s => s.name === 'onerror');
    await browser.assert.ok(!!errorSpan, 'Checking presence of error span.');

    const tags = errorSpan.tags;
    await browser.assert.strictEqual(tags['component'], 'error');
    await browser.assert.strictEqual(tags['error'], 'true');
    await browser.assert.strictEqual(tags['error.object'], isBrowser(browser, 'internet explorer') ? 'String' : 'SyntaxError');

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
    case 'internet explorer':
      await browser.assert.strictEqual(tags['error.message'], 'Syntax error');
      break;
    }
  },
  'JS unhandled error': async function(browser) {
    await browser.url(browser.globals.getUrl('/errors/views/unhandled-error.ejs'));

    const errorSpan = await browser.globals.findSpan(s => s.name === 'onerror');
    await browser.assert.ok(errorSpan, 'Checking presence of error span.');

    const tags = errorSpan.tags;
    await browser.assert.strictEqual(tags['component'], 'error');
    await browser.assert.strictEqual(tags['error'], 'true');
    await browser.assert.strictEqual(tags['error.object'], 'TypeError');

    switch (browser.options.desiredCapabilities.browserName.toLowerCase()) {
    case 'chrome':
      await browser.assert.strictEqual(tags['error.message'], 'Cannot set properties of null (setting \'prop1\')');
      break;
    case 'firefox':
      await browser.assert.strictEqual(tags['error.message'], 'test is null');
      break;
    case 'safari':
      await browser.assert.strictEqual(tags['error.message'], 'null is not an object (evaluating \'test.prop1 = true\')');
      break;
    case 'internet explorer':
      await browser.assert.strictEqual(tags['error.message'], 'Unable to set property \'prop1\' of undefined or null reference');
      break;
    }
  },
  'unhandled promise rejection': async function(browser) {
    if (isBrowser(browser, 'internet explorer')) {
      return; // No native promise
    }
    await browser.url(browser.globals.getUrl('/errors/views/unhandled-rejection.ejs'));

    const errorSpan = await browser.globals.findSpan(s => s.name === 'unhandledrejection');
    await browser.assert.ok(!!errorSpan, 'Checking presence of error span.');

    const tags = errorSpan.tags;
    await browser.assert.strictEqual(tags['component'], 'error');
    await browser.assert.strictEqual(tags['error'], 'true');
    await browser.assert.strictEqual(tags['error.object'], 'String');
    await browser.assert.strictEqual(tags['error.message'], 'rejection-value');
  },
  'manual console.error': async function(browser) {
    const browserName = browser.options.desiredCapabilities.browserName.toLowerCase();
    
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
      chrome: 'Cannot set properties of null (setting \'anyField\')',
      microsoftedge: 'Cannot set properties of null (setting \'anyField\')',
      firefox: 'someNull is null',
      'internet explorer': 'Unable to set property \'anyField\' of undefined or null reference',
    };
    await browser.assert.strictEqual(tags['error.message'], ERROR_MESSAGE_MAP[browserName]);

    const ERROR_STACK_MAP = {
      safari: `global code@${url}:62:15`,
      chrome: `TypeError: Cannot set properties of null (setting 'anyField')\n    at ${url}:62:25`,
      microsoftedge: `TypeError: Cannot set properties of null (setting 'anyField')\n    at ${url}:62:25`,
      firefox: `@${url}:62:7\n`,
      'internet explorer': `TypeError: Unable to set property 'anyField' of undefined or null reference\n   at Global code (${url}:62:7)`,
    };
    await browser.assert.strictEqual(tags['error.stack'], ERROR_STACK_MAP[browserName]);
  },
  'SplunkRum.error': async function(browser) {
    const browserName = browser.options.desiredCapabilities.browserName.toLowerCase();
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
      chrome: 'Cannot set properties of null (setting \'anyField\')',
      microsoftedge: 'Cannot set properties of null (setting \'anyField\')',
      firefox: 'someNull is null',
      'internet explorer': 'Unable to set property \'anyField\' of undefined or null reference',
    };

    await browser.assert.strictEqual(tags['error.message'], ERROR_MESSAGE_MAP[browserName]);

    const ERROR_STACK_MAP = {
      safari: `global code@${url}:62:15`,
      microsoftedge: `TypeError: Cannot set properties of null (setting 'anyField')\n    at ${url}:62:25`,
      chrome: `TypeError: Cannot set properties of null (setting 'anyField')\n    at ${url}:62:25`,
      firefox: `@${url}:62:7\n`,
      'internet explorer': `TypeError: Unable to set property 'anyField' of undefined or null reference\n   at Global code (${url}:62:7)`,
    };
    await browser.assert.strictEqual(tags['error.stack'], ERROR_STACK_MAP[browserName]);
  },
  'module can be disabled': async function(browser) {
    await browser.url(browser.globals.getUrl('/errors/views/unhandled-error.ejs'));
    await browser.globals.waitForTestToFinish();

    browser.assert.ok(!!browser.globals.getReceivedSpans().find(({ name }) => name === 'onerror'), 'Checking presence of error span.');

    browser.globals.clearReceivedSpans();
    await browser.url(browser.globals.getUrl('/errors/views/unhandled-error.ejs?disableInstrumentation=errors'));
    await browser.globals.waitForTestToFinish();

    browser.assert.not.ok(browser.globals.getReceivedSpans().find(({ name }) => name === 'onerror'), 'Checking lack of error span.');
  }
};
