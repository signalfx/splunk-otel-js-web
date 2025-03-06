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

import { useCallback, useState, ChangeEvent } from 'react'
import { TodoEdit } from './todo-edit'

export function TodoRow({
	item,
	editItem,
	deleteItem,
}: {
	deleteItem: (id: string) => void
	editItem: (id: string, data: Partial<{ completed: boolean; text: string }>) => Promise<void>
	item: { completed: boolean; id: string; text: string }
}) {
	const [isEditing, setIsEditing] = useState(false)

	const deleteClick = useCallback(() => {
		deleteItem(item.id)
	}, [deleteItem, item.id])

	const toggleComplete = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			void editItem(item.id, { completed: event.target.checked })
		},
		[editItem, item.id],
	)

	const editText = useCallback(
		async (text: string) => {
			await editItem(item.id, { text: text })
			setIsEditing(false)
		},
		[editItem, item.id, setIsEditing],
	)

	const onDoubleClick = useCallback(() => {
		setIsEditing(true)
	}, [setIsEditing])

	const cancelEditing = useCallback(() => {
		setIsEditing(true)
	}, [setIsEditing])

	return (
		<li className="list-group-item d-flex align-items-center">
			<div className="me-2">
				<input type="checkbox" checked={item.completed} onChange={toggleComplete} />
			</div>
			<div className="flex-grow-1">
				{isEditing ? (
					<TodoEdit item={item} cancelEditing={cancelEditing} editText={editText} />
				) : (
					<span onDoubleClick={onDoubleClick}>{item.text}</span>
				)}
			</div>
			<button className="btn btn-danger ms-2" onClick={deleteClick}>
				x
			</button>
		</li>
	)
}
