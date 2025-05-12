/**
 *
 * Copyright 2020-2025 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const s3Client = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' })

export const uploadToS3 = ({
	contentType,
	key,
	bucketName,
	buffer,
	isImmutable,
}: {
	bucketName: string
	buffer: Uint8Array
	contentType: string
	isImmutable: boolean
	key: string
}) =>
	s3Client.send(
		new PutObjectCommand({
			Body: buffer,
			Bucket: bucketName,
			Key: `cdn/${key}`,
			ACL: 'public-read',
			ContentType: contentType,
			CacheControl: isImmutable ? 'public, max-age=31536000, immutable' : 'max-age=3600',
		}),
	)
