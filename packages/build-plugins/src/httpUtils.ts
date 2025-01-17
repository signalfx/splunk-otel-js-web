/*
Copyright 2025 Splunk Inc.

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

import axios from 'axios';
import { createReadStream } from 'fs';
import * as FormData from 'form-data';

interface FileUpload {
  filePath: string;
  fieldName: string;
}

interface UploadOptions {
  url: string;
  file: FileUpload;
  parameters: { [key: string]: string | number };
}

export const uploadFile = async ({ url, file, parameters }: UploadOptions): Promise<void> => {
  const formData = new FormData();

  formData.append(file.fieldName, createReadStream(file.filePath));

  for (const [ key, value ] of Object.entries(parameters)) {
    formData.append(key, value);
  }

  await axios.put(url, formData, {
    headers: {
      ...formData.getHeaders(),
    }
  });
};
