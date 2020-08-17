#!/bin/bash
set -e
rm -f dist/*
npm run lint
npm test
npx rollup -c
echo ""
echo "------- Excelsior! -------"
