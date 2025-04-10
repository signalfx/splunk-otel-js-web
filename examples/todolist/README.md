# Example todo application with a node.js backend

This example todo application consists of React frontend app and express backend app.

## Try it yourself!

After downloading this folder:

1. If you don't have one already [make a trial account to try out Splunk Observability Cloud](https://www.splunk.com/en_us/observability/o11y-cloud-free-trial.html)
2. Run `npm install`
3. Copy `.env.example` to `.env`
4. Fill out `PUBLIC_REACT_APP_RUM_*` with your ingest URL and RUM token
5. Start backend with `npm run backend`
6. Start frontend with `npm run start`

Frontend instrumentation is done in `public/index.html` which is loaded at document load. It also demonstrates a few configuration options you can use.
