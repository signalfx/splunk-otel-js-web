/*
Copyright 2025 Splunk Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { computeSourceMapIdFromFile, getSourceMapUploadUrl, JS_FILE_REGEX, PLUGIN_NAME } from '../utils';
import { join } from 'path';
import { uploadFile } from '../httpUtils';
import { AxiosError } from 'axios';
import type { Compiler } from 'webpack';
import { OllyWebPluginOptions } from '../index';

/**
 * The part of the webpack plugin responsible for uploading source maps from the output directory.
 */
export function applySourceMapsUpload(compiler: Compiler, options: OllyWebPluginOptions): void {
  const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);

  compiler.hooks.afterEmit.tapAsync(
    PLUGIN_NAME,
    async (compilation, callback) => {
      /*
       * find JS assets' related source map assets, and collect them to an array
       */
      const sourceMaps = [];
      compilation.assetsInfo.forEach(((assetInfo, asset) => {
        if (asset.match(JS_FILE_REGEX) && typeof assetInfo?.related?.sourceMap === 'string') {
          sourceMaps.push(assetInfo.related.sourceMap);
        }
      }));

      if (sourceMaps.length > 0) {
        logger.info('Uploading %d source maps to %s', sourceMaps.length, getSourceMapUploadUrl(options.sourceMaps.realm, '{id}'));
      } else {
        logger.warn('No source maps found.');
        logger.warn('Make sure that source maps are enabled to utilize the %s plugin.', PLUGIN_NAME);
      }

      const uploadResults = {
        success: 0,
        failed: 0,
      };
      const parameters = Object.fromEntries([
        ['appName', options.sourceMaps.applicationName],
        ['appVersion', options.sourceMaps.version],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ].filter(([_, value]) => typeof value !== 'undefined'));

      /*
       * resolve the source map assets to a file system path, then upload the files
       */
      for (const sourceMap of sourceMaps) {
        const sourceMapPath = join(compiler.outputPath, sourceMap);
        const sourceMapId = await computeSourceMapIdFromFile(sourceMapPath);
        const url = getSourceMapUploadUrl(options.sourceMaps.realm, sourceMapId);

        logger.log('Uploading %s', sourceMap);
        logger.debug('PUT', url);
        try {
          logger.status(new Array(uploadResults.success).fill('.').join(''));
          await uploadFile({
            file: {
              filePath: sourceMapPath,
              fieldName: 'file',
            },
            url,
            parameters
          });
          uploadResults.success++;
        } catch (e) {
          uploadResults.failed++;
          const ae = e as AxiosError;

          const unableToUploadMessage = `Unable to upload ${sourceMapPath}`;
          if (ae.response && ae.response.status === 413) {
            logger.warn(ae.response.status, ae.response.statusText);
            logger.warn(unableToUploadMessage);
          } else if (ae.response) {
            logger.error(ae.response.status, ae.response.statusText);
            logger.error(ae.response.data);
            logger.error(unableToUploadMessage);
          } else if (ae.request) {
            logger.error(`Response from ${url} was not received`);
            logger.error(ae.cause);
            logger.error(unableToUploadMessage);
          } else {
            logger.error(`Request to ${url} could not be sent`);
            logger.error(e);
            logger.error(unableToUploadMessage);
          }
        }
      }

      if (uploadResults.success > 0) {
        logger.info('Successfully uploaded %d source map(s)', uploadResults.success);
      }
      if (uploadResults.failed > 0) {
        logger.error('Failed to upload %d source map(s)', uploadResults.failed);
      }

      logger.status('Uploading finished\n');
      callback();
    }
  );
}
