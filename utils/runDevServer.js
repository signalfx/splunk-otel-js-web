const { run } = require('./devServer');
run({ enableHttps: true, onSpanReceived: (span) => console.log(span) });
