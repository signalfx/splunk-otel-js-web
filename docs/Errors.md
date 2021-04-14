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

Each failure to load resources is registered as a span with name: `eventListener.error`. Failing to load resources can happen when server returning is 4xx/5xx status code when loading images or scripts.

**Example - missing image:**

```html
<!DOCTYPE html>
<html>
<head>
   [...]
</head>
<body>
   <img src="/missing-image.png" />
</body>
</html>
```

For this example, the error caught would be exposed as following:

|Attribute name|Attribute value|
|---|---|
|`component`|`"error"`|
|`error`|`true`|
|`target_element`|`"IMG"`|
|`target_src`|`"https://example.com/missing-image.png"`|
|`target_xpath`|`""//html/body/img""`|

## console.error

Each error logged via console is registered as a span with name: `console.error`. `console.error` is a standard way in browsers to show messages in the developer console. Splunk Browser Agent captures errors logged via `console.error` from  `try...catch` blocks where you either don't want or can’t throw errors further in the stack.


**Example 1:**

```html
try {
  someNull.anyField = 'value';
} catch(e) {
  console.error('failed to update', e);
}
```

For this example, the error caught would be exposed as following:

|Attribute name|Attribute value|
|---|---|
|`component`|`"error"`|
|`error`|`true`|
|`error.message`|`"failed to update TypeError: Cannot set property 'anyField' of null"`|
|`error.object`|`"String"`|
|`error.stack`|<pre>"TypeError: Cannot set property 'anyField' of null<br>   at http://example.com/script.js:3:19"</pre>|

**Example 2:**

```html
axios.get('/users').then(users => {
  showUsers(users)
}).catch(error => {
  showErrorMessage()
  console.error('error getting users', error)
})
```

For this example, the error caught would be exposed as following:

|Attribute name|Attribute value|
|---|---|
|`component`|`"error"`|
|`error`|`true`|
|`error.message`|`"error getting users Error: Request failed with status code 404"`|
|`error.object`|`"String"`|
|`error.stack`|<pre>"Error: Request failed with status code 404<br>  [...]<br>   at XMLHttpRequest.l.onreadystatechange (axios.min.js:2:8373)"</pre>|

**Example 3:**

```html
async function getUsers() {
  try {
    const users = await axios.get('/users')
  } catch (error) {
    console.error('error getting users', error)
  }
}
```

For this example, the error caught would be exposed as following:

|Attribute name|Attribute value|
|---|---|
|`component`|`"error"`|
|`error`|`true`|
|`error.message`|`"error getting users Error: Request failed with status code 404"`|
|`error.object`|`"String"`|
|`error.stack`|<pre>"Error: Request failed with status code 404<br>  [...]<br>   at XMLHttpRequest.l.onreadystatechange (axios.min.js:2:8373)"</pre>|

## SplunkRum.error

Each error logged via invoking `SplunkRum.error` is registered as a span with name: `SplunkRum.error`.

As opposed to the `console.error`, using `SplunkRum.error` doesn't log an error in browser's developer console. Instead such errors are only sent along with other RUM telemetry and exposed in the Splunk RUM product. This approach is useful when using a CDN distribution of Splunk Browser Agent. In such a situation, extra verification for Splunk Browser Agent loading is needed in order to avoid crashes when it's loading was blocked. This can happen in situations when a user has installed an aggressive privacy plugin/extension to their browser.

Example:

```html
axios.get('/users').then(users => {
  showUsers(users)
}).catch(error => {
  showErrorMessage()
  if (window.SplunkRum) {
    SplunkRum.error('error getting users', error)
  }
})
```

Error caught in this example would expose similar attributes to the last example in [console.error](#consoleerror) section.

## Integrating with frameworks

Integration with different SPA frameworks is required to allow capturing and sending the JS errors from SPA frameworks with their own error interceptors/handlers which catch and process JS errors. As a result, the errors will not bubble up to the global error handler (and/or logs), meaning the Splunk RUM Agentwould not be able to expose such errors.

Following framework-specific examples help you to understand how to integrate with the particular framework. All the examples are made considering the agent distributed via npm. While we don't recommend using the API with CDN distributions, you should add `if (window.SplunkRum)` checks around `SplunkRum` API calls to not break the site when the agent fails to load due to reasons like content blockers.

### React.js

Use the Splunk RUM Agent API in your [error boundary](https://reactjs.org/docs/error-boundaries.html) component to capture error information.

```html
import React from 'react'
import SplunkRum from '@splunk/otel-js-browser'
 
class ErrorBoundary extends React.Component {
	componentDidCatch(error, errorInfo) {
		SplunkRum.error(error, errorInfo)
	}
 
	// Rest of your error boundary component
	render() {
		return this.props.children
	}
}
```

### Vue.js

Add capture function to your Vue `errorHandler`. Implementation of this is different, depending on the Vue.js version used:

For [Vue.js 3.x](https://v3.vuejs.org/api/application-config.html#errorhandler):

```html
import Vue from 'vue'
import SplunkRum from '@splunk/otel-js-browser'
 
const app = createApp(App);
 
app.config.errorHandler = function (error, vm, info) {
	SplunkRum.error(error, info)
}
app.mount('#app')
```

For [Vue.js 2.x](https://vuejs.org/v2/api/#errorHandler):

```html
import Vue from 'vue'
import SplunkRum from '@splunk/otel-js-browser'
 
Vue.config.errorHandler = function (error, vm, info) {
	SplunkRum.error(error, info)
}
```

### Angular.js 2.x

For Angular.js v2.x, you need  to create an [error handler module](https://angular.io/api/core/ErrorHandler) to collect errors consumed by Angular:

```html
import {NgModule, ErrorHandler} from '@angular/core'
import SplunkRum from '@splunk/otel-js-browser'
 
class SplunkErrorHandler implements ErrorHandler {
	handleError(error) {
		SplunkRum.error(error, info)
}
}
 
@NgModule({
	providers: [
		{
			provide: ErrorHandler,
			useClass: SplunkErrorHandler
		}
	]
})
class AppModule {}
```

### Angular.js 1.x

For Angular.js v1.x, you need to create an [exceptionHandler](https://docs.angularjs.org/api/ng/service/$exceptionHandler):

```html
import SplunkRum from '@splunk/otel-js-browser'

angular.module('...')
	.factory('$exceptionHandler', function () {
		return function (exception, cause) {
			SplunkRum.error(exception, cause)
		}
	})
```

### Ember.js

For Ember, you need to configure an `Ember.onerror` hook:

```html
import Ember from 'ember'
import SplunkRum from '@splunk/otel-js-browser'


Ember.onerror = function(error) {
	SplunkRum.error(error)
}
```
