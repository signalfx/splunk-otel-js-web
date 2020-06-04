Very hacky placeholder showing how to integrate all the otel web pieces into one js file.

First, edit the export url in src/sfx-rum.js to whatever you need for your beacon.  Yes, an init() API will be added eventually.

Build as so:

```
$ npm install
$ npm test (optional)
$ npx webpack
```

Then use dist/sfx-rum.js as your single minified js file.  Place it in your page as

```
<script src="whatever/sfx-rum.js"></script>
<script>
  window.SfxRum && window.SfxRum.init(
    { beaconUrl: 'http://127.0.0.1:9080/api/v2/spans' });
</script>
```
