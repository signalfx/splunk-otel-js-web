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

const { join } = require('path');
const build = `Nightwatch Desktop Web build-${ new Date().getTime() }`;

// More information about the configuration file can be found here
// https://nightwatchjs.org/gettingstarted/configuration/
module.exports = {
  src_folders: ['integration-tests/tests'],
  globals_path: join(__dirname, 'globals.js'),
  // See `/tests/custom-commands/customSauceLabsEnd.js` for the logic
  custom_commands_path: join(__dirname, 'custom-commands/'),
  filter: '**/*.spec.js',

  test_workers: {
    enabled: true,
    workers: 'auto',
  },

  test_settings: {
    // Our Sauce Labs object
    sauceLabs: {
      selenium_host: `ondemand.${process.env.REGION === 'eu' ? 'eu-central-1' : 'us-west-1'}.saucelabs.com`,
      selenium_port: 80,
      username: process.env.SAUCE_USERNAME,
      access_key: process.env.SAUCE_ACCESS_KEY,
      desiredCapabilities: {
        acceptSslCerts: true,
        acceptInsecureCerts: true,
        'sauce:options': {
          build,
          tunnelName: process.env.SAUCE_TUNNEL_ID,
          screenResolution: '1600x1200',
          seleniumVersion: '3.141.59',
          extendedDebugging: true,
        },
      },
      globals: {
        hostname: 'bs-local.com',
        enableHttps: true
      }
    },
    localChrome: {
      desiredCapabilities: {
        browserName: 'chrome',
        alwaysMatch: {
          'goog:chromeOptions': {
            args: [
              '--no-sandbox',
              '--disable-infobars',
              '--headless',
            ],
          },
        },
      },

      webdriver: {
        start_process: true,
        port: 9515,
        server_path: require('chromedriver').path,
      },
    },

    // Sauce Labs capabilities
    chrome: {
      extends: 'sauceLabs',
      desiredCapabilities: {
        browserName: 'chrome',
        platform: 'Windows 10',
        version: 'latest',
      },
    },
    firefox: {
      extends: 'sauceLabs',
      desiredCapabilities: {
        browserName: 'firefox',
        platform: 'Windows 10',
        version: 'latest',
      },
    },
    ie11: {
      extends: 'sauceLabs',
      desiredCapabilities: {
        browserName: 'internet explorer',
        browserVersion: '11',
        platformName: 'Windows 10',
      },
    },
    edge: {
      extends: 'sauceLabs',
      desiredCapabilities: {
        browserName: 'MicrosoftEdge',
        platform: 'Windows 10',
        version: 'latest',
      },
    },
    safari: {
      extends: 'sauceLabs',
      desiredCapabilities: {
        browserName: 'safari',
        browserVersion: '13',
        'sauce:options': {
        }
      },
    },
  },
};