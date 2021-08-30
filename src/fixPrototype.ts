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

/* eslint-disable no-extend-native */

const prototypeJsCompatibleReduce = function reduce<T,R>(
  this: T[],
  fn: (acc: R | T | undefined, item: T) => R | T | undefined,
  initial: R | undefined
) {
  if (arguments.length === 0) {
    return this.length > 1 ? this : this[0];
  }

  let idx = 0;

  let result: R | T | undefined;
  if (initial === undefined) {
    result = this[0];
    idx = 1;
  } else {
    result = initial;
  }

  for (; idx < this.length; idx++) {
    result = fn(result, this[idx]);
  }
  return result;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
Array.prototype.reduce = prototypeJsCompatibleReduce as any;
