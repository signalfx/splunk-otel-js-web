## Building
Build as so:

```
$ npm install
$ npm run lint (optional)
$ npm test (optional)
$ npx webpack
```

## Installing into your app
Then use dist/splunk-rum.js as your single minified js file.  Place it in your page as

```
<script src="whatever/splunk-rum.js"></script>
<script>
  window.SplunkRum && window.SplunkRum.init(
    {
      beaconUrl: 'http://127.0.0.1:9080/api/v2/spans',
      app: 'my-awesome-app
    });
</script>
```

(app is optional and defaults to 'unknown-browser-app')

## Errors

By default we capture from the following sources of errors:

- `addEventListener('error')` which reports unhandled errors (e.g., from setInterval callbacks)
- `addEventListener('unhandledrejection')` which reports unhandled Promise rejections
- instrumenting usage of `console.error`

If you would like to report an error manually, you can use:
```
  window.SplunkRum && window.SplunkRum.error(errorObjectOrMessageString);
```
