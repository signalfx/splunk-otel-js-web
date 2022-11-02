const fetch = require('node-fetch');
const { getSplunkRumContent } = require('./splunkRumProvider');

const SimpleReactApp = `
class Hello extends React.Component {
  render() {
    return React.createElement('div', null, \`Hello \${this.props.toWhat}\`);
  }
}

ReactDOM.render(
  React.createElement(Hello, {toWhat: 'World'}, null),
  document.getElementById('root')
);
`;

const REACT_BUNDLE_PATH = '/bundles/react-app';
const REACT_RUM_BUNDLE_PATH = '/bundles/react-app-rum';
const REACT_LIB_URL = 'https://unpkg.com/react@17/umd/react.production.min.js';
const REACT_DOM_LIB_URL = 'https://unpkg.com/react-dom@17/umd/react-dom.production.min.js';

async function handleReactBundleRequest(app) {
  const reactPackage = await fetch(REACT_LIB_URL).then(response => response.text());
  const reactDomPackage = await fetch(REACT_DOM_LIB_URL).then(response => response.text());
  const splunkRumPackage = getSplunkRumContent();

  app.get(REACT_BUNDLE_PATH, (_, res) => {
    res.set({
      'Content-Type': 'text/javascript',
    });
    res.send(reactPackage + reactDomPackage + SimpleReactApp);
  });

  app.get(REACT_RUM_BUNDLE_PATH, (_, res) => {
    res.set({
      'Content-Type': 'text/javascript',
    });
    res.send(reactPackage + reactDomPackage + SimpleReactApp + splunkRumPackage);
  });
};

function generateReactBundleTags () {
  return `
    <div id="root"></div>
    <script src="${REACT_BUNDLE_PATH}"></script>
  `;
}

function generateReactRumBundleTags () {
  return `
    <div id="root"></div>
    <script src="${REACT_RUM_BUNDLE_PATH}"></script>
  `;
}

module.exports = {
  handleReactBundleRequest,
  generateReactBundleTags,
  generateReactRumBundleTags,
};
