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
import { FastifyRequest } from 'fastify'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const delayMiddleware = async (
	request: FastifyRequest<{
		Querystring: {
			delay?: string
		}
	}>,
) => {
	const delayParam = request.query?.delay

	if (delayParam) {
		const delay = parseInt(delayParam, 10)
		if (!isNaN(delay) && delay > 0) {
			request.log.info(`Delaying request for ${delay}ms`)
			await sleep(delay)
		}
	}
}
