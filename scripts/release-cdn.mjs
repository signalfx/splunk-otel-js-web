import { default as dotenv } from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import fetch from 'node-fetch';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { request } from '@octokit/request';
import readline from 'readline';

const OWNER = 'signalfx';
const REPO = 'splunk-otel-js-browser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageConfig = JSON.parse(fs.readFileSync(join(__dirname, '..', 'package.json')).toString());
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
console.log(`I have found the latest version to be: ${latestRelease.tag_name}.`);

if (!latestRelease.draft) {
  console.warn('This release is already published and may have been uploaded to CDN already.');
}

const rl = readline.createInterface({input: process.stdin, output: process.stdout});
const question = (text) => new Promise(resolve => rl.question(text, (answer) => resolve(answer)));
const confirmation = await question('Please retype the version to confirm uploading to CDN: ');
rl.close();

if (confirmation !== latestRelease.tag_name) {
  throw new Error('You need to confirm the version before proceeding.');
}

console.log(`Uploading release "${latestRelease.name}" to CDN using your AWS credentials.`);

const { data: assets } = await requestWithAuth(`GET /repos/${OWNER}/${REPO}/releases/${latestRelease.id}/assets`);
console.log(`Release has the following assets: ${assets.map(asset => asset.name).join(", ")}.`);

const s3Client = new S3Client({region: 'us-east-1'});
const cfClient = new CloudFrontClient({region: 'us-east-1'});
const cdnLinks = ['\n## CDN'];
for (const asset of assets) {
  console.log(`Fetching ${asset.name} from ${asset.browser_download_url}.`);
  const response = await fetch(asset.browser_download_url);
  const assetBuffer = await response.buffer();

  const versionParts = packageConfig.version.split('.');
  let isFinalVersion = true;
  while (versionParts.length) {
    const version = `v${versionParts.join('.')}`;
    const key = `o11y-gdi-rum/${version}/${asset.name}`;
    await s3Client.send(new PutObjectCommand({
      Body: assetBuffer,
      Bucket: CDN_BUCKET_NAME,
      Key: `cdn/${key}`,
      ACL: 'public-read',
      ContentType: asset.content_type,
      CacheControl: 'max-age=3600',
    }));
    const publicUrl = `https://cdn.signalfx.com/${key}`;
    console.log(`Uploaded ${asset.name} as ${publicUrl}`);

    if (asset.name == 'splunk-rum.js') {
      cdnLinks.push(
`### Version ${version}
${(isFinalVersion ? '' : '**WARNING: Content behind this URL might be updated when we release a new version.**')}
\`\`\`html
<script src="${publicUrl}" crossorigin="anonymous"></script>
\`\`\`
`
      );
    }

    versionParts.pop(); // 1.2.3 -> 1.2
    isFinalVersion = false;
  }
}

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
await requestWithAuth(`PATCH /repos/${OWNER}/${REPO}/releases/${latestRelease.id}`, {
  body: latestRelease.body + cdnLinks.join('\n'),
})
