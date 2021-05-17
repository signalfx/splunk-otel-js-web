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

import { useCallback, useEffect, useState } from 'react';
import TodoAdd from './TodoAdd';
import TodoRow from './TodoRow';

const ENDPOINT = process.env.REACT_APP_BACKEND + '/items';

function TodoList() {
  const [isLoading, setIsLoading] = useState(false);
  const [todos, setTodos] = useState([]);

  useEffect(async () => {
    setIsLoading(true);
    const res = await fetch(ENDPOINT);
    setTodos(await res.json());
    setIsLoading(false);
  }, []);

  const addItem = useCallback(async (text) => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text
      })
    });

    if (!res.ok) {
      const error = await res.json();
      throw error;
    }

    const created = await res.json();
    setTodos(todos.concat([created]));
  }, [todos, setTodos]);

  const editItem = useCallback(async (id, props) => {
    const res = await fetch(ENDPOINT + '/' + id, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(props)
    });

    if (!res.ok) {
      const error = await res.json();
      throw error;
    }

    const updated = await res.json();
    setTodos(todos.map(todo => todo.id === id ? updated : todo));
  }, [todos, setTodos]);

  const deleteItem = useCallback(async (id) => {
    const res = await fetch(ENDPOINT + '/' + id, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const error = await res.json();
      throw error;
    }

    setTodos(todos.filter(todo => todo.id !== id));
  }, [todos, setTodos]);

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ul className="list-group">
        {todos.map((item) => <TodoRow key={item.id} item={item} editItem={editItem} deleteItem={deleteItem} />)}
        <li className="list-group-item">
          <TodoAdd addItem={addItem} />
        </li>
      </ul>
    </div>
  );
}

export default TodoList;
