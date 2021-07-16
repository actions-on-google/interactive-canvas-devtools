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

/// <reference types="chrome"/>
import {Injectable} from '@angular/core';
import {v4 as uuidv4} from 'uuid';
import {Subject} from 'rxjs';

import {CanvasHistory, InteractiveCanvasWindow} from 'src/types';
import {PreferencesService} from './preferences.service';
import jsonRepair from 'src/utils/json-repair';

declare let window: InteractiveCanvasWindow;

/**
 * A service that serves as the intermediary between the Chrome Extension and
 * the webpage.
 */
@Injectable({
  providedIn: 'root',
})
export class ChromeBridgeService {
  isRemoteTarget = false;
  currentWindow?: chrome.tabs.Tab;
  private payloadsSet = new Set<string>();
  payloadSubject = new Subject<string[]>();
  private marksSet = new Set<string>();
  marksSubject = new Subject<string[]>();
  historySubject = new Subject<CanvasHistory[]>();
  preferences: PreferencesService;

  constructor(preferences: PreferencesService) {
    this.init();
    this.preferences = preferences;
  }

  private async init() {
    const queryResults = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (queryResults.length > 0) {
      this.currentWindow = queryResults[0];
    } else {
      const activeTabs = await chrome.tabs.query({
        active: true,
      });
      this.currentWindow = activeTabs[0];
      this.isRemoteTarget = true;
      // Inject
      await this.execOnRemoteTab(`
        window.interactiveCanvasHistory = []
        window.interactiveCanvas.sendTextQuery = (text) => {
          window.interactiveCanvasHistory.push({title: text, time: Date.now()})
        }
        window.interactiveCanvas.setCanvasState = (state) => {
          window.interactiveCanvasHistory.push({title: JSON.stringify(state), time: Date.now()})
        }
      `);
    }
    // Sync API behavior with webpage.
    await this.updateUnsupportedApiBehavior(
      await this.preferences.getUnsupportedApiBehavior()
    );
  }

  /**
   * Executes a given function in the context of a content script.
   * @see https://developer.chrome.com/docs/extensions/reference/scripting/#method-executeScript
   * @param fn Function to execute
   * @returns Nominally returns result of execution
   */
  private async execOnLocalTab<T>(fn: () => T) {
    if (!this.currentWindow) throw new Error('Cannot access window');

    return new Promise<T>(res => {
      chrome.scripting.executeScript(
        {
          target: {tabId: this.currentWindow!.id!, allFrames: true},
          function: fn,
        },
        (results: chrome.scripting.InjectionResult[]) => {
          res(results[0].result as T);
        }
      );
    });
  }

  /**
   * Executes a given set of code in the direct context of the webpage.
   * Executing JavaScript as a string is less safe, but does work for
   * remote devices.
   * @see https://developer.chrome.com/docs/extensions/mv3/devtools/#evaluating-js
   * @param js Code to execute as a string
   * @returns Nominally returns result of execution
   */
  private async execOnRemoteTab<T>(js: string) {
    if (!this.currentWindow) throw new Error('Cannot access window');

    const frameURL: string = await new Promise(res => {
      chrome.devtools.inspectedWindow.eval(
        'document.getElementsByTagName("iframe")[0].src',
        (result: string) => {
          res(result as string);
        }
      );
    });

    return new Promise<T>(res => {
      chrome.devtools.inspectedWindow.eval(
        js,
        {
          frameURL,
        },
        (result: T) => {
          res(result as T);
        }
      );
    });
  }

  /**
   * Sends a MessageEvent to the webpage, where it may be processed by behavior
   * on the page directly or through a listener in `webpage-script`.
   * @param type String message type
   * @param data Data to be sent along with the message, dependent on message type
   */
  private async broadcastMessage(type: string, data: object | string) {
    const requestId = uuidv4();
    // https://stackoverflow.com/questions/17567624/pass-a-parameter-to-a-content-script-injected-using-chrome-tabs-executescript
    chrome.storage.local.set({
      data,
      debugClient: await this.preferences.getFlagDebugClient(),
      requestId,
      type,
    });
    await this.execOnLocalTab(() => {
      chrome.storage.local.get(
        ['data', 'debugClient', 'requestId', 'type'],
        (keys: Record<string, object | string>) => {
          const {data, debugClient, requestId, type} = keys;
          const msgData = {
            data: {
              type,
              requestId,
              data,
            },
          };
          if (debugClient) {
            console.debug('Dispatching', msgData);
          }
          document.dispatchEvent(new MessageEvent('message', msgData));
        }
      );
    });
  }

  /**
   * Checks if the connected webpage has Interactive Canvas.
   * @returns True if interactiveCanvas exists on the page
   */
  async hasInteractiveCanvas() {
    // Cannot access modified elements on `window`
    // Get the window.interactiveCanvasExists from `content_script.js`
    // https://stackoverflow.com/questions/12395722/can-the-window-object-be-modified-from-a-chrome-extension
    let res = false;
    if (this.isRemoteTarget) {
      res = await this.execOnRemoteTab<boolean>(
        'window.interactiveCanvas !== undefined'
      );
    } else {
      res = await this.execOnLocalTab<boolean>(() => {
        return window.interactiveCanvasExists;
      });
    }
    return res;
  }

