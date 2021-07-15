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
 * @fileoverview Event listeners that commuciate with the page without
 * interfering with normal page operations.
 * This runs in a sandbox, with restricted access to novel Window objects.
 */

import {InteractiveCanvasWindow} from './types';

declare let window: InteractiveCanvasWindow;

/**
 * An array of scripts to be loaded into the primary page context.
 */
const scriptsToLoad = ['js-yaml.min.js', 'webpage-script.js'];
scriptsToLoad.forEach(script => {
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL(script);
  (document.head || document.documentElement).appendChild(s);
  s.onload = function () {
    s.remove();
  };
});

document.addEventListener('InteractiveCanvas_Init', (e: Event) => {
  const event = e as MessageEvent;
  window.interactiveCanvasExists = event.data;
});

document.addEventListener('InteractiveCanvas_History', (e: Event) => {
  const event = e as MessageEvent;
  window.interactiveCanvasHistory = event.data;
});

document.addEventListener('InteractiveCanvas_ProcessSdk', (e: Event) => {
  const event = e as MessageEvent;
  const {data, ready} = event.data;
  window.interactiveCanvasData = data;
  window.interactiveCanvasReady = ready;
});
