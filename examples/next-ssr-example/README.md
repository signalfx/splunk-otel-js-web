# Next.js SSR Sample App

This is a [Next.js](https://nextjs.org/) project bootstrapped using [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Instrumenting with Splunk RUM using NPM installation method

Next.js uses [static generation](https://nextjs.org/docs/basic-features/pages#pre-rendering) by default to generate the output HTML for most pages. As static generation is done using the node.js runtime, it isn't compatible with RUM. Check that RUM is only imported and activated in the browser environment.

1. Install Splunk RUM for Browser: `npm install @splunk/otel-web --save`
2. Create file `src/instrument.js` that imports `@splunk/otel-web` and calls `SplunkOtelWeb.init()`. You can use the Data Setup guided setup in Splunk Observability to get the correct values for your organization.
3. (Optional) Set the values in environment variables that are replaced at build time with values in the `.env` file. This lets you set [different values for different environments](https://nextjs.org/docs/basic-features/environment-variables). See [`src/instrument.js`](src/instrument.js) and [`.env.example`](.env.example) files as an example.
4. Create or edit `next.config.js` to prepend `src/instrument.js` to webpack's `main` entryfile. See [`next.config.js`](`next.config.js`) in this folder as an example.

## Adding Splunk APM

Follow installation instructions for [`@splunk/otel` & any instrumentations you want](https://github.com/signalfx/splunk-otel-js). As Next.js command doesn't support the `-r` flag, edit the start command so that node calls the Next.js binary, like in the following example:

```bash
node -r @splunk/otel/instrument ./node_modules/.bin/next start
```

See the `start:apm` script in the [package.json](package.json) file as an example.

Due to order in which packages are loaded, variables in the `.env` file aren't set before APM is loaded: You must set configuration and environment variables separately.

For example, to run the demo without the OTel Collector, you would export settings as in the following example:

```bash
export OTEL_TRACES_EXPORTER=jaeger-thrift-splunk
export OTEL_EXPORTER_JAEGER_ENDPOINT=https://ingest.us0.signalfx.com/v2/trace
export SPLUNK_ACCESS_TOKEN=your-access-token-here
npm run start:apm
```

## Running this sample app

1. Run `npm install` in this directory.
2. Copy `.env.example` to `.env` and replace the values inside `.env`.
3. Run `npm run dev` to see it running in dev mode.
4. Run `npm run build` to compile and `npm run start` to serve the built application.
5. To test APM usage, run `npm run start:apm`.
