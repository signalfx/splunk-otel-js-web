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

const path = require('path');
const { execSync } = require('child_process');

console.log('Loading config.');
if (!process.env.BROWSERSTACK_USER || !process.env.BROWSERSTACK_KEY) {
  throw new Error('You need to provide environment variables: BROWSERSTACK_USER and BROWSERSTACK_KEY.');
}

const commitId = process.env.CIRCLE_SHA1 || execSync('git rev-parse HEAD').toString();
const author = process.env.CIRCLE_PR_USERNAME || 'unknown';

const nightwatch_config = {
  src_folders: ['integration-tests/tests'],
  globals_path: path.join(__dirname, 'globals.js'),
  filter: '**/*.spec.js',

  selenium : {
    'start_process': false,
    'host': 'hub-cloud.browserstack.com',
    'port': 443,
    'browserstack.local': true,
  },

  test_settings: {
    default: {
      desiredCapabilities: {
        'browserstack.user': process.env.BROWSERSTACK_USER,
        'browserstack.key': process.env.BROWSERSTACK_KEY,

        // note: enables local tunnel/proxy
        'browserstack.local': true,
        'browserstack.debug': true,

        'browserstack.console': 'errors',
        'browserstack.networkLogs': true,
        'browserstack.wsLocalSupport': 'true',
        'browserstack.selenium_version': '3.14.0',

        // note: some tests may rely on viewport size
        // 'resolution': '1366x768',

        acceptSslCerts: true,
        acceptInsecureCerts: true,

        // metadata for grouping sessions in browserstack
        project: require('../../package.json').name,
        build: `${commitId.substring(0, 16)} by ${author}`,
      },
      globals: {
        host: 'https://bs-local.com',
        enableHttps: true, // this is for our server
      }
    },
    chrome: {
      desiredCapabilities: {
        os: 'Windows',
        os_version: '10',
        browserName: 'Chrome',
        browser_version: 'latest',
      }
    },
    /*
    // FIXME firefox broken (-3)
    firefox: {
      desiredCapabilities: {
        os: 'Windows',
        os_version: '10',
        browserName: 'Firefox',
        browser_version: 'latest',
      }
    },
    */
    safari: {
      desiredCapabilities: {
        os: 'OS X',
        os_version: 'Catalina',
        browserName: 'Safari',
        browser_version: '13.1',
        resolution: '1024x768',
      }
    },
    safari10: {
      desiredCapabilities: {
        os: 'OS X',
        os_version: 'Sierra',
        browserName: 'Safari',
        browser_version: '10.1',
        resolution: '1024x768',
      }
    },
    edge: {
      desiredCapabilities: {
        os: 'Windows',
        os_version: '10',
        browserName: 'Edge',
        browser_version: 'latest',
      }
    },
    ie11: {
      desiredCapabilities: {
        'os': 'Windows',
        'os_version': '10',
        'browserName': 'IE',
        'browser_version': '11.0',
      }
    },
    iphone: {
      desiredCapabilities: {
        'browser': 'safari',
        'os_version': '14',
        'device': 'iPhone 11',
        'real_mobile': 'true',
        'browserName' : 'iPhone',
      }
    },
    android: {
      desiredCapabilities: {
        'browser': 'chrome',
        'os_version': '11.0',
        'device': 'Google Pixel 4',
        'real_mobile': 'true',
        'browserName': 'Android'
      }
    }
  }
};

// TODO: below was copied from browserstack documentation, review if it is necessary
// Code to support common capabilites
for(const i in nightwatch_config.test_settings){
  const config = nightwatch_config.test_settings[i];
  config['selenium_host'] = nightwatch_config.selenium.host;
  config['selenium_port'] = nightwatch_config.selenium.port;
  config['desiredCapabilities'] = config['desiredCapabilities'] || {};
  for(const j in nightwatch_config.common_capabilities){
    config['desiredCapabilities'][j] = config['desiredCapabilities'][j] || nightwatch_config.common_capabilities[j];
  }
}

console.log('Config loaded.');
module.exports = nightwatch_config;
