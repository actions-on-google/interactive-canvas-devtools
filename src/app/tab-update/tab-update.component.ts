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
import jsonRepair from '../../utils/json-repair';
import {ChromeBridgeService} from '../chrome-bridge.service';

@Component({
  selector: 'tab-update',
  templateUrl: './tab-update.component.html',
  styleUrls: ['./tab-update.component.css'],
})
export class TabUpdateComponent implements OnInit {
  updateInput?: string;
  payloads: string[] = [];
  chromeBridge: ChromeBridgeService;

  constructor(chromeBridge: ChromeBridgeService) {
    this.chromeBridge = chromeBridge;
  }

  ngOnInit(): void {
    this.chromeBridge.payloadSubject.subscribe((payloads: string[]) => {
      this.payloads = payloads;
    });
  }

  prepopulate(payload: string) {
    this.updateInput = payload;
  }

  run() {
    const json = jsonRepair(this.updateInput || '{}');
    this.chromeBridge.sendOnUpdate(json);
  }
}