  /**
   * Triggers an `onUpdate` callback in Interactive Canvas.
   * @see https://developers.google.com/assistant/interactivecanvas/reference#onupdate
   * @param object JSON string to send to the webpage
   */
  async sendOnUpdate(object: string) {
    // Update history
    this.payloadsSet.add(object);
    this.payloadSubject.next([...this.payloadsSet]);

    // Dispatch
    if (this.isRemoteTarget) {
      // Send unparsed text
      await this.execOnRemoteTab(
        `window.interactiveCanvas.g.G.onUpdate([${object}])`
      );
    } else {
      await this.broadcastMessage('payload', [JSON.parse(object)]);
    }
  }

  /**
   * Triggers an `onTtsMark` callback in Interactive Canvas.
   * @see https://developers.google.com/assistant/interactivecanvas/reference#onttsmark
   * @param mark Mark to send to the webpage
   */
  async sendOnTtsMark(mark: string) {
    // Update history
    this.marksSet.add(mark);
    this.marksSubject.next([...this.marksSet]);

    // Dispatch
    if (this.isRemoteTarget) {
      // Send unparsed text
      await this.execOnRemoteTab(
        `window.interactiveCanvas.g.G.onTtsMark([${mark}])`
      );
    } else {
      await this.broadcastMessage('TtsEndpointEvent', mark);
    }
  }

  /**
   * Obtains history of Interactive Canvas events from `content-script`.
   */
  async fetchHistory(): Promise<void> {
    let history: CanvasHistory[] = [];
    if (this.isRemoteTarget) {
      history = await this.execOnRemoteTab('window.interactiveCanvasHistory');
    } else {
      history = await this.execOnLocalTab(
        () => window.interactiveCanvasHistory
      );
    }
    if (await this.preferences.getFlagDebugExtension()) {
      console.debug('History', history);
    }
    this.historySubject.next(history);
  }

  /**
   * Utility function to add CSS to the webpage.
   * @see https://developer.chrome.com/docs/extensions/reference/scripting/#method-insertCSS
   * @param css Styles to add to the webpage
   */
  private async addStyle(css: string) {
    chrome.scripting.insertCSS({
      target: {tabId: this.currentWindow!.id!},
      css,
    });
  }

  /**
   * Inserts HTML elements in the webpage to emulate a header that would
   * appear in an Interactive Canvas app on-device. It is optionally called
   * in the Preferences tab.
   */
  async injectHeaderDom() {
    if (this.isRemoteTarget)
      throw new Error('Function unavailable on remote targets');

    await this.addStyle(`
      .ic-ext-banner {
        width: 100vw;
        height: 56px;
        position: fixed;
        left: 0;
        top: 0;
        background-color: #efefef;
        border: solid 1px #ccc;
        z-index: 998;
      }
      .ic-ext-icon {
        width: 48px;
        height: 48px;
        background-color: #555;
        border-radius: 48px;
        position: fixed;
        z-index: 999;
        left: 16px;
        top: 4px;
      }
      .ic-ext-title {
        position: fixed;
        z-index: 999;
        left: 80px;
        top: 18px;
        font-family: sans-serif;
      }
    `);

    await this.broadcastMessage('Ext-ShowHeader', {});
  }

  /**
   * Sends a command to the webpage to open a directory picker so the developer
   * can select their project's SDK folder and then receive suggested TTS marks,
   * JSON payloads, and more accurate header (see `injectHeaderDom`).
   *
   * This is a long-term event, so the extension cannot directly grab results
   * from the execution. It needs to know when the execution has ended.
   * As such, this function will periodically (every 500ms) check for a value
   * on the page called `interactiveCanvasReady` and use that as a signal
   * to know the processing is complete.
   *
   * Once complete, data that was processed in the webpage context will be
   * obtained and added to the extension.
   */
  async loadSdk() {
    if (this.isRemoteTarget)
      throw new Error('Function unavailable on remote targets');

    await this.broadcastMessage('Ext-ProcessSdk', {});

    // Block until previous op is done
    let ready = false;
    const interval = setInterval(async () => {
      // Exfiltrate filedata parse
      ready = await this.execOnLocalTab<boolean>(
        () => window.interactiveCanvasReady
      );
      if (ready) {
        clearInterval(interval);

        const parsedDataPayloads = await this.execOnLocalTab(
          () => window.interactiveCanvasData
        );

        if (await this.preferences.getFlagDebugExtension()) {
          console.debug('Process SDK Received', parsedDataPayloads);
        }

        for (const payload of parsedDataPayloads.data) {
          const payloadJson = jsonRepair(payload);
          this.payloadsSet.add(payloadJson);
        }
        this.payloadSubject.next([...this.payloadsSet]);

        for (const mark of parsedDataPayloads.marks) {
          this.marksSet.add(mark);
        }
        this.marksSubject.next([...this.marksSet]);
      }
    }, 500);
  }

  /**
   * Method that is called by `tab-preferences` when the `unsupportedApiBehavior`
   * value is changed, in order to broadcast this change with the webpage.
   * @param newValue The updated warning level
   */
  async updateUnsupportedApiBehavior(newValue = 'off') {
    await this.broadcastMessage('Ext-UnsupportedApiBehavior', newValue);
  }
}
