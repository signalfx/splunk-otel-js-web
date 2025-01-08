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

import { FastifyRequest, FastifyReply } from 'fastify'

export const noCacheMiddleware = (
	req: FastifyRequest<{ Querystring: { noCache?: string } }>,
	reply: FastifyReply,
	payload: unknown,
	done: (err?: Error) => void,
) => {
	if (typeof req.query.noCache === 'string') {
		reply.header('Cache-Control', 'no-store, max-age=0')
		reply.removeHeader('Etag')
		reply.removeHeader('Last-Modified')
	}

	done()
}
