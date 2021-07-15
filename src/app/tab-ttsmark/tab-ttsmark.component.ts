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
import {ChromeBridgeService} from '../chrome-bridge.service';

/**
 * The TTS Mark tab allows one to send a custom TTS mark to the client.
 * Suggestion chips appear below the input prompt to fill in the prompt.
 */
@Component({
  selector: 'tab-ttsmark',
  templateUrl: './tab-ttsmark.component.html',
  styleUrls: ['./tab-ttsmark.component.css'],
})
export class TabTtsmarkComponent implements OnInit {
  markInput?: string;
  marks: string[] = ['START', 'END'];
  chromeBridge: ChromeBridgeService;

  constructor(chromeBridge: ChromeBridgeService) {
    this.chromeBridge = chromeBridge;
  }

  ngOnInit(): void {
    this.chromeBridge.marksSubject.subscribe((marks: string[]) => {
      this.marks = marks;
    });
  }

  /**
   * Click handler for suggestion chips, which will update the value of
   * the input field.
   * @param mark TTS Mark being selected
   */
  prepopulate(mark: string) {
    this.markInput = mark;
  }

  /**
   * Sends a TTS Mark to the client.
   */
  run() {
    this.chromeBridge.sendOnTtsMark(this.markInput || '');
  }
}
