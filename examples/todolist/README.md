# Example todo application with a node.js backend

This example todo application consists of react frontend app and express backend app.

## Try it yourself!

After downloading this folder:

1. Run `npm install`
2. Copy `.env.example` to `.env`
3. Fill out `REACT_APP_RUM_*` with your ingest URL and RUM token
4. Start backend with `npm run backend`
5. Start frontend with `npm run start`

Frontend instrumentation is done in `src/instrumentation.js` which is loaded as the first thing in `src/index.js`. It also demonstrates a few configuration options you can use.
