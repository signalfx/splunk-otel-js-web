const devServer = require('../../utils/devServer');

const SPAN_WAIT_TIMEOUT = 5 * 1000; // 5 seconds
const SPAN_WAIT_ITERATION_TIME = 50;

async function findSpan(spans, testFn, accruedTime) {
  accruedTime = accruedTime || 0;
  if (accruedTime > SPAN_WAIT_TIMEOUT) {
    console.error('Listing recorded spans for your convenience.');
    console.error(spans);
    throw new Error('Exceeded max time allowed waiting for span.');
  }

  const foundSpan = spans.find(testFn);
  if (foundSpan) {
    return foundSpan;
  }
  
  return new Promise((resolve) => {
    setTimeout(() => { 
      resolve(findSpan(spans, testFn, accruedTime + SPAN_WAIT_ITERATION_TIME)); 
    }, SPAN_WAIT_ITERATION_TIME);
  });
}

module.exports = {
  // This will be run before each test suite is started
  beforeEach: async (browser, done) => {
    const spans = [];
    const handleSpanReceived = (spanName) => { spans.push(spanName); };
    browser.globals.receivedSpans = spans;
    browser.globals.clearReceivedSpans = () => { spans.length = 0; };
    browser.globals.findSpan = (testFn) => findSpan(spans, testFn);

    console.log('Starting dev server (dummy page and traces receiver).');
    browser.globals._backend = await devServer.run({
      onSpanReceived: handleSpanReceived,
      enableHttps: browser.globals.enableHttps,
    });

    const wsProtocol = browser.globals.enableHttps ? 'wss' : 'ws';
    browser.globals.baseUrl = `${browser.globals.host}:${browser.globals._backend.port}/`;
    browser.globals.defaultUrl = `${browser.globals.baseUrl}?wsProtocol=${wsProtocol}&wsPort=${browser.globals._backend.websocketsPort}`;
    console.log('Started dev server.');

    // note: at the time this was written util.promisify breaks nightwatch here
    browser.status(() => {
      done();
    });
  },

  // This will be run after each test suite is finished
  afterEach: async function(browser, done) {
    console.log('Closing dev server.');
    if (browser.globals._backend) {
      await browser.globals._backend.close();
    }
    console.log('Closed dev server.');
    done();
  }
};
