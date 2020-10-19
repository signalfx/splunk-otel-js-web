const path = require('path');
const { execSync } = require('child_process');

console.log('Loading config.');
if (!process.env.BROWSERSTACK_USER || !process.env.BROWSERSTACK_KEY) {
  throw new Error('You need to provide environment variables: BROWSERSTACK_USER and BROWSERSTACK_KEY.');
}

const commitId = process.env.CIRCLE_SHA1 || execSync('git rev-parse HEAD').toString();
const author = process.env.CIRCLE_PR_USERNAME || 'unknown';

const nightwatch_config = {
  src_folders: ['integration-tests'],
  globals_path: path.join(__dirname, 'globals.js'),
  filter: '*.spec.js',

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
        'browserstack.selenium_version': '3.14.0',

        // note: some tests may rely on viewport size
        'resolution': '1366x768',

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
    firefox: {
      desiredCapabilities: {
        os: 'Windows',
        os_version: '10',
        browserName: 'Firefox',
        browser_version: 'latest',
      }
    },
    safari: {
      desiredCapabilities: {
        os: 'OS X',
        os_version: 'Catalina',
        browserName: 'Safari',
        browser_version: '13.1',
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
        'os_version': '14',
        'device': 'iPhone 11',
        'real_mobile': 'true',
        'browserName' : 'iPhone',
      }
    },
    android: {
      desiredCapabilities: {
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
