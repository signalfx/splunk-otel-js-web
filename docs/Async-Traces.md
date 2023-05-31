> The official Splunk documentation for this page is [Configure the Splunk Browser RUM instrumentation](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.configuration&version=current). For instructions on how to contribute to the docs, see [CONTRIBUTING.md](../CONTRIBUTING.md#documentation).

# Asyncronous traces

Usually traces that happen asyncronously (for example user interactions that result in a promise chain) get disconnected from parent activity. Splunk RUM Agent includes a custom context manager that connects parent traces with traces that happen in:

* setTimeout (with less than 34ms timeout)
* setImmediate
* requestAnimationFrame
* Promise.then / catch / finally
* MutationObserver on textNode
* MessagePort
* Hash-based routers

These also cover most common methods frameworks use to delay re-renderers when values change, allowing requests done when a component is first rendered to be linked with the user interaction that caused the component to be added to the page.

Additionally XMLHttpRequest events and fetch (via promise methods) are patched to keep parent context so subsequent requests get linked to parent.

```js
document.getElementById('save-button').addEventListener('click', function () {
  var saveReq = new XMLHttpRequest();
  saveReq.open('POST', '/api/items');
  saveReq.send(/* ... */);
  saveReq.addEventListener('load', function () {
    var listReq = new XMLHttpRequest();
    listReq.open('GET', '/api/items');
    listReq.send(); // Gets parent of click span
  });
});
```

## Enabling

As we're currently still testing it you can opt in to using it by setting `context.async` to `true` in your agent configuration.

```js
SplunkRum.init({
  beaconEndpoint: 'https://rum-ingest.us0.signalfx.com/v1/rum',
  rumAccessToken: 'ABC123...789',
  applicationName: 'my-awesome-app',
  context: {
    async: true,
  },
});
```

## Known incompatibilities

Due to technical limitations async/await functions aren't supported. Transpiling them with babel (without any sort of "modern mode" option) will allow them to be connected.

```js
document.getElementById('save-button').addEventListener('click', async () => {
  const saveRes = await fetch('/api/items', {method: 'POST'});

  const listRes = await fetch('/api/items'); // Can be disconnected from click event when not transpiled
});
```

There are also limitations when using code splitting: only code loaded by promise-based implementations gets linked to the parent interaction. For an example, see [webpack's ìmport() syntax`](https://webpack.js.org/guides/code-splitting/#dynamic-imports).

```js
// src/secret-page.js

// This would not be linked
const importantData = fetch('/api/secrets');

export function renderPage() {
  // This would be linked to click if called like shown next
  const neededData = fetch('/api/needed');
}

// src/index.js
document.getElementById('secret-page').addEventListener('click', () => {
  import('./secret-page.js').then(({renderPage}) => renderPage());
});
```
