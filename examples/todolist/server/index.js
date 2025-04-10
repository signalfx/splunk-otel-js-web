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
import './instrumentation.mjs'

import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'

const app = express()
const port = 3001

// simple store for items
let nextId = 3
const items = [
	{
		id: 1,
		text: 'Example todo',
		completed: false,
	},
	{
		id: 2,
		text: 'Completed example',
		completed: true,
	},
]
const secretItems = [
	{
		id: 1,
		text: 'A secret todo for logged in user',
		completed: false,
	},
	{
		id: 2,
		text: 'See the secret todos',
		completed: true,
	},
]
const secretToken = 'top-secret-do-not-share-me'

function getItems(req) {
	if (req.query.token === secretToken) {
		return secretItems
	}

	return items
}

app.use(bodyParser.json())
app.use(cors())

app.get('/ping', (req, res) => {
	res.json({ status: true })
})

app.get('/login', (req, res) => {
	res.json({ token: secretToken })
})

app.get('/items', (req, res) => {
	res.json(getItems(req))
})

app.post('/items', (req, res) => {
	nextId += 1
	const item = {
		id: nextId,
		text: req.body.text || '',
		completed: req.body.completed || false,
	}
	getItems(req).push(item)

	res.status(201).json(item)
})

app.get('/items/:id', (req, res) => {
	const reqId = parseInt(req.params.id)
	const item = getItems(req).find(({ id }) => id === reqId)

	if (!item) {
		return res.sendStatus(404)
	}

	res.json(item)
})

app.patch('/items/:id', (req, res) => {
	const reqId = parseInt(req.params.id)
	const item = getItems(req).find(({ id }) => id === reqId)

	if (!item) {
		return res.sendStatus(404)
	}

	if ('text' in req.body) {
		item.text = req.body.text
	}

	if ('completed' in req.body) {
		item.completed = req.body.completed
	}

	res.json(item)
})

app.delete('/items/:id', (req, res) => {
	const reqId = parseInt(req.params.id)
	const item = getItems(req).find(({ id }) => id === reqId)

	if (!item) {
		return res.sendStatus(404)
	}

	items.splice(items.indexOf(item), 1)

	res.sendStatus(204)
})

app.listen(port, () => {
	console.log(`Backend listening on http://localhost:${port}`)
})
