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
   * Checks if the connected webpage has Interactive Canvas.
   * @returns True if interactiveCanvas exists on the page
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

  async sendOnUpdate(object: string) {
    // Update history
    this.payloadsSet.add(object);
    this.payloadSubject.next([...this.payloadsSet]);

    // Dispatch
    if (this.isRemoteTarget) {
      // Send unparsed text
      await this.execOnRemoteTab(
        `window.interactiveCanvas.a.m.onUpdate([${object}])`
      );
    } else {
      await this.broadcastMessage('payload', [JSON.parse(object)]);
    }
  }

  async sendOnTtsMark(mark: string) {
    // Update history
    this.marksSet.add(mark);
    this.marksSubject.next([...this.marksSet]);

    // Dispatch
    if (this.isRemoteTarget) {
      // Send unparsed text
      await this.execOnRemoteTab(
        `window.interactiveCanvas.a.m.onTtsMark([${mark}])`
      );
    } else {
      await this.broadcastMessage('TtsEndpointEvent', mark);
    }
  }

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
}
