module.exports = {

  timesMakeSense: async function(browser, eventsArr, startName, endName) {
    const name2time = {};
    eventsArr.forEach(event => {
      name2time[event.value] = event.timestamp;
    });
    await browser.assert.ok(name2time[startName], `Checking presence of ${startName}`);
    await browser.assert.ok(name2time[endName], `Checking presence of ${endName}`);
    await browser.assert.ok(name2time[startName] <= name2time[endName], `Checking sanity of ${startName} vs ${endName}`);
    const diff = name2time[endName] - name2time[startName];
    // times reported in zipkin as micros
    // looking for egregiously incorrect response times here, not a tight bound
    const fiveMinutes = 5 * 60 * 1000 * 1000;
    await browser.assert.ok(diff < fiveMinutes, 'Sanity check for time difference.'); 
    // Also looking for rough synchronization with reality (at least from our CI systems/laptops...)
    const nowMicros = new Date().getTime() * 1000;
    let clockSkew = name2time[startName] - nowMicros;
    if (clockSkew < 0) {
      clockSkew = -clockSkew;
    }
    await browser.assert.ok(clockSkew <= fiveMinutes, 'Sanity check for clock skew');
  },

};


