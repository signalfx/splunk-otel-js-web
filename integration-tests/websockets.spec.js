module.exports = {
  'can produce websocket events': async function(browser) {
    await browser.url(browser.globals.defaultUrl);

    await browser.click('#connectWebsocketsBtn');
    const wsConnectionSpan = await browser.globals.findSpan(span => span.name === 'connect');    
    
    await browser.url(`${browser.globals.baseUrl}empty-page`);
    
    await browser.assert.strictEqual(wsConnectionSpan.tags['location.href'], browser.globals.defaultUrl);
    await browser.assert.strictEqual(wsConnectionSpan.tags['app'], 'splunk-otel-js-dummy-app');
    await browser.assert.strictEqual(wsConnectionSpan.tags['component'], 'websocket');
    await browser.assert.strictEqual(wsConnectionSpan.tags['ot.status_code'], 'OK');
    await browser.end();
  },
};
