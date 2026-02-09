# Webpack RUM Build Plugin Example

This example builds the same TypeScript entrypoint with two webpack configs:

- `webpack.config.cjs` (CommonJS config file)
- `webpack.config.mjs` (ES module config file)

## Environment

1. Copy `.env.example` to `.env`.
2. Set values in `.env`:

- `SPLUNK_UPLOAD_SOURCE_MAPS=false` keeps upload disabled.
- `SPLUNK_UPLOAD_SOURCE_MAPS=true` enables upload.
- `SPLUNK_REALM` and `SPLUNK_SOURCE_MAPS_TOKEN` are required when upload is enabled.

## Commands

- `pnpm run build`: Runs both `build:cjs` and `build:esm`.

- `pnpm run build:cjs`: Builds with `webpack.config.cjs` into `dist/cjs-config`.

- `pnpm run build:esm`: Builds with `webpack.config.mjs` into `dist/mjs-config`.

- `pnpm run clean`: Removes `dist` and `.turbo`.
