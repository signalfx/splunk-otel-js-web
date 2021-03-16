/*
Copyright 2021 Splunk Inc.

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

import { join, dirname } from 'path';
import crypto from 'crypto';
import fs from 'fs';

import { default as dotenv } from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import fetch from 'node-fetch';
import { request } from '@octokit/request';

const OWNER = 'signalfx';
const REPO = 'splunk-otel-js-browser';
const PRERELEASE_KEYWORDS = ['alpha', 'beta', 'rc'];

const isDryRun = process.argv.some(arg => arg === '--dry-run');
if (isDryRun) {
  console.log('---- DRY RUN ----');
}

const ourDirectory = dirname(process.argv[1]);
const packageConfig = JSON.parse(fs.readFileSync(join(ourDirectory, '..', 'package.json')).toString());
dotenv.config();

if (!process.env.CDN_DISTRIBUTION_ID) {
  throw new Error('You are missing an environment variable CDN_DISTRIBUTION_ID.');
}
const { CDN_DISTRIBUTION_ID } = process.env;

if (!process.env.CDN_BUCKET_NAME) {
  throw new Error('You are missing an environment variable CDN_BUCKET_NAME.');
}
const { CDN_BUCKET_NAME } = process.env;

const requestWithAuth = request.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
});

const { data: releases, status } = await requestWithAuth(`GET /repos/${OWNER}/${REPO}/releases`);
if (status >= 400) {
  throw new Error('There was an error while trying to fetch the list of releases.');
}

const latestRelease = releases[0];
if (!latestRelease) {
  throw new Error('Latest release not found.');
}
console.log(`I have found the latest version to be: ${latestRelease.tag_name} named "${latestRelease.name}."`);

const { data: assets } = await requestWithAuth(`GET /repos/${OWNER}/${REPO}/releases/${latestRelease.id}/assets`);
console.log(`This release has ${assets.length} release artifacts: ${assets.map(({name}) => name).join(', ')}.`);

const versions = Array.from(generateAllVersions());
console.log(`This release will update following versions in CDN: ${versions.map(([version]) => version).join(', ')}`);

console.log(`I will now process the files:`);
const s3Client = new S3Client({region: 'us-east-1'});
const cfClient = new CloudFrontClient({region: 'us-east-1'});
const cdnLinks = ['\n## CDN'];
for (const asset of assets) {
  console.log(`\t- ${asset.name}`);
  console.log(`\t\t- fetching from ${asset.browser_download_url}.`);
  
  const response = await fetch(asset.browser_download_url);
  const assetBuffer = await response.buffer();
  console.log(`\t\t- fetched`);

  const sha384Sum = crypto.createHash('sha384').update(assetBuffer, 'utf-8').digest('base64');
  const integrityValue = `sha384-${sha384Sum}`;
  console.log(`\t\t- calculated integrity ${integrityValue}`);

  for (const [version, isAutoUpdating] of versions) {
    console.log(`\t\t\t- version: ${version}`);

    const key = `o11y-gdi-rum/${version}/${asset.name}`;
    console.log(`\t\t\t\t- key: ${key}`);

    const publicUrl = `https://cdn.signalfx.com/${key}`;
    if (!isDryRun) {
      await uploadToS3(key, assetBuffer, { contentType: asset.content_type })
      console.log(`\t\t\t\t- uploaded as ${publicUrl}`);
    } else {
      console.log(`\t\t\t\t- would be uploaded as ${publicUrl}`);
    }

    if (asset.name.endsWith('splunk-otel-web.js')) {
      console.log(`\t\t\t\t- generating script snippet`);

      const snippet = generateScriptSnippet({ version, isAutoUpdating, integrityValue, publicUrl });
      if (!isDryRun) {
        cdnLinks.push(snippet);
      } else {
        console.log(snippet);
        console.log(`\t\t\t\t- above would be added to the release description`);
      }
    }
  }
}

if (!isDryRun) {
  console.log('Creating an invalidation to refresh shared versions.');
  const invalidationRef = `o11y-gdi-rum-${new Date().toISOString()}`;
  const { Invalidation } = await cfClient.send(new CreateInvalidationCommand({
    DistributionId: CDN_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: invalidationRef,
      Paths: {
        Items: ['/cdn/o11y-gdi-rum/*'],
        Quantity: 1,
      },
    },
  }));
  console.log(`Invalidation ${Invalidation.Id} sent. Typically it takes about 5 minutes to execute.`);

  console.log('Appending CDN instructions to release description.');
  await requestWithAuth(`PATCH ${latestRelease.url}`, {
    body: latestRelease.body + cdnLinks.join('\n'),
  });

  console.log(`Please verify that instructions are correct by navigating to: ${latestRelease.html_url}`);
}

function* generateAllVersions() {
  const versionParts = packageConfig.version.split('.');

  let isAutoUpdating = false, isPreRelease = false;
  while (versionParts.length) {
    yield [`v${versionParts.join('.')}`, isAutoUpdating];
    const lastSegment = versionParts.pop(); // 1.2.3 -> 1.2

    if (PRERELEASE_KEYWORDS.some(keyword => lastSegment.includes(keyword))) {
      // if version was 1.2.3-beta, then don't update 1.2
      isPreRelease = true;
      break;
    }
    isAutoUpdating = true;
  }

  if (!isPreRelease) {
    yield ['latest', true];
  }
}

async function uploadToS3(key, buffer, { contentType }) {
  return await s3Client.send(new PutObjectCommand({
    Body: buffer,
    Bucket: CDN_BUCKET_NAME,
    Key: `cdn/${key}`,
    ACL: 'public-read',
    ContentType: contentType,
    CacheControl: 'max-age=3600',
  }));
}

function generateScriptSnippet({ version, isAutoUpdating, publicUrl, integrityValue }) {
  const lines = [];

  lines.push(`### Version ${version}`);

  if (isAutoUpdating) {
    lines.push('**WARNING: Content behind this URL might be updated when we release a new version.**');
    lines.push('For this reason we do not provide `integrity` attribute.');
  }

  lines.push('```html');
  if (isAutoUpdating) {
    lines.push(`<script src="${publicUrl}" crossorigin="anonymous"></script>`);
  } else {
    lines.push(`<script src="${publicUrl}" integrity="${integrityValue}" crossorigin="anonymous"></script>`);
  }
  lines.push('```\n');

  return lines.join('\n');
}
