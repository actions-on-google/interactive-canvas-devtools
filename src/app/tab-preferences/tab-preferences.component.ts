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
import {ChromeBridgeService} from '../chrome-bridge.service';
import {PreferencesService} from '../preferences.service';

@Component({
  selector: 'tab-preferences',
  templateUrl: './tab-preferences.component.html',
  styleUrls: ['./tab-preferences.component.css'],
})
export class TabPreferencesComponent implements OnInit {
  preferences: PreferencesService;
  preferencesDebugClient = false;
  preferencesDebugExtension = false;
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
  }

  showHeader() {
    this.chromeBridge.injectHeaderDom();
  }

  async onChangeDebugClient(event: MatSlideToggleChange) {
    const {checked} = event;
    this.preferencesDebugClient = checked;
    await this.preferences.setFlagDebugClient(checked);
  }

  async onChangeDebugExtension(event: MatSlideToggleChange) {
    const {checked} = event;
    this.preferencesDebugExtension = checked;
    await this.preferences.setFlagDebugExtension(checked);
  }
}
