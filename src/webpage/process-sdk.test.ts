/**
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import test from 'ava';
import * as path from 'path';
import * as fs from 'fs';
import {
  DirectoryHandler,
  File,
  FileHandler,
  FileIterator,
  InteractiveCanvasWindow,
} from '../types';
import {processSdk} from './process-sdk';
import jsonRepair from '../utils/json-repair';

// Import cross-platform blob implementation to run tests
const xBlob = require('cross-blob');
const jsyaml = require('js-yaml');

/**
 * Mocked implementation of DirectoryHandler using local filesystem.
 */
class FsDirectoryHandler implements DirectoryHandler {
  currentPath: string;
  constructor(currentPath = '.') {
    this.currentPath = currentPath;
  }

  getDirectoryHandle(dirPath: string) {
    const dirPathString = path.join(this.currentPath, dirPath).toString();
    return Promise.resolve(
      new FsDirectoryHandler(dirPathString)
    ) as unknown as Promise<DirectoryHandler>;
  }

  getFileHandle(filePath: string) {
    const filePathString = path.join(this.currentPath, filePath).toString();
    return Promise.resolve(
      new FsFileHandler(filePathString)
    ) as unknown as Promise<FileHandler>;
  }

  entries() {
    let index = 0;
    const files = fs.readdirSync(this.currentPath);
    return {
      next: () => {
        if (index >= files.length) {
          return {
            done: true,
            value: undefined,
          };
        }

        const filepath = path.join(this.currentPath, files[index]);
        const value = files[index]
          ? [filepath, new FsFileHandler(filepath)]
          : undefined;
        index++;
        return {
          done: false,
          value,
        };
      },
    } as unknown as FileIterator;
  }
}

/**
 * Mocked implementation of FileHandler using local filesystem.
 */
class FsFileHandler implements FileHandler {
  currentPath: string;
  constructor(currentPath = '') {
    this.currentPath = currentPath;
  }

  getFile() {
    return Promise.resolve(
      new FsFile(this.currentPath)
    ) as unknown as Promise<File>;
  }
}

/**
 * Mocked implementation of File using local filesystem.
 */
class FsFile implements File {
  currentPath: string;
  constructor(currentPath = '') {
    this.currentPath = currentPath;
  }

  slice() {
    return Promise.resolve(new xBlob(['placeholder'], {type: 'text/plain'}));
  }

  text() {
    return Promise.resolve(fs.readFileSync(this.currentPath, 'utf-8'));
  }
}

/**
 * Mocked implementation of DirectoryHandler pointing to example/sdk folder.
 */
function getDirectoryHandler(): DirectoryHandler {
  const exampleSdkPath = path.join('example', 'sdk').toString();
  return new FsDirectoryHandler(exampleSdkPath);
}

test('Process example SDK directory', async t => {
  // Type-coercion to have an object that only has fields which matter.
  const mockWindow = {
    interactiveCanvasData: {
      data: [],
      marks: [],
    },
    interactiveCanvasHeader: {
      title: '',
      projectId: '',
      logoFile: null,
    },
    interactiveCanvasReady: false,
    interactiveCanvasProcessSdk: processSdk,
    jsyaml,
    showDirectoryPicker: () => Promise.resolve(getDirectoryHandler()),
  } as unknown as InteractiveCanvasWindow;
  await processSdk(mockWindow, {} as Document);

  t.true(mockWindow.interactiveCanvasReady);
  t.is(mockWindow.interactiveCanvasHeader.projectId, '<PROJECT_ID>');
  t.is(mockWindow.interactiveCanvasHeader.title, 'Snow Pal sample');
  t.is(
    mockWindow.interactiveCanvasHeader.logoFile['currentPath'],
    'example/sdk/resources/images/redcircle.png'
  );
  t.deepEqual(mockWindow.interactiveCanvasData.marks, [
    'globalyaml',
    'globalyaml2',
    'sceneyaml',
    'code',
  ]);
});
