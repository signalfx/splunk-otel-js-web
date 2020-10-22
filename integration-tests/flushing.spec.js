module.exports = {
  'cache should be flushed when window is de-focused': async function(browser) {
    await browser.url(browser.globals.defaultUrl);
    // TODO: try opening 2 tabs

    browser.globals.clearReceivedSpans();
    await browser.click('#rejectBtn');
    await new Promise(resolve => setTimeout(resolve, 10));

    // trigger unload, but don't kill the window just yet
    await browser.url(`${browser.globals.baseUrl}empty-page`);
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // consider updating results (if this assertion fails) in browserstack using their REST api
    await browser.assert.ok(browser.globals.receivedSpans.some(span => span.name === 'unhandledrejection'));
    await browser.end();
  },
};
