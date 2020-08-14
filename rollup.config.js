import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
const path = require('path');
import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';
const fs = require('fs');

export function nodeToBrowser() {
  return {
    name: 'node-to-browser resolver',
    resolveId(source) {
      console.log('resolve '+source);
      if (source === './node') {
        //return './browser';
      }
      return null;
    },
    load( id ) {
      console.log('load '+id);
      if (id.includes('platform/node')) {
        const b = id.replace('platform/node', 'platform/browser');
        console.log('   -> ' + b);
        return fs.readFileSync(b, 'utf8');
      }
      return null;
    }
  };
}

const customResolver = resolve({
  extensions: ['.js']
});

export default {
  input: 'src/main.js',
  output: {
    file: 'dist/splunk-rum.js',
    format: 'iife'
  },
  plugins: [
    json(),
    nodeToBrowser(),
    alias({
      entries: [
        { find: '@opentelemetry/api', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-api/src/index.ts') },
        { find: '@opentelemetry/web', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-web/src/index.ts') },
        { find: '@opentelemetry/core', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-core/src/index.ts') },
        { find: '@opentelemetry/resources', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-resources/src/index.ts') },
        { find: '@opentelemetry/semantic-conventions', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-semantic-conventions/src/index.ts') },
        { find: '@opentelemetry/tracing', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-tracing/src/index.ts') },
        { find: '@opentelemetry/context-base', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-context-base/src/index.ts') },
        { find: '@opentelemetry/plugin-xml-http-request', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-plugin-xml-http-request/src/index.ts') },
        { find: '@opentelemetry/plugin-fetch', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-plugin-fetch/src/index.ts') },
        { find: '@opentelemetry/plugin-document-load', replacement: path.resolve(__dirname, 'deps/opentelemetry-js-contrib/plugins/web/opentelemetry-plugin-document-load/src/index.ts') },
        { find: '@opentelemetry/plugin-user-interaction', replacement: path.resolve(__dirname, 'deps/opentelemetry-js-contrib/plugins/web/opentelemetry-plugin-user-interaction/src/index.ts') },
      ],
      customResolver
    }),
    typescript({
      typescript: require('typescript'),
      useTsConfigDeclarationDir: true,
      clean: true,
      check: false,
    }),   
    resolve({
      browser: true,
    }),
    commonjs({
      include: /node_modules/,
    }),
    terser({
      output: { comments: false, },
    }),
  ],
};
