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

import {
  InteractiveCanvas,
  InteractiveCanvasCallbacks,
} from './interactive-canvas';

/**
 * A representation of Interactive Canvas events that appear in the History tab
 */
export interface CanvasHistory {
  type: 'text' | 'state';
  timestamp: number;
  label: string;
}

/**
 * @see https://wicg.github.io/file-system-access/#api-filesystemdirectoryhandle-getdirectoryhandle
 */
export interface DirectoryHandler {
  entries: () => FileIterator;
  getDirectoryHandle: (path: string) => Promise<DirectoryHandler>;
  getFileHandle: (path: string) => Promise<FileHandler>;
}

/**
 * @see https://wicg.github.io/file-system-access/#api-filesystemdirectoryhandle-asynciterable
 */
export interface FileIterator {
  next: () => {
    done: boolean;
    value?: [string, FileHandler];
  };
}

/**
 * @see https://wicg.github.io/file-system-access/#api-filesystemdirectoryhandle-getfilehandle
 */
export interface FileHandler {
  getFile: () => Promise<File>;
}

/**
 * @see https://wicg.github.io/file-system-access/#api-filesystemfilehandle-getfile
 */
export interface File {
  slice: () => Promise<Blob>;
  text: () => Promise<string>;
}

export interface JSYaml {
  load: (fileData: string, encoding: 'utf-8') => object;
}

/**
 * An extension of the browser `window` with additional fields pertaining
 * to this extension.
 */
export interface InteractiveCanvasWindow extends Window {
  interactiveCanvas: InteractiveCanvas;
  interactiveCanvasExists: boolean;
  interactiveCanvasHistory: CanvasHistory[];
  interactiveCanvasData: {
    data: string[];
    marks: string[];
  };
  interactiveCanvasReady: boolean;
  interactiveCanvasProcessSdk: (mockWindow?: InteractiveCanvasWindow) => void;
  interactiveCanvasHeader: {
    title: string;
    projectId: string;
    /**
     * base64 representation of the project's logo.
     */
    logoSrcData: string;
  };
  interactiveCanvasDebug: InteractiveCanvasCallbacks;
  /**
   * JSYaml is a 3P library that converts YAML to JSON.
   * @see https://www.npmjs.com/package/js-yaml
   */
  jsyaml: JSYaml;
  /**
   * A browser operation that opens a file directory selector.
   * @see https://web.dev/file-system-access/
   */
  showDirectoryPicker: () => Promise<DirectoryHandler>;
}
