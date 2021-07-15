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

import {Component} from '@angular/core';
import {MatTabChangeEvent} from '@angular/material/tabs';
import {ChromeBridgeService} from './chrome-bridge.service';
import {PreferencesService} from './preferences.service';

/**
 * Primary component that encompasses the Chrome Extension.
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'interactive-canvas-extension';
  chromeBridge: ChromeBridgeService;
  preferences: PreferencesService;

  constructor(
    chromeBridge: ChromeBridgeService,
    preferences: PreferencesService
  ) {
    this.chromeBridge = chromeBridge;
    this.preferences = preferences;
  }

  /**
   * Event that executes when the selected tab changes. This can be used to
   * pull or push data between the extension and client. Currently it will
   * re-fetch the Interactive Canvas app history.
   * @param event Generated event on each tab change
   */
  async tabChanged(event: MatTabChangeEvent) {
    const {index} = event;
    const debugExtension = await this.preferences.getFlagDebugExtension();
    if (debugExtension) {
      console.log('Open tab', index);
    }
    // Re-fetch history, which will re-activate history subject
    await this.chromeBridge.fetchHistory();
  }
}
