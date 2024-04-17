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

/**
 * Test if current browser matches condition. Condition can be:
 * 
 * * 'chrome' (one browser)
 * * {chrome: true} (one or multiple browsers)
 * * {chrome: 80} (chrome 80 - ...)
 * * {chrome: {max: 79}} (chrome ... - 79)
 * * {chrome: {min: 70, max: 79}} (chrome 70 - 79)
 * 
 * @typedef {'chrome' | 'microsoftedge' | 'firefox' | 'ie' | 'safari'} BrowserName
 * @typedef {{min?: number; max?: number}} VersionCondition
 * @typedef {{[x in BrowserName]?: number | VersionCondition}} BrowsersCondition
 * @param {import('nightwatch').NightwatchBrowser} browser Nightwatch browser object
 * @param {BrowsersCondition | BrowserName} matches Browser name or object to match with
 * @return boolean
 */
function isBrowser(browser, matches) {
  const browserName = browser.options.desiredCapabilities.browserName.toLowerCase();
  if (typeof matches === 'string') {
    return browserName === matches;
  }

  if (!(browserName in matches)) {
    return false;
  }

  let condition = matches[browserName];
  switch (typeof condition) {
  case 'boolean':
    return condition;
  case 'number':
    condition = { min: condition };
  }

  const { min, max } = condition;
  const version = parseInt(browser.options.desiredCapabilities.browser_version, 10);

  return (!min || version >= min) && (!max || version <= max);
}

module.exports = {
  isBrowser
};
