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

/// <reference path="../../node_modules/@types/chrome/index.d.ts"/>
import {Injectable} from '@angular/core';

/**
 * Every setting should have getters/setters that work with Chrome storage API.
 * See https://developer.chrome.com/docs/extensions/reference/storage/
 */
interface ExtensionPreferences {
  /**
   * Flag that, when enabled, logs to extension console.
   */
  flagDebugExtension: boolean;
  /**
   * Flag that, when enabled, sends logs in webpage context.
   */
  flagDebugClient: boolean;
}

type ExtensionPreference = keyof ExtensionPreferences;

@Injectable({
  providedIn: 'root',
})
export class PreferencesService {
  constructor() {}

  async getFlagDebugExtension() {
    return this.readPreference<boolean>('flagDebugExtension');
  }

  async setFlagDebugExtension(value: boolean) {
    return this.writePreference<boolean>('flagDebugExtension', value);
  }

  async getFlagDebugClient() {
    return this.readPreference<boolean>('flagDebugClient');
  }

  async setFlagDebugClient(value: boolean) {
    return this.writePreference<boolean>('flagDebugClient', value);
  }

  private async readPreference<T>(key: ExtensionPreference): Promise<T> {
    return new Promise(res => {
      chrome.storage.sync.get(key, (result: Record<string, T>) => {
        res(result[key] as T);
      });
    });
  }

  private async writePreference<T>(key: ExtensionPreference, value: T) {
    return new Promise(res => {
      chrome.storage.sync.set({[key]: value}, () => {
        res(undefined);
      });
    });
  }
}
