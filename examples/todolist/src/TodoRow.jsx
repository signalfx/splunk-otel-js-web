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
import TodoEdit from './TodoEdit';

/**
 * @param {Object} props
 * @param {{id: number, text: string, completed: boolean}} props.item
 * @param {(id: number, {text?: string, completed?: boolean}) => Promise} props.editItem
 * @param {(id: number) => Promise} props.deleteItem
 */
function TodoRow({
  item,
  editItem,
  deleteItem
}) {
  const [isEditing, setIsEditing] = useState(false);

  const deleteClick = useCallback(() => {
    deleteItem(item.id);
  }, [deleteItem, item.id]);

  const toggleComplete = useCallback((event) => {
    editItem(item.id, { completed: event.target.checked });
  }, [editItem, item.id]);

  const editText = useCallback(async (text) => {
    await editItem(item.id, { text: text });
    setIsEditing(false);
  }, [editItem, item.id, setIsEditing]);

  const onDoubleClick = useCallback(() => {
    setIsEditing(true);
  }, [setIsEditing]);

  const cancelEditing = useCallback(() => {
    setIsEditing(true);
  }, [setIsEditing]);

  return (
    <li className="list-group-item d-flex align-items-center">
      <div className="me-2">
        <input type="checkbox" checked={item.completed} onChange={toggleComplete} />
      </div>
      <div className="flex-grow-1">
        {
          isEditing
            ? (<TodoEdit item={item} cancelEditing={cancelEditing} editText={editText} />)
            : <span onDoubleClick={onDoubleClick}>{item.text}</span>
        }
      </div>
      <button className="btn btn-danger ms-2" onClick={deleteClick}>
        x
      </button>
    </li>
  );
}

export default TodoRow;
