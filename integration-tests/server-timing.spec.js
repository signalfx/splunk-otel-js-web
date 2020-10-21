module.exports = {
  'traceId should be attached to documentFetch span if Server-Timing was sent': async function(browser) {
    // TODO: restructure into a proper feature support matrix
    const UNSUPPORTED_BROWSERS = ['Safari', 'IE', 'iPhone'];
    const currentBrowser = browser.options.desiredCapabilities.browserName;
    if (UNSUPPORTED_BROWSERS.includes(currentBrowser)) {
      return;
    }

    // preload the page once for firefox
    // in some cases firefox will report negative fetchStart for localhost pages
    // in that case opentelemetry-plugin-document-load will not report any spans
    await browser.url(browser.globals.baseUrl);

    await browser.url(browser.globals.defaultUrl);
    const expectedTraceId = browser.globals._backend.getLastServerTiming().traceId;

    const docFetchSpan = await browser.globals.findSpan(span => span.name === 'documentFetch' && span.tags['link.traceId'] === expectedTraceId);
    await browser.assert.strictEqual(docFetchSpan.tags['link.traceId'], expectedTraceId);
    await browser.assert.strictEqual(docFetchSpan.tags['location.href'], browser.globals.defaultUrl);
    await browser.assert.strictEqual(docFetchSpan.tags['app'], 'splunk-otel-js-dummy-app');
    await browser.assert.strictEqual(docFetchSpan.tags['component'], 'document-load');
    await browser.assert.strictEqual(docFetchSpan.tags['splunk.rumVersion'], require('../package.json').version);
    await browser.assert.strictEqual(docFetchSpan.tags['ot.status_code'], 'OK');
    await browser.end();
  },
};
