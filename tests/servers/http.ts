/**
 *
 * Copyright 2020-2026 Splunk Inc.
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
import cors from '@fastify/cors'
import Fastify from 'fastify'

export const HTTP_SERVER_PORT = 8981

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const initHttpServer = () => {
	const fastify = Fastify()

	fastify.register(cors)

	fastify.get<{ Querystring: { delay?: string } }>('/delay', async (request, reply) => {
		const delay = Number.parseInt(request.query.delay ?? '0', 10)
		if (!Number.isNaN(delay) && delay > 0) {
			await sleep(delay)
		}

		reply.send('ok')
	})

	void fastify.listen({ port: HTTP_SERVER_PORT })

	return () => fastify.close()
}
