/**
 *
 * Copyright 2024 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
const fetch = require('node-fetch')
const { getSplunkRumContent } = require('./splunkRumProvider')

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
`

const REACT_BUNDLE_PATH = '/bundles/react-app'
const REACT_RUM_BUNDLE_PATH = '/bundles/react-app-rum'
const REACT_LIB_URL = 'https://unpkg.com/react@17/umd/react.production.min.js'
const REACT_DOM_LIB_URL = 'https://unpkg.com/react-dom@17/umd/react-dom.production.min.js'

async function handleReactBundleRequest(app) {
	const reactPackage = await fetch(REACT_LIB_URL).then((response) => response.text())
	const reactDomPackage = await fetch(REACT_DOM_LIB_URL).then((response) => response.text())
	const splunkRumPackage = getSplunkRumContent()

	app.get(REACT_BUNDLE_PATH, (_, res) => {
		res.set({
			'Content-Type': 'text/javascript',
		})
		res.send(reactPackage + reactDomPackage + SimpleReactApp)
	})

	app.get(REACT_RUM_BUNDLE_PATH, (_, res) => {
		res.set({
			'Content-Type': 'text/javascript',
		})
		res.send(reactPackage + reactDomPackage + SimpleReactApp + splunkRumPackage)
	})
}

function generateReactBundleTags() {
	return `
    <div id="root"></div>
    <script src="${REACT_BUNDLE_PATH}"></script>
  `
}

function generateReactRumBundleTags() {
	return `
    <div id="root"></div>
    <script src="${REACT_RUM_BUNDLE_PATH}"></script>
  `
}

module.exports = {
	handleReactBundleRequest,
	generateReactBundleTags,
	generateReactRumBundleTags,
}
