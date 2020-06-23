Hacky placeholder showing how to integrate all the otel web pieces into one js file.

Build as so:

```
$ npm install
$ npm run lint (optional)
$ npm test (optional)
$ npx webpack
```

Then use dist/sfx-rum.js as your single minified js file.  Place it in your page as

```
<script src="whatever/sfx-rum.js"></script>
<script>
  window.SfxRum && window.SfxRum.init(
    {
      beaconUrl: 'http://127.0.0.1:9080/api/v2/spans',
      app: 'my-awesome-app
    });
</script>
```

(app is optional and defaults to 'unknown-browser-app')
