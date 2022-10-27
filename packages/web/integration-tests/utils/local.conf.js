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

const geckodriver = require('geckodriver');

const nightwatch_config = {
  src_folders: ['integration-tests/tests'],
  globals_path: path.join(__dirname, 'globals.js'),
  filter: '**/*.spec.js',

  webdriver: {},
  // Selenium Server is running locally and is managed by Nightwatch
  /*
  selenium: {
    start_process: true,
    port: 9515,
    server_path: '', // Leave empty if @nightwatch/selenium-server is installed
    command: 'standalone', // Selenium 4 only
    check_process_delay: 5000,
    cli_args: {
      'webdriver.chrome.driver': chromeDriver.path,
      'webdriver.gecko.driver': geckoDriver.path,
    }
  },
  */

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
    chrome: {
      desiredCapabilities : {
        browserName : 'chrome',
        'goog:chromeOptions' : {
          // More info on Chromedriver: https://sites.google.com/a/chromium.org/chromedriver/
          //
          // w3c:false tells Chromedriver to run using the legacy JSONWire protocol (not required in Chrome 78)
          w3c: true,
          args: [
            //'--no-sandbox',
            '--ignore-certificate-errors',
            //'--allow-insecure-localhost',
            // '--headless'
          ]
        }
      },
      webdriver: {
        start_process: true,
        server_path: '',
        cli_args: [
          // --verbose
        ]
      }
    },
    headlessChrome: {
      desiredCapabilities : {
        browserName : 'chrome',
        'goog:chromeOptions' : {
          // More info on Chromedriver: https://sites.google.com/a/chromium.org/chromedriver/
          //
          // w3c:false tells Chromedriver to run using the legacy JSONWire protocol (not required in Chrome 78)
          w3c: true,
          args: [
            //'--no-sandbox',
            '--ignore-certificate-errors',
            //'--allow-insecure-localhost',
            '--headless'
          ]
        }
      },
      webdriver: {
        start_process: true,
        server_path: '',
        cli_args: [
          // --verbose
        ]
      }
    },

    firefox: {
      desiredCapabilities : {
        browserName: 'firefox',
        alwaysMatch: {
          'moz:firefoxOptions': {
            args: [
              // '-headless',
              // '-verbose'
            ]
          }
        }
      },
      webdriver: {
        start_process: true,
        server_path: '',
        cli_args: [
          // very verbose geckodriver logs
          // '-vv'
        ]
      }
    },

    headlessFirefox: {
      desiredCapabilities : {
        browserName: 'firefox',
        alwaysMatch: {
          'moz:firefoxOptions': {
            args: [
              '-headless',
              // '-verbose'
            ]
          }
        },
        'moz:firefoxOptions': {
          args: [
            '-headless',
            // '-verbose'
          ]
        }
      },
      webdriver: {
        start_process: true,
        server_path: process.env.GECKOWEBDRIVER ? `${process.env.GECKOWEBDRIVER}/geckodriver` : (geckodriver.path ?? ''),
        host: '127.0.0.1',
        cli_args: [
          // very verbose geckodriver logs
          '-vv'
        ]
      }
    },
    safari: {
      desiredCapabilities : {
        browserName : 'safari',
        alwaysMatch: {
          acceptInsecureCerts: false
        }
      },
      webdriver: {
        start_process: true,
        server_path: ''
      }
    },
  }
};

module.exports = nightwatch_config;
