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

import { FormEvent, useCallback, useState, KeyboardEvent } from 'react'

export function TodoEdit({
	editText,
	cancelEditing,
	item,
}: {
	cancelEditing: () => void
	editText: (text: string) => Promise<void>
	item: { id: string; text: string }
}) {
	const [text, setText] = useState(item.text)

	const onSubmit = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault()

			await editText(text)
		},
		[editText, text],
	)

	const onKeyUp = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key !== 'Escape') {
				return
			}

			event.preventDefault()
			cancelEditing()
		},
		[cancelEditing],
	)
	return (
		<form onSubmit={onSubmit}>
			<input
				type="text"
				name="text"
				id="add-text"
				className="form-control"
				value={text}
				onChange={(e) => setText(e.target.value)}
				onKeyUp={onKeyUp}
			/>
		</form>
	)
}
