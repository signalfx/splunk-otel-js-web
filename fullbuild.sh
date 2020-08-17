#!/bin/bash
set -e
rm -f dist/*
npm run lint
npm test
npx rollup -c
DEBUG_BUILD=1 npx rollup -c
echo ""
echo "------- Excelsior! -------"
