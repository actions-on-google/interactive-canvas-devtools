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

/**
 * Types for Interactive Canvas.
 * @see https://developers.google.com/assistant/interactivecanvas/reference
 */
export interface InteractiveCanvas {
  ready: (callbacks: InteractiveCanvasCallbacks) => void;
  sendTextQuery: (textQuery: string) => Promise<State>;
  getHeaderHeightPx: () => Promise<number>;
  setCanvasState: (state: Object) => Promise<void>;
  a: {
    G: InteractiveCanvasCallbacks;
  };
}

/**
 * Types for Interactive Canvas callbacks.
 * @see https://developers.google.com/assistant/interactivecanvas/reference#interactivecanvascallbacks
 */
export interface InteractiveCanvasCallbacks {
  onUpdate: (data: Object[]) => Promise<void> | undefined;
  onTtsMark: (markName: string) => void;
}

type State = 'READY' | 'BLOCKED' | 'UNKNOWN';
