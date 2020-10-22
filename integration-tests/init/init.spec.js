module.exports = {
  'init test': async function(browser) {
    await browser.url(`${browser.globals.baseUrl}init/init.ejs`);
    await browser.assert.ok(true);
    await browser.end();
  },
};