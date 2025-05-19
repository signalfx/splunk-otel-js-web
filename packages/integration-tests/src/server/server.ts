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
import Fastify from 'fastify'
import path from 'path'
import { RENDER_AGENT_TEMPLATE } from './render-agent'
import ejs from 'ejs'
import * as fs from 'node:fs'
import cors from '@fastify/cors'
import { serverTimingMiddleware, delayMiddleware, noCacheMiddleware } from './middlewares'
import fastifyStatic from '@fastify/static'
import fastifyView from '@fastify/view'
import fastifyWebsockets from '@fastify/websocket'

const GLOBAL_TEST_BUFFER_TIMEOUT = 20

const fastify = Fastify({
	logger: {
		transport: {
			target: 'pino-pretty',
			options: {
				colorize: true,
				translateTime: 'SYS:standard',
				ignore: 'pid,hostname',
			},
		},
	},
})

fastify.register(cors)
fastify.register(fastifyView, {
	engine: {
		ejs: ejs,
	},
	root: path.join(__dirname, '../tests'),
})
fastify.register(fastifyStatic, {
	root: path.join(__dirname, '../tests'),
	prefix: '/public/',
	list: true,
})

fastify.register(fastifyStatic, {
	root: path.join(__dirname, '../../../web/dist/artifacts'),
	prefix: '/artifacts/',
	decorateReply: false,
})

fastify.register(fastifyStatic, {
	root: path.join(__dirname, '../../../build-plugins/integration-test/project/dist/'),
	prefix: '/build-plugins-test-project-artifacts/',
	decorateReply: false,
})

fastify.addHook('preHandler', delayMiddleware)
fastify.addHook('onSend', serverTimingMiddleware)
fastify.addHook('onSend', noCacheMiddleware)

fastify.register(fastifyWebsockets)
fastify.register(function (f) {
	f.get('/ws', { websocket: true }, (socket) => {
		socket.on('message', () => {
			socket.send('hi from server')
		})
	})
})

fastify.post('/api/v2/spans', (request, reply) => {
	reply.send('')
})

fastify.post('/echo', (request, reply) => {
	reply.send(request.body)
})

fastify.get('/some-data', (request, reply) => {
	reply.send({
		key1: 'value1',
		key2: 'value2',
		key3: 'value3',
	})
})

fastify.get('/no-server-timings', (request, reply) => {
	reply.removeHeader('Server-Timing')
	reply.send()
})

fastify.get('/', (request, reply) => {
	reply.send()
})

fastify.get<{
	Querystring: {
		_experimental_longtaskNoStartSession?: string
		beaconEndpoint?: string
		disableInstrumentation?: string
		forceSessionId?: string
		samplingRatio?: string
	}
}>('*', async (request, reply) => {
	const beaconUrl = new URL(`http://${request.headers.host}/api/v2/spans`)
	const defaultFile = '/artifacts/splunk-otel-web.js'

	const parsedUrl = new URL(request.url, `http://${request.host}`)
	const filePath = path.join(__dirname, '../tests', parsedUrl.pathname)

	if (fs.existsSync(filePath)) {
		if (parsedUrl.pathname.endsWith('.ejs')) {
			return reply.viewAsync(parsedUrl.pathname, {
				renderAgent(userOpts = {}, noInit = false, file = defaultFile, cdnVersion = null) {
					const options: Record<string, unknown> = {
						_experimental_longtaskNoStartSession:
							request.query._experimental_longtaskNoStartSession === 'true',
						beaconEndpoint: beaconUrl.toString(),
						applicationName: 'splunk-otel-js-dummy-app',
						debug: true,
						bufferTimeout: GLOBAL_TEST_BUFFER_TIMEOUT,
						...userOpts,
					}

					const customOptions: Record<string, unknown> = {}
					if (typeof request.query.samplingRatio === 'string') {
						customOptions['samplingRatio'] = parseFloat(request.query.samplingRatio)
					}

					if (typeof request.query.forceSessionId === 'string') {
						customOptions['forceSessionId'] = request.query.forceSessionId
					}

					if (typeof request.query.disableInstrumentation === 'string') {
						if (!options.instrumentations) {
							options.instrumentations = {}
						}

						request.query.disableInstrumentation.split(',').forEach((instrumentation) => {
							options.instrumentations[instrumentation] = false
						})
					}

					if (typeof request.query.beaconEndpoint === 'string') {
						options.beaconEndpoint = request.query.beaconEndpoint
					}

					if (cdnVersion) {
						file = `https://cdn.signalfx.com/o11y-gdi-rum/${cdnVersion}/splunk-otel-web.js`
					}

					return ejs.render(RENDER_AGENT_TEMPLATE, {
						file,
						noInit,
						options: JSON.stringify(options),
						customOptions: JSON.stringify(customOptions),
						otelApiGlobalsFile: '/artifacts/otel-api-globals.js',
					})
				},
			})
		} else {
			return reply.sendFile(`${parsedUrl.pathname}`)
		}
	} else {
		reply.status(404).send('Error: Invalid URL')
	}
})

const PORT = Number.parseInt(process.env.PORT || '3000')

const start = async () => {
	try {
		await fastify.listen({ port: PORT })
		console.log('Server is running...')
	} catch (err) {
		fastify.log.error(err)
		process.exit(1)
	}
}

process.on('SIGINT', async () => {
	console.log('Shutting down server...')
	await fastify.close()
	process.exit(0)
})

void start()
