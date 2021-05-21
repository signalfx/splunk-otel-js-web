/*
Copyright 2021 Splunk Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { useCallback, useState } from 'react';

/**
 * @param {Object} props
 * @param {(text: string) => Promise} props.editText
 * @param {() => void} props.cancelEditing
 * @param {Object} props.item
 */
function TodoEdit({
  editText,
  cancelEditing,
  item
}) {
  const [text, setText] = useState(item.text);

  const onSubmit = useCallback(async (event) => {
    event.preventDefault();

    await editText(text);
  }, [editText, text]);

  const onKeyUp = useCallback(async (event) => {
    if (event.keyCode !== 27) { // esc
      return;
    }

    event.preventDefault();
    cancelEditing();
  }, [cancelEditing]);

  return (
    <form onSubmit={onSubmit}>
      <input type="text" name="text" id="add-text" className="form-control" value={text} onChange={e => setText(e.target.value)} onKeyUp={onKeyUp} />
    </form>
  );
}

export default TodoEdit;
