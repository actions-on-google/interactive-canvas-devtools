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

import {CanvasHistory, InteractiveCanvasWindow} from './types';

declare let window: InteractiveCanvasWindow;

// https://stackoverflow.com/questions/9602022/chrome-extension-retrieving-global-variable-from-webpage#answer-9636008
// Code that runs in the context of the real page, without sandboxing.
window.requestAnimationFrame(() => {
  const hasInteractiveCanvas = window.interactiveCanvas !== undefined;

  document.dispatchEvent(
    new MessageEvent('InteractiveCanvas_Init', {
      data: hasInteractiveCanvas,
    })
  );

  if (!hasInteractiveCanvas) return; // Don't override

  // Implement overrides
  const webhookHistory: CanvasHistory[] = [];
  window.interactiveCanvas.sendTextQuery = async text => {
    webhookHistory.push({label: text, timestamp: Date.now(), type: 'text'});
    document.dispatchEvent(
      new MessageEvent('InteractiveCanvas_History', {
        data: webhookHistory,
      })
    );
    return Promise.resolve('READY');
  };

  window.interactiveCanvas.setCanvasState = async state => {
    webhookHistory.push({
      label: JSON.stringify(state),
      timestamp: Date.now(),
      type: 'state',
    });
    document.dispatchEvent(
      new MessageEvent('InteractiveCanvas_History', {
        data: webhookHistory,
      })
    );
  };
});

document.addEventListener('message', (e: Event) => {
  const event = e as MessageEvent;
  const eventData = event.data;
  const {type} = eventData;
  switch (type) {
    case 'payload': {
      const {data} = eventData;
      window.interactiveCanvas.a.G.onUpdate(data);
      break;
    }
    case 'TtsEndpointEvent': {
      const {name} = eventData;
      window.interactiveCanvas.a.G.onTtsMark(name);
      break;
    }
  }
});
