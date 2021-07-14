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
  CanvasHistory,
  DirectoryHandler,
  FileHandler,
  InteractiveCanvasWindow,
  JSYaml,
} from './types';

declare let window: InteractiveCanvasWindow;

type DirectoryIteratorCallback = (
  filename: string,
  handler: FileHandler
) => Promise<void>;

/** TODO Import types from Actions SDK */
interface SdkSettings {
  projectId: string;
  localizedSettings: {
    displayName: string;
    smallLogoImage: string;
  };
}

interface SdkScene {
  handler?: {
    staticPrompt?: {
      candidates?: {
        promptResponse?: {
          canvas?: {
            data: object[];
          };
          firstSimple?: {
            variants?: {
              speech?: string;
            }[];
          };
        };
      }[];
    };
  };
  intentEvents?: {
    handler?: {
      staticPrompt?: {
        candidates?: {
          promptResponse?: {
            canvas?: {
              data: object[];
            };
            firstSimple?: {
              variants?: {
                speech?: string;
              }[];
            };
          };
        }[];
      };
    };
  }[];
}

/**
 * Iterates through a local filesystem directory and executes a callback
 * function for every file.
 * @param dir Handler to the current directory.
 * @param callback A callback function that is called for every file.
 */
async function iterateDirectory(
  dir: DirectoryHandler,
  callback: DirectoryIteratorCallback
) {
  const iterator = dir.entries();
  while (true) {
    const next = await iterator.next();
    if (next.done || next.value === undefined) break;
    const [filename, handler] = next.value;
    await callback(filename, handler);
  }
}

/**
 * Reads and obtains the logo for the given Actions SDK project as a base64
 * string.
 * @param dirHandler Handler to the `sdk` directory.
 * @param settingsObj Parsed YAML object of the project settings.
 * @returns A base64 representation of the project logo.
 */
async function getActionLogo(
  dirHandler: DirectoryHandler,
  settingsObj: SdkSettings
) {
  const smallLogoImage = settingsObj.localizedSettings.smallLogoImage.replace(
    '$resources.images.',
    ''
  );
  const resourcesDir = await dirHandler.getDirectoryHandle('resources');
  const resImgDir = await resourcesDir.getDirectoryHandle('images');
  const logoPng = await resImgDir.getFileHandle(`${smallLogoImage}.png`);
  const logoFile = await logoPng.getFile();
  const logoData = await logoFile.slice(); // Gives a blob
  return await getImgData(logoData);
}

/** Finds all TTS marks within an SSML message. Uses a capture group to get
 *  the name of the mark.
 */
const markRegexp = new RegExp('<mark name=[\'"](\\w+)[\'"]', 'g');

/**
 * Processes `sdk/custom/global` to find JSON payloads and TTS marks.
 * @param dirHandler Handler to the `custom` directory
 * @param jsyaml JSYaml library on the `window` object
 * @returns Processed JSON payloads and TTS marks in an object
 */
async function processSdkGlobal(dirHandler: DirectoryHandler, jsyaml: JSYaml) {
  const data: string[] = [];
  const marks: string[] = [];
  const globalDir = await dirHandler.getDirectoryHandle('global');
  await iterateDirectory(globalDir, async (filename, handler) => {
    // Load <filename>
    const sourceFile = await handler.getFile();
    const sourceText = await sourceFile.text();
    const sourceTree = jsyaml.load(sourceText, 'utf-8') as SdkScene;

    // Look for Canvas Data in project source
    const candidates = sourceTree?.handler?.staticPrompt?.candidates || [];
    for (const candidate of candidates) {
      if (candidate?.promptResponse?.canvas?.data) {
        candidate.promptResponse.canvas.data.forEach((datum: {}) => {
          data.push(JSON.stringify(datum));
        });
      }
    }

    // Look for TTS Marks in project source
    for (const candidate of candidates) {
      if (candidate?.promptResponse?.firstSimple?.variants) {
        for (const variant of candidate?.promptResponse?.firstSimple
          ?.variants) {
          const matches = variant.speech?.match(markRegexp) || [];
          for (let i = 0; i < matches.length; i++) {
            const mark = matches[i].replace(markRegexp, '$1');
            marks.push(mark);
          }
        }
      }
    }
  });

  return {
    data,
    marks,
  };
}

/**
 * Processes `sdk/custom/scenes` to find JSON payloads and TTS marks.
 * @param dirHandler Handler to the `custom` directory
 * @param jsyaml JSYaml on the `window` object
 * @returns Processed JSON payloads and TTS marks in an object
 */
async function processSdkCustom(dirHandler: DirectoryHandler, jsyaml: JSYaml) {
  const data: string[] = [];
  const marks: string[] = [];
  const scenesDir = await dirHandler.getDirectoryHandle('scenes');
  await iterateDirectory(scenesDir, async (filename, handler) => {
    // Load <filename>
    const sourceFile = await handler.getFile();
    const sourceText = await sourceFile.text();
    const sourceTree = jsyaml.load(sourceText, 'utf-8') as SdkScene;

    // Look for Canvas Data in project source
    const intentEvents = sourceTree?.intentEvents || [];
    for (const intentEvent of intentEvents) {
      const candidates = intentEvent?.handler?.staticPrompt?.candidates || [];
      for (const candidate of candidates) {
        if (candidate?.promptResponse?.canvas?.data) {
          candidate.promptResponse.canvas.data.forEach((datum: {}) => {
            data.push(JSON.stringify(datum));
          });
        }
      }
      // Look for TTS Marks in project source
      for (const candidate of candidates) {
        if (candidate?.promptResponse?.firstSimple?.variants) {
          for (const variant of candidate?.promptResponse?.firstSimple
            ?.variants) {
            const matches = variant.speech?.match(markRegexp) || [];
            for (let i = 0; i < matches.length; i++) {
              const mark = matches[i].replace(markRegexp, '$1');
              marks.push(mark);
            }
          }
        }
      }
    }
  });

  return {
    data,
    marks,
  };
}

