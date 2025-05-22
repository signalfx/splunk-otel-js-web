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
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'

const cfClient = new CloudFrontClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

export const invalidateCloudFrontFiles = async (distributionId: string, invalidationRef: string) => {
	const { Invalidation } = await cfClient.send(
		new CreateInvalidationCommand({
			DistributionId: distributionId,
			InvalidationBatch: {
				CallerReference: invalidationRef,
				Paths: {
					Items: ['/o11y-gdi-rum/*'],
					Quantity: 1,
				},
			},
		}),
	)
	return Invalidation
}
