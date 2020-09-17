## Installing into your app
You'll need to either build the final splunk-rum.js file or obtain it from a release.
To build from scratch, please see the notes in CONTRIBUTING.md.

Place it in your page as
```html
<script src="http://something-not-yet-known.domain/path/tosplunk-rum.js"></script>
<script>
  window.SplunkRum && window.SplunkRum.init(
    {
      // Splunk will tell you what value to use here
      beaconUrl: 'http://127.0.0.1:9080/api/v2/spans',
      // You can generate or get your rumAuth token at FIXME link/docs when implemented
      rumAuth: 'ABC123...789',
      app: 'my-awesome-app'
    });
</script>
```

## `SplunkRum.init({ })` options
| Option | Type | Notes | Required? | Default |
|--------|------|-------|-----------|---------|
| beaconUrl | string | Destination for the captured data | Yes | (No default) |
| rumAuth | string | Publicly-visible `rumAuth` value.  Find or generate one in your FIXME (doc/link needed). | Temporarily no, until ingest/validation is set up | (No default) |
| app | string | Application name | No | 'unknown-browser-app' |
| globalAttributes | object | Extra attributes to add to each reported span.  See also `setGlobalAttributes` | No | {} |
| captureErrors | boolean | Turns on/off error reporting feature | No | true |
| debug | boolean | Turns on/off internal debug logging | No | false |

## SplunkRum.setGlobalAttributes(attributes)
You can (re)set the entirety of `globalAttributes` at any time with this method.  Any spans reported from
this point on will have your new attributes set.  You can pass `{}` or `undefined` to clear your global attributes.

## Errors

By default, we capture from the following sources of errors:

- `addEventListener('error')` which reports unhandled errors (e.g., from setInterval callbacks)
- `addEventListener('unhandledrejection')` which reports unhandled Promise rejections
- instrumenting usage of `console.error`
- `document.documentElement.addEventListener('error', ... {capture:true});` which reports errors on DOM elements (e.g., image loading issue)

If you would like to report an error manually, you can use:
```
  window.SplunkRum && window.SplunkRum.error(errorObjectOrMessageString);
```