/**
 * Processes `sdk/webhooks/ActionsOnGoogleFulfillment` to find JSON payloads
 * and TTS marks.
 * @param dirHandler Handler to the `sdk` directory
 * @returns Processed JSON payloads and TTS marks in an object
 */
async function processSdkWebhooks(dirHandler: DirectoryHandler) {
  const data: string[] = [];
  const marks: string[] = [];

  // Look for Canvas Data in project source
  const canvasResponseRegex = new RegExp(
    'new Canvas\\({([\\w\\W]+?)}\\)',
    'gm'
  );
  const canvasDataRegex = new RegExp('data:\\s?({[\\w\\W]+?}),?', 'g');

  try {
    const webhooksDir = await dirHandler.getDirectoryHandle('webhooks');
    const webhooksFulfillmentDir = await webhooksDir.getDirectoryHandle(
      'ActionsOnGoogleFulfillment'
    );
    await iterateDirectory(
      webhooksFulfillmentDir,
      async (filename, handler) => {
        if (!filename.endsWith('js') && !filename.endsWith('ts')) return;

        // Load <filename>
        const sourceFile = await handler.getFile();
        const sourceText = await sourceFile.text();

        const canvasResponses = sourceText.match(canvasResponseRegex);
        for (let i = 0; i < canvasResponses!.length; i++) {
          const response = canvasResponses![i].replace(
            canvasResponseRegex,
            '$1'
          );
          if (!canvasDataRegex.test(response)) continue;

          const payload = response.replace(canvasDataRegex, '$1');
          data.push(payload);
        }

        // Look for TTS Marks in project source
        const markResponses = sourceText.match(markRegexp) || [];
        for (let i = 0; i < markResponses.length; i++) {
          const mark = markResponses[i].replace(markRegexp, '$1');
          marks.push(mark);
        }
      }
    );
  } catch (e) {
    // Okay, no webhooks in this directory
  }

  return {
    data,
    marks,
  };
}

/**
 * Traverses an `/sdk` directory in order to obtain useful data for the
 * extension. Will send a `interactiveCanvasReady` signal once processing
 * is complete so that it can communicate with the Chrome Extension.
 * @param mockWindow Mocked version of `window` object for testing.
 */
export async function processSdk(mockWindow?: InteractiveCanvasWindow) {
  const platform = mockWindow || window;

  platform.interactiveCanvasData = {data: [], marks: []};
  platform.interactiveCanvasReady = false;
  const dirHandler = await platform.showDirectoryPicker();
  const settingsDir = await dirHandler.getDirectoryHandle('settings');
  const settingsYaml = await settingsDir.getFileHandle('settings.yaml');
  const settingsFile = await settingsYaml.getFile();
  const settingsText = await settingsFile.text();
  const settingsObj = platform.jsyaml.load(
    settingsText,
    'utf-8'
  ) as SdkSettings;
  const title = settingsObj.localizedSettings.displayName;
  const projectId = settingsObj.projectId;
  const logoSrcData = await getActionLogo(dirHandler, settingsObj);
  window.interactiveCanvasHeader = {
    title,
    projectId,
    logoSrcData,
  };
  updateHeader();

  // Look for Canvas Data in Scenes
  const customDir = await dirHandler.getDirectoryHandle('custom');
  let {data, marks} = await processSdkGlobal(customDir, platform.jsyaml);
  platform.interactiveCanvasData.data.push(...data);
  platform.interactiveCanvasData.marks.push(...marks);

  ({data, marks} = await processSdkCustom(customDir, platform.jsyaml));
  platform.interactiveCanvasData.data.push(...data);
  platform.interactiveCanvasData.marks.push(...marks);

  ({data, marks} = await processSdkWebhooks(dirHandler));
  platform.interactiveCanvasData.data.push(...data);
  platform.interactiveCanvasData.marks.push(...marks);

  platform.interactiveCanvasReady = true;
  document.dispatchEvent(
    new MessageEvent('InteractiveCanvas_ProcessSdk', {
      data: {
        data: platform.interactiveCanvasData,
        ready: platform.interactiveCanvasReady,
      },
    })
  );
}

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
function updateHeader() {
  if (!window.interactiveCanvasHeader) {
    return console.debug('ICExt: No header data found. Try importing SDK.');
  }
  const {title, projectId, logoSrcData} = window.interactiveCanvasHeader;
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
  icon.src = logoSrcData;
  iconParent.appendChild(icon); // Insert our image
}

/**
 * Asynchronous method to get base64 version of an image file blob.
 * @param blob A binary large object representing a PNG file from the local
 * file system.
 * @returns Base 64 representation of PNG file.
 */
async function getImgData(blob: Blob): Promise<string> {
  return new Promise(res => {
    const fileReader = new FileReader();
    fileReader.readAsDataURL(blob);
    fileReader.onloadend = async () => {
      res(fileReader.result as string);
    };
  });
}

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

  window.interactiveCanvasProcessSdk = processSdk;
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
    case 'Ext-ShowHeader': {
      showHeader();
      break;
    }
    case 'Ext-ProcessSdk': {
      window.interactiveCanvasProcessSdk();
      break;
    }
  }
});
