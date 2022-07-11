Generally when using the API npm installation or try...catch blocks are encouraged to not break your app in case RUM library isn't loaded for some reason.

# setGlobalAttributes

```ts
SplunkRum.setGlobalAttributes(attributes?: Attributes): void;
```

Update attributes that will be set on every new span. For example this can be used to [update user information on logging in](./IdentifyingUsers.md#providing-it-after-initialisation-using-api)

* `attributes`: [Attributes](https://open-telemetry.github.io/opentelemetry-js-api/interfaces/attributes.html) - Object of attributes that will be set on every span. If undefined, all currently set global attributes will be deleted and no longer added to any new spans.

Returns nothing

## Example:

```js
SplunkRum.setGlobalAttributes({
  'enduser.id': 'Test User',
});
// All new spans now include enduser.id

SplunkRum.setGlobalAttributes({
  'dark_mode.enabled': darkModeToggle.status,
});
// All new spans now include enduser.id and dark_mode.enabled

SplunkRum.setGlobalAttributes()
// New spans no longer include those attributes
```

# getGlobalAttributes

```ts
SplunkRum.getGlobalAttributes(): Attributes;
```

Get current set global attributes

No parameters

Returns [Attributes](https://open-telemetry.github.io/opentelemetry-js-api/interfaces/attributes.html) object with attributes that are set on all new spans

## Example:

```js
SplunkRum.setGlobalAttributes({
  'enduser.id': 'Test User',
});
SplunkRum.setGlobalAttributes({
  'dark_mode.enabled': darkModeToggle.status,
});

const attrs = SplunkRum.getGlobalAttributes();
/* console.log(attrs)
{
  'enduser.id': 'Test User',
  'dark_mode.enabled': true
}
*/
```

# getSessionId

```ts
SplunkRum.getSessionId(): string;
```

Get current session ID

No parameters

Returns string

## Example:

```js
LiveChat.onChatStarted(() => {
  LiveChat.setMetadata('splunk.sessionId', SplunkRum.getSessionId());
});
```

# Events

Event listeners can be registered with `addEventListener` and removed with `removeEventListener`. Event listeners receive an object `{ payload: { /* Depending on event */ }}` as the first parameter

```ts
SplunkRum.addEventListener(type: string, listener: Function): void
SplunkRum.removeEventListener(type: string, listener: Function): void
```

Events:

* `'session-changed'` - Emitted when session ID changes
  * Payload:
    * `sessionId`: string - New session ID
* `'global-attributes-changed'` - Emitted when setGlobalAttributes is called
  * Payload:
    * `attributes`: [Attributes](https://open-telemetry.github.io/opentelemetry-js-api/interfaces/attributes.html) - New global attributes

Example:

```js
SplunkRum.addEventListener('session-changed', (event) => {
  LiveChat.setMetadata('splunk.sessionId', event.payload.sessionId);
});
```
