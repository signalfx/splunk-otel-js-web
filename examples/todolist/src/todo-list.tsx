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

import { useCallback, useEffect, useState } from 'react'
import { TodoAdd } from './todo-add'
import { TodoRow } from './todo-row'

const ENDPOINT = process.env.PUBLIC_REACT_APP_BACKEND + '/items'

interface TodoItem {
	completed: boolean
	id: string
	text: string
}

export function TodoList() {
	const [token, setToken] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [todos, setTodos] = useState<TodoItem[]>([])

	useEffect(() => {
		async function fetchData() {
			const tracer = window.SplunkRum.provider?.getTracer('todoList')
			if (!tracer) {
				return
			}

			const span = tracer.startSpan('todoList.load', {
				attributes: {
					'workflow.id': 1,
					'workflow.name': 'todoList.load',
				},
			})

			setIsLoading(true)
			const res = await fetch(ENDPOINT + (token ? '?token=' + token : ''))
			setTodos(await res.json())
			setIsLoading(false)

			span.end()
		}

		void fetchData()
	}, [token])

	const login = useCallback(async () => {
		if (token) {
			setToken(null)
			return
		}

		const res = await fetch(process.env.PUBLIC_REACT_APP_BACKEND + '/login')

		setToken((await res.json()).token as string)
	}, [token, setToken])

	const addItem = useCallback(
		async (text: string) => {
			const tracer = window.SplunkRum.provider?.getTracer('todoList')
			if (!tracer) {
				return
			}

			const span = tracer.startSpan('todoList.addItem', {
				attributes: {
					'workflow.id': 2,
					'workflow.name': 'todoList.addItem',
				},
			})

			const res = await fetch(ENDPOINT + (token ? '?token=' + token : ''), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					text,
				}),
			})

			if (!res.ok) {
				const error = await res.json()

				span.setAttribute('error', true)
				span.setAttribute('error.message', JSON.stringify(error))
				span.end()

				throw error
			}

			const created = (await res.json()) as TodoItem
			setTodos(todos.concat([created]))
			span.end()
		},
		[todos, setTodos],
	)

	const editItem = useCallback(
		async (id: string, props: Partial<{ completed: boolean; text: string }>) => {
			const res = await fetch(ENDPOINT + '/' + id + (token ? '?token=' + token : ''), {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(props),
			})

			if (!res.ok) {
				const error = await res.json()
				throw error
			}

			const updated = await res.json()
			setTodos(todos.map((todo) => (todo.id === id ? updated : todo)))
		},
		[todos, setTodos, token],
	)

	const deleteItem = useCallback(
		async (id: string) => {
			const res = await fetch(ENDPOINT + '/' + id + (token ? '?token=' + token : ''), {
				method: 'DELETE',
			})

			if (!res.ok) {
				const error = await res.json()
				throw error
			}

			setTodos(todos.filter((todo) => todo.id !== id))
		},
		[todos, setTodos, token],
	)

	if (isLoading) {
		return (
			<div className="d-flex justify-content-center">
				<div className="spinner-border" role="status">
					<span className="visually-hidden">Loading...</span>
				</div>
			</div>
		)
	}

	return (
		<div>
			<div className="mb-4">
				<button className="btn btn-secondary" onClick={login}>
					{token ? 'Logout' : 'Login'}
				</button>
			</div>
			<ul className="list-group">
				{todos.map((item) => (
					<TodoRow key={item.id} item={item} editItem={editItem} deleteItem={deleteItem} />
				))}
				<li className="list-group-item">
					<TodoAdd addItem={addItem} />
				</li>
			</ul>
		</div>
	)
}
