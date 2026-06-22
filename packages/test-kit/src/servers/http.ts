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
import { createReadStream } from 'node:fs'
import path from 'node:path'

import Fastify from 'fastify'

import { delayMiddleware } from './delay-middleware'
import { HTTP_TEST_SERVER_HOST, HTTP_TEST_SERVER_PORT } from './http-constants'

const TEST_IMAGE_PNG = path.join(__dirname, 'assets/smpte-color-bars.png')

export const initHttpServer = async () => {
	const fastify = Fastify()

	fastify.addHook('onRequest', (request, reply, done) => {
		reply.header('Access-Control-Allow-Headers', '*')
		reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
		reply.header('Access-Control-Allow-Origin', '*')
		done()
	})
	fastify.addHook('preHandler', delayMiddleware)

	fastify.get('/some-data', (_request, reply) => {
		reply.send({
			key1: 'value1',
			key2: 'value2',
			key3: 'value3',
		})
	})

	fastify.get('/delay', (_request, reply) => {
		reply.send('ok')
	})

	fastify.get('/style.css', (_request, reply) => {
		reply.type('text/css')
		reply.send('body { --splunk-test-style-loaded: 1; }')
	})

	fastify.get('/test-image.png', (_request, reply) => {
		reply.header('Cache-Control', 'no-store')
		reply.type('image/png')
		reply.send(createReadStream(TEST_IMAGE_PNG))
	})

	fastify.get('/test-image-error.png', (_request, reply) => {
		reply.status(404)
		reply.send('not found')
	})

	await fastify.listen({ host: HTTP_TEST_SERVER_HOST, port: HTTP_TEST_SERVER_PORT })

	return () => fastify.close()
}
