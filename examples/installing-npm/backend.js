const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const { buildInstrumentationBackend } = require('../../utils/testBackendProvider');
const config = require('./webpack.config');

(async () => {
  await buildInstrumentationBackend({ enableHttps: false, httpPort: 9101, hostname: 'localhost' });

  const server = new WebpackDevServer(webpack(config));
  server.listen(9100, 'localhost', function (err) {
    if (err) {
      console.log(err);
    }
    console.log('WebpackDevServer listening at localhost:', 9100);
  });
})();
