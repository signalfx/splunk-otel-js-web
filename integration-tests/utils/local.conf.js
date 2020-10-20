const path = require('path');
const chromeDriver = require('chromedriver');
const geckoDriver = require('geckodriver');
const seleniumServer = require('selenium-server');

const nightwatch_config = {
  src_folders: ['integration-tests'],
  globals_path: path.join(__dirname, 'globals.js'),
  filter: '*.spec.js',

  selenium: {
    start_process: true,
    start_session: false,
    server_path: seleniumServer.path,
    port: 9515,
    cli_args: {
      'webdriver.chrome.driver': chromeDriver.path,
      'webdriver.gecko.driver': geckoDriver.path,
    }
  },

  test_settings: {
    default: {
      desiredCapabilities: {
        acceptSslCerts: true,
        acceptInsecureCerts: true,
      },
      globals: {
        host: 'https://localhost',
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
  }
};

module.exports = nightwatch_config;
