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

import { useEffect } from 'react';
import TodoList from './TodoList';

function App() {
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(process.env.REACT_APP_BACKEND + '/ping');
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  });

  return (
    <div className="container p-4">
      <h1 className="mb-4">Great Todo App!</h1>
      <TodoList />
    </div>
  );
}

export default App;
