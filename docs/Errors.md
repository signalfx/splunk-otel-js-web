# Collecting errors

Errors are collected by the Splunk RUM Agent as spans with zero duration. The errors are timestamped, based on the moment the error occurred.

By default, the instrumentations capture errors from the following sources:

- Uncaught/unhandled errors (from the `error` event listener on `window`)
- Unhandled promise rejections (`unhandledrejection` event listener on `window`)
- Error events from failing to load resources (`error` event listener on `document`)
- `console.error` capturing errors logged to the console. 
- `SplunkRum.error` capturing errors which you cannot (re)throw or log but still wish to capture and send via the telemetry monitored by Splunk RUM Agent.

## Uncaught/Unhandled errors

Each uncaught/unhandled error is registered as a span with name: `onerror`. Uncaught/unhandled errors can occur in following situaitions:

- Errors that aren’t caught by `try {}` and `catch {}` block or rethrown in a `catch` block without re-catching.
- Syntax errors in files.

Following examples help to understand the error collection from uncaught/unhandled errors:

**Syntax error example**
```html
var abc=;
```

For this example, the error caught would be exposed as following:

|Attribute name|Attribute value|
|---|---|
|`component`|`"error"`|
|`error`|`true`|
|`error.message` (browser-specific)|`"Unexpected token ';'"`|
|`error.object`|`"SyntaxError"`|
|`error.stack` (browser-specific)|`"SyntaxError: Unexpected token ';'"`|

**`null` reference example**

```html
var test = null;
test.prop1 = true;
```

For this example, the error caught would be exposed as following:

|Attribute name|Attribute value|
|---|---|
|`component`|`"error"`|
|`error`|`true`|
|`error.message` (browser-specific)|`"Cannot set property 'prop1' of null"`|
|`error.object`|`"TypeError"`|
|`error.stack` (browser-specific)|<pre>"TypeError: Cannot set property 'prop1' of null<br>   at http://example.com/script.js:2:10"</pre>|

## Uncaught promise rejections

Each uncaught promise rejection is registered as a span with name: `unhandledrejection`. Uncaught promise rejections can happen in following situations:

- Promise chain without a final `.catch`
- Error in promise chain (including rethrowing in `catch`) without any subsequent `catch` block.
- `throw` in an `async` function

**Example 1:**

```html
new Promise((resolve, reject) => {
  reject(new Error('broken'))
})
```

For this example, the error caught would be exposed as following:

|Attribute name|Attribute value|
|---|---|
|`component`|`"error"`|
|`error`|`true`|
|`error.message`|`"broken"`|
|`error.object`|`"Error"`|
|`error.stack`|<pre>"Error: broken<br>   at http://example.com/script.js:2:10"</pre>|

**Example 2:**

```html
new Promise((resolve, reject) => {
  resolve(null)
}).then((val) => {
  val.prop = 1
})
```

For this example, the error caught would be exposed as following:

|Attribute name|Attribute value|
|---|---|
|`component`|`"error"`|
|`error`|`true`|
|`error.message` (browser-specific)|`"Cannot set property 'prop' of null"`|
|`error.object`|`"TypeError"`|
|`error.stack` (browser-specific)|<pre>"TypeError: Cannot set property 'prop' of null<br>   at http://example.com/script.js:4:10"</pre>|

## Failing to load resources

## console.error

## SplunkRum.error

## Integrating with frameworks

### React.js

### Vue.js

### Angular.js 2.x

### Angular.js 1.x

### Ember.js
