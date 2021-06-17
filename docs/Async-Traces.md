# Asyncronous traces

Usually traces that happen asyncronously (for example user interactions that result in a promise chain) get disconnected from parent activity. Splunk RUM Agent includes a custom context manager that connects parent traces with traces that happen in:

* setTimeout (with less than 34ms timeout)
* setImmediate
* requestAnimationFrame
* Promise.then / catch / finally
* MutationObserver on textNode
* MessagePort

These also cover most common methods frameworks use to delay re-renderers when values change, allowing requests done when a component is first rendered to be linked with user interaction that caused the component to be added to the page.

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

## Known incompatibilities

Due to technical limitations async/await functions aren't supported. Transpiling them with babel (without any sort of "modern mode" option) will allow them to be connected.

```js
document.getElementById('save-button').addEventListener('click', async () => {
  const saveRes = await fetch('/api/items', {method: 'POST'});

  const listRes = await fetch('/api/items'); // Can be disconnected from click event when not transpiled
});
```
