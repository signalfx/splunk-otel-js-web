const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const {render, renderFile} = require('ejs');

const SPLUNK_RUM_TAGS_TEMPLATE = `
<script src="<%= file -%>"></script>
<script>
  window.SplunkRum && window.SplunkRum.init(<%- options -%>)
</script>
`;

const LIB_DISK_PATH = path.join(__dirname, '..', '..', 'dist', 'splunk-rum.js');
const LIB_PATH = '/bundles/splunk-rum';

async function handleSplunkRumRequest(app) {
  app.get(LIB_PATH, (_, res) => {
    res.set({
      'Content-Type': 'text/javascript',
    });
    res.send(getSplunkRumContent());
  });
}

function generateSplunkRumTags () {
  const options = {
    beaconUrl: `/api/v2/spans`, 
    app: 'splunk-otel-js-dummy-app',
    debug: false,
  };

  return render(SPLUNK_RUM_TAGS_TEMPLATE, {
    file: '/dist/splunk-rum.js',
    options: JSON.stringify(options),
  });
}

function getSplunkRumContent() {
  return fs.readFileSync(LIB_DISK_PATH);
}

module.exports = {
  handleSplunkRumRequest,
  generateSplunkRumTags,
  getSplunkRumContent,
};
