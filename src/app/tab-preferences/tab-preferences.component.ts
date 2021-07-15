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

import {Component, OnInit} from '@angular/core';
import {MatSlideToggleChange} from '@angular/material/slide-toggle';
import {MatRadioChange} from '@angular/material/radio';
import {ChromeBridgeService} from '../chrome-bridge.service';
import {PreferencesService} from '../preferences.service';

/**
 * The Preferences tab displays available session-level capablities. It also
 * presents a number of extension settings to provide more developer control
 * over the debugging.
 */
@Component({
  selector: 'tab-preferences',
  templateUrl: './tab-preferences.component.html',
  styleUrls: ['./tab-preferences.component.css'],
})
export class TabPreferencesComponent implements OnInit {
  preferences: PreferencesService;
  preferencesDebugClient = false;
  preferencesDebugExtension = false;
  preferencesUnsupportedApi = 'off';

  isRemoteTarget = false;
  chromeBridge: ChromeBridgeService;

  constructor(
    preferences: PreferencesService,
    chromeBridge: ChromeBridgeService
  ) {
    this.preferences = preferences;
    this.isRemoteTarget = chromeBridge.isRemoteTarget;
    this.chromeBridge = chromeBridge;
  }

  async ngOnInit(): Promise<void> {
    this.preferencesDebugClient = await this.preferences.getFlagDebugClient();
    this.preferencesDebugExtension =
      await this.preferences.getFlagDebugExtension();
    this.preferencesUnsupportedApi =
      (await this.preferences.getUnsupportedApiBehavior()) || 'off';
  }

  /**
   * Click handler to show header on the webpage.
   */
  showHeader() {
    this.chromeBridge.injectHeaderDom();
  }

  /**
   * Click handler to prompt the user for the project SDK folder.
   */
  loadSdk() {
    this.chromeBridge.loadSdk();
  }

  /**
   * Click handler when the Debug Client toggle is changed.
   * @param event Toggle event
   */
  async onChangeDebugClient(event: MatSlideToggleChange) {
    const {checked} = event;
    this.preferencesDebugClient = checked;
    await this.preferences.setFlagDebugClient(checked);
  }

  /**
   * Click handler when the Debug Extension toggle is changed.
   * @param event Toggle event
   */
  async onChangeDebugExtension(event: MatSlideToggleChange) {
    const {checked} = event;
    this.preferencesDebugExtension = checked;
    await this.preferences.setFlagDebugExtension(checked);
  }

  /**
   * Click handler when the Unsupported API level radio button is changed.
   * @param event Toggle event
   */
  async onChangeUnsupportedApi(event: MatRadioChange) {
    const {value} = event;
    this.preferencesUnsupportedApi = value;
    await this.preferences.setUnsupportedApiBehavior(value);
    // Sync this changed value with webpage
    await this.chromeBridge.updateUnsupportedApiBehavior(value);
  }
}
