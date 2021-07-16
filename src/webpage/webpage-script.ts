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
 * @fileoverview Code that runs in the context of the real page, without sandboxing.
 * @see https://stackoverflow.com/questions/9602022/chrome-extension-retrieving-global-variable-from-webpage#answer-9636008
 */

import {CanvasHistory, InteractiveCanvasWindow} from '../types';

import {getImgData, processSdk} from './process-sdk';

declare let window: InteractiveCanvasWindow;

/**
 * Adds HTML elements to the web browser to emulate a smart display header.
 */
function showHeader() {
  const headerTitle = document.getElementsByClassName('ic-ext-title')[0];
  if (!headerTitle) {
    // Create banner
    const banner = document.createElement('div');
    banner.classList.add('ic-ext-banner');

    const appIcon = document.createElement('div');
    appIcon.classList.add('ic-ext-icon');

    const appTitle = document.createElement('div');
    appTitle.classList.add('ic-ext-title');
    appTitle.innerText = 'My Test App';

    banner.appendChild(appIcon);
    banner.appendChild(appTitle);
    // Add to webpage
    document.body.appendChild(banner);
  }
  updateHeader();
}

/**
 * If the debug header exists on the webpage, replace placeholder elements
 * with values obtained from parsing the Actions SDK directory.
 */
async function updateHeader() {
  if (!window.interactiveCanvasHeader) {
    return console.debug('ICExt: No header data found. Try importing SDK.');
  }
  const {title, projectId, logoFile} = window.interactiveCanvasHeader;
  if (!projectId) {
    return console.debug('ICExt: Project ID not found. Try importing SDK.');
  }
  const headerTitle = document.getElementsByClassName(
    'ic-ext-title'
  )[0] as HTMLDivElement;
  if (!headerTitle) {
    return console.debug('ICExt: Cannot find header elements on page.');
  }

  headerTitle.innerText = `${title}   (${projectId})`;
  const iconParent = document.getElementsByClassName('ic-ext-icon')[0];
  iconParent.innerHTML = ''; // Clear
  const icon = document.createElement('img');
  const logoSrcData = await getImgData(logoFile);
  icon.src = logoSrcData;
  iconParent.appendChild(icon); // Insert our image
}

/**
 * A setting for how to behave when an unsupported API is used. Updated via
 * `Ext-UnsupportedApiBehavior` message. It is a preference (see `preferences.service`)
 * and updated in the Preferences tab.
 */
let unsupportedApiBehavior = 'off';

/**
 * Returns the names of every property of an object that is a function.
 * @param object An object with methods and optionally fields
 */
function getMethodsOfObject(object: Record<string, Function>) {
  const properties = Object.getOwnPropertyNames(object);
  return properties.filter(p => typeof object[p] === 'function');
}

/**
 * Adds an Interactive Canvas warning to the specific method.
 * @param fn Function that should have additional warning
 * @param binder The object to which this function belongs
 */
// eslint-disable-next-line
function addMethodWarning(fn: (...args: any[]) => unknown, binder: Record<string, Function>) {
  const boundFunction = fn.bind(binder);
  const methodName = fn.name;
  const msg =
    `The method "${methodName}" will not execute in an Interactive ` +
    'Canvas environment. See ' +
    'https://developers.google.com/assistant/interactivecanvas/web-apps#guidelines_and_restrictions ' +
    'to learn more.';
  binder[methodName] = (...args: unknown[]) => {
    if (unsupportedApiBehavior === 'warn') {
      console.warn(msg);
    } else if (unsupportedApiBehavior === 'error') {
      throw new Error(msg);
    }
    boundFunction(...args);
  };
}

/**
 * Adds an Interactive Canvas warning to the specific property.
 * @param readOnlyField String-based name of the property
 * @param owner The object to which the field belongs
 */
// eslint-disable-next-line
function addPropertyWarning(readOnlyField: string, owner: any) {
  const msg =
    `The field "${readOnlyField}" will not execute in an Interactive ` +
    'Canvas environment. See ' +
    'https://developers.google.com/assistant/interactivecanvas/web-apps#guidelines_and_restrictions ' +
    'to learn more.';
  const boundProperty = owner[readOnlyField];
  Object.defineProperty(owner, readOnlyField, {
    get: () => {
      if (unsupportedApiBehavior === 'warn') {
        console.warn(msg);
      } else if (unsupportedApiBehavior === 'error') {
        throw new Error(msg);
      }
      return boundProperty;
    },
  });
}

/**
 * Add handler to every API method that will not work in Interactive Canvas.
 * This will result in either a warning or throw an error depending on
 * preference.
 * @see https://developers.google.com/assistant/interactivecanvas/web-apps#guidelines_and_restrictions
 */
function addUnsupportedApiWarnings() {
  addPropertyWarning('localStorage', window);
  addPropertyWarning('geolocation', window.navigator);
  addPropertyWarning('mediaDevices', window.navigator);
  addPropertyWarning('cookie', document);
  addPropertyWarning('indexedDB', window);
  addPropertyWarning('webkitSpeechRecognition', window);
}

/**
 * Add methods as `window.interactiveCanvasDebug` to trigger callbacks
 * programmatically from the DevTools console.
 */
function addDebuggingMethodsInJsConsole() {
  window.interactiveCanvasDebug = {
    onUpdate: (data: Object[]) => {
      const msgData = {
        data: {
          type: 'payload',
          requestId: 'requestId',
          data,
        },
      };
      document.dispatchEvent(new MessageEvent('message', msgData));
      return undefined;
    },
    onTtsMark: (markName: string) => {
      const msgData = {
        data: {
          type: 'payload',
          requestId: 'requestId',
          data: markName,
        },
      };
      document.dispatchEvent(new MessageEvent('message', msgData));
    },
  };
}

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

  window.interactiveCanvasProcessSdk = processSdk;
  addUnsupportedApiWarnings();
  addDebuggingMethodsInJsConsole();
});

document.addEventListener('message', (e: Event) => {
  const event = e as MessageEvent;
  const eventData = event.data;
  const {type} = eventData;
  switch (type) {
    case 'payload': {
      const {data} = eventData;
      window.interactiveCanvas.g.G.onUpdate(data);
      break;
    }
    case 'TtsEndpointEvent': {
      const {name} = eventData;
      window.interactiveCanvas.g.G.onTtsMark(name);
      break;
    }
    case 'Ext-ShowHeader': {
      showHeader();
      break;
    }
    case 'Ext-ProcessSdk': {
      window.interactiveCanvasProcessSdk();
      break;
    }
    case 'Ext-UnsupportedApiBehavior': {
      const {data} = eventData;
      unsupportedApiBehavior = data;
    }
  }
});
