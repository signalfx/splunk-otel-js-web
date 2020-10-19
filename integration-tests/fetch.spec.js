module.exports = {
  'span created for fetch includes all properties': async function(browser) {
    await browser.url(browser.globals.defaultUrl);
    await browser.click('#regularFetchBtn');

    const fetchSpan = await browser.globals.findSpan(span => span.tags['http.url'] === '/some-data');
    await browser.assert.ok(fetchSpan.tags['component'], 'fetch');
    await browser.assert.ok(fetchSpan.tags['ot.status_code'], 'OK');
    await browser.assert.ok(fetchSpan.tags['http.status_code'], '200');
    await browser.assert.ok(fetchSpan.tags['http.status_text'], 'OK');
    await browser.assert.ok(fetchSpan.tags['http.method'], 'GET');
    await browser.assert.ok(fetchSpan.tags['http.url'], '/some-data1');
    await browser.assert.ok(fetchSpan.tags['location.href'], browser.globals.defaultUrl);
    await browser.end();
  },
};
