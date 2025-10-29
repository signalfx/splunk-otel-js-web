# Electron with Splunk RUM and Session Replay

This example shows how to add Splunk Real User Monitoring and Session Replay to an Electron desktop application.

## Quick Start

1. Copy the example file:

    ```bash
    cp .env.example .env
    ```

2. Edit `.env` with your [Splunk credentials](https://app.signalfx.com/#/organization/current?selectedKeyValue=sf_section:accesstokens):

    ```bash
    SPLUNK_RUM_REALM=us0
    SPLUNK_RUM_ACCESS_TOKEN=your_token_here
    SPLUNK_RUM_ENVIRONMENT=production
    SPLUNK_RUM_DEBUG=false
    ```

3. Start the app: `pnpm start`

### Environment Variables

| Variable                      | Required      | Default                        | Description                                      |
| ----------------------------- | ------------- | ------------------------------ | ------------------------------------------------ |
| `SPLUNK_RUM_REALM`            | ✅ Production | -                              | Splunk RUM realm (e.g., `us0`, `us1`, `eu0`)     |
| `SPLUNK_RUM_ACCESS_TOKEN`     | ✅ Production | -                              | RUM access token from Splunk Observability Cloud |
| `SPLUNK_RUM_APPLICATION_NAME` | ❌            | `splunk-otel-electron-example` | Name of your application                         |
| `SPLUNK_RUM_ENVIRONMENT`      | ❌            | `development`                  | Environment name (e.g., `production`, `staging`) |
| `SPLUNK_RUM_DEBUG`            | ❌            | `true`                         | Enable debug logging                             |

## How It Works

Electron has two processes:

- **Main Process** (`src/index.ts`): Node.js environment - NOT instrumented
- **Renderer Process** (`src/renderer.ts`): Browser environment - **instrumented with RUM**

RUM is initialized in `src/renderer.ts` → imports `src/instrumentation.ts` → captures web activity.

### Important: Renderer Process Only

The Splunk Browser SDK **only supports monitoring the renderer processes** of an Electron application. It does not initialize or monitor anything installed on the main process. For more information, see [Electron's documentation on renderer processes](https://www.electronjs.org/docs/latest/tutorial/process-model#the-renderer-process).

> **Note**: To instrument the main process (Node.js environment), refer to the [Node.js APM instrumentation guide](https://help.splunk.com/en/splunk-observability-cloud/manage-data/available-data-sources/supported-integrations-in-splunk-observability-cloud/apm-instrumentation/instrument-a-node.js-application).

### Local Storage Persistence

**Critical Configuration:** When building Electron apps that use local files (`file://` protocol), you **must** set `persistence: 'localStorage'` in the RUM initialization:

```typescript
SplunkOtelWeb.init({
	// ... other config
	persistence: 'localStorage', // Required for file:// protocol
})
```

**Why this matters:**

- **Local files (`file://`)**: Cookies are not available, so session data must be stored in `localStorage`
- **Remote files (`https://`)**: This parameter is optional, as cookies work normally

This is already configured in `src/instrumentation.ts`.

### CSP Configuration

The main process configures Content Security Policy (CSP) headers via `session.webRequest.onHeadersReceived` to allow connections to Splunk RUM endpoints. This ensures the renderer process can:

- Load scripts from Splunk CDN (`https://cdn.signalfx.com`)
- Send telemetry data to Splunk ingest endpoints (`https://rum-ingest.${realm}.signalfx.com`)

The CSP configuration automatically uses the `SPLUNK_RUM_REALM` environment variable to set the correct ingest endpoints.

For more information on securing Electron applications, see the [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security).

## Further Reading

- [Electron](https://www.electronjs.org/)
- [Splunk RUM for Browser Documentation](https://help.splunk.com/en/splunk-observability-cloud/monitor-end-user-experience/real-user-monitoring/introduction-to-splunk-rum)
- [Session Replay Documentation](https://help.splunk.com/en/splunk-observability-cloud/monitor-end-user-experience/real-user-monitoring/replay-user-sessions)
