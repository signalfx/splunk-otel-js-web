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
const chromeDriver = require('chromedriver');
const geckoDriver = require('geckodriver');
const seleniumServer = require('selenium-server');

const nightwatch_config = {
  src_folders: ['integration-tests/tests'],
  globals_path: path.join(__dirname, 'globals.js'),
  filter: '**/*.spec.js',

  selenium: {
    start_process: true,
    start_session: false,
    server_path: seleniumServer.path,
    port: 9515,
    check_process_delay: 5000,
    cli_args: {
      'webdriver.chrome.driver': chromeDriver.path,
      'webdriver.gecko.driver': geckoDriver.path,
    }
  },

  // detailed_output: false,
  test_settings: {
    default: {
      desiredCapabilities: {
        acceptSslCerts: true,
        acceptInsecureCerts: true,
      },
      globals: {
        hostname: 'localhost',
        enableHttps: true,
      },
    },
    headlessChrome: {
      desiredCapabilities: {
        browserName: 'chrome',
        chromeOptions: {
          w3c: false,
          args: ['headless', 'disable-gpu']
        }
      }
    },
    chrome: {
      desiredCapabilities: {
        browserName: 'chrome',
        chromeOptions: {
          w3c: false,
          args: ['disable-gpu']
        }
      }
    },
    firefox: {
      desiredCapabilities: {
        browserName: 'firefox',
        marionette: true,
      }
    },
    headlessFirefox: {
      desiredCapabilities: {
        browserName: 'firefox',
        marionette: true,
        'moz:firefoxOptions': {
          'args': ['--headless']
        },
      }
    },
    safari: {
      webdriver: {
        use_legacy_jsonwire: false,
        start_process: true,
        server_path: '/usr/bin/safaridriver',
        port: 4445,
      },
      desiredCapabilities: {
        browserName: 'safari',
        acceptSslCerts: false,
        acceptInsecureCerts: false,
      },
      globals: {
        enableHttps: false,
      },
    },
  }
};

module.exports = nightwatch_config;
