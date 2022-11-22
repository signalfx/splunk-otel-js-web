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

import crypto from 'crypto';

import { default as dotenv } from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import fetch from 'node-fetch';
import { request } from '@octokit/request';

const OWNER = 'signalfx';
const REPO = 'splunk-otel-js-web';
const CDN_LISTED_FILES = [
  'splunk-otel-web.js',
  'splunk-otel-web-session-recorder.js'
];

const isDryRun = process.argv.some(arg => arg === '--dry-run');
if (isDryRun) {
  console.log('---- DRY RUN ----');
}

dotenv.config();

if (!process.env.CDN_DISTRIBUTION_ID) {
  throw new Error('You are missing an environment variable CDN_DISTRIBUTION_ID.');
}
const { CDN_DISTRIBUTION_ID } = process.env;

if (!process.env.CDN_BUCKET_NAME) {
  throw new Error('You are missing an environment variable CDN_BUCKET_NAME.');
}
const { CDN_BUCKET_NAME } = process.env;

if (!process.env.GITHUB_TOKEN && !isDryRun) {
  throw new Error('You are missing an environment variable GITHUB_TOKEN.');
}

const requestWithAuth = request.defaults({
  headers: {
    authorization: process.env.GITHUB_TOKEN ? `token ${process.env.GITHUB_TOKEN}` : undefined,
  },
});

const targetVersion = process.argv.find((arg, i) => {
  // skip first 2 args (node, release-cdn.mjs) and any flags
  if (i < 2 || arg.startsWith('-')) {
    return false;
  }

  return true;
});

const { data: releases, status } = await requestWithAuth(`GET /repos/${OWNER}/${REPO}/releases`);
if (status >= 400) {
  throw new Error('There was an error while trying to fetch the list of releases.');
}

let ghRelease;
if (targetVersion) {
  ghRelease = releases.find(({ tag_name }) => tag_name === targetVersion);
} else {
  ghRelease = releases[0];
}
if (!ghRelease) {
  throw new Error('Latest release not found.');
}
console.log(`I have found the latest version to be: ${ghRelease.tag_name} named "${ghRelease.name}."`);

const { data: assets } = await requestWithAuth(`GET /repos/${OWNER}/${REPO}/releases/${ghRelease.id}/assets`);
console.log(`This release has ${assets.length} release artifacts: ${assets.map(({ name }) => name).join(', ')}.`);

const baseVersion = ghRelease.tag_name;
if (!baseVersion.startsWith('v')) {
  throw new Error('Release version tag must start with the letter "v".');
}

const versions = Array.from(generateAllVersions(baseVersion));
console.log(`This release will update following versions in CDN: ${versions.map(([version]) => version).join(', ')}`);

console.log('I will now process the files:');
const s3Client = new S3Client({ region: 'us-east-1' });
const cfClient = new CloudFrontClient({ region: 'us-east-1' });
const cdnLinksByVersion = {};
versions.forEach(([version]) => {
  cdnLinksByVersion[version] = [];
});

for (const asset of assets) {
  const filename = asset.name;
  console.log(`\t- ${filename}`);
  console.log(`\t\t- fetching from ${asset.browser_download_url}.`);
  
  const response = await fetch(asset.browser_download_url);
  const assetBuffer = await response.buffer();
  console.log('\t\t- fetched');

  const sha384Sum = crypto.createHash('sha384').update(assetBuffer, 'utf-8').digest('base64');
  const integrityValue = `sha384-${sha384Sum}`;
  console.log(`\t\t- calculated integrity ${integrityValue}`);

  for (const [version, isAutoUpdating] of versions) {
    console.log(`\t\t\t- version: ${version}`);

    const key = `o11y-gdi-rum/${version}/${filename}`;
    console.log(`\t\t\t\t- key: ${key}`);

    const publicUrl = `https://cdn.signalfx.com/${key}`;
    if (!isDryRun) {
      await uploadToS3(key, assetBuffer, { contentType: asset.content_type });
      console.log(`\t\t\t\t- uploaded as ${publicUrl}`);
    } else {
      console.log(`\t\t\t\t- would be uploaded as ${publicUrl}`);
    }

    if (CDN_LISTED_FILES.includes(asset.name)) {
      console.log('\t\t\t\t- generating script snippet');

      cdnLinksByVersion[version].push(generateScriptSnippet({ version, isAutoUpdating, filename, integrityValue, publicUrl }));
    }
  }
}

/* TODO GENERATE LIST */
const cdnLinks = ['\n## CDN', ...versions.map(([version, isAutoUpdating]) => {
  if (cdnLinksByVersion[version].length === 0) {
    return '';
  }

  const lines = [];
  let footer = '';

  if (!isAutoUpdating || version === 'latest') {
    lines.push(`### Version ${version}`, '');
  } else {
    lines.push(`<details><summary>Version ${version}</summary>`, '');
    footer = '</details>\n';
  }

  if (isAutoUpdating) {
    lines.push(
      '**WARNING: Content behind this URL might be updated when we release a new version.**',
      'For this reason we do not provide `integrity` attribute.',
      '',
    );
  }

  lines.push(
    '```html',
    ...cdnLinksByVersion[version],
    '```\n',
    footer,
  );

  return lines.join('\n');
})];

if (isDryRun) {
  console.log('Following would be added to the relase notes:');
  console.log('------');
  console.log(cdnLinks.join('\n'));
  console.log('------');
}

if (!isDryRun) {
  console.log('Creating an invalidation to refresh shared versions.');
  const invalidationRef = `o11y-gdi-rum-${new Date().toISOString()}`;
  const { Invalidation } = await cfClient.send(new CreateInvalidationCommand({
    DistributionId: CDN_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: invalidationRef,
      Paths: {
        Items: ['/o11y-gdi-rum/*'],
        Quantity: 1,
      },
    },
  }));
  console.log(`Invalidation ${Invalidation.Id} sent. Typically it takes about 5 minutes to execute.`);

  console.log('Appending CDN instructions to release description.');
  await requestWithAuth(`PATCH ${ghRelease.url}`, {
    body: ghRelease.body + cdnLinks.join('\n'),
  });

  console.log(`Please verify that instructions are correct by navigating to: ${ghRelease.html_url}`);
}

function* generateAllVersions(baseVersion) {
  const versionParts = baseVersion.split('.');

  let isAutoUpdating = false, isPreRelease = false;
  while (versionParts.length) {
    yield [`${versionParts.join('.')}`, isAutoUpdating];
    const lastSegment = versionParts.pop(); // v1.2.3 -> v1.2

    if (lastSegment.search(/[\D-]/) > -1 && versionParts.length > 0) {
      // If any suffix is included in version, then don't update parent
      // eg. if version was v1.2.3-beta, then don't update v1.2
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

function generateScriptSnippet({ isAutoUpdating, filename, publicUrl, integrityValue }) {
  const lines = [];

  lines.push(`${filename}:`);
  if (isAutoUpdating) {
    lines.push(`<script src="${publicUrl}" crossorigin="anonymous"></script>`);
  } else {
    lines.push(`<script src="${publicUrl}" integrity="${integrityValue}" crossorigin="anonymous"></script>`);
  }

  return lines.join('\n');
}
