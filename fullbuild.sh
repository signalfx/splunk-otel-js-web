#!/bin/bash
set -e

npm run lint
npm test
npx webpack --config webpack.dev.js
npx webpack
echo ""
echo "------- Excelsior! -------"
