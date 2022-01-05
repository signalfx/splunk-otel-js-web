> The official Splunk documentation for this page is [Manually instrument browser-based web applications](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.manual.instrumentation&version=current). For instructions on how to contribute to the docs, see [CONTRIBUTING.md](../CONTRIBUTING#documentation.md).

# Personally Identifiable Information

In certain situations, metadata collected by our instrumentation may include Personally Identifiable Information (PII). We'd advise that you pay attention to the following cases:

- any network operation, where PII might be present in the URL (e.g. an authentication token in query parameters). Notice that the auto-instrumentations do not capture or report any data from the payload of the request (i.e. the POST body), apart from its size
- any user interaction (e.g. a click), where a target element might contain PII of information in the ID of the dom element interacted.

To redact PII you can pass a sanitizer as `exporter.onAttributesSerializing` config option when initializing

```html
SplunkRum.init({
  // ...
  exporter: {
    onAttributesSerializing: (attributes) => ({
      ...attributes,
      'http.url': /secret\=/.test(attributes['http.url']) ? '[redacted]' : attributes['http.url'],
    }),
  },
});
```

If needed the entire Span is available as an optional second argument of the sanitizer.
