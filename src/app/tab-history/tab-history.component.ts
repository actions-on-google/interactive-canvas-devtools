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

import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import * as dayjs from 'dayjs';
import * as relativeTime from 'dayjs/plugin/relativeTime';
import {CanvasHistory} from '../../types';
import {ChromeBridgeService} from '../chrome-bridge.service';

/// <reference types="node" />
const JSONFormat = require('json-format');
const Diff = require('diff');

type DiffPart = {
  added: boolean;
  removed: boolean;
  value: string;
};

dayjs.extend(relativeTime); // use plugin

interface SortedCanvasHistory extends CanvasHistory {
  relativeTime: string;
}

@Component({
  selector: 'tab-history',
  templateUrl: './tab-history.component.html',
  styleUrls: ['./tab-history.component.css'],
})
export class TabHistoryComponent implements OnInit {
  @ViewChild('partDiff') partDiff!: ElementRef;
  showList = true;
  sortedHistory: SortedCanvasHistory[] = [];
  chromeBridge: ChromeBridgeService;

  constructor(chromeBridge: ChromeBridgeService) {
    this.chromeBridge = chromeBridge;
  }

  ngOnInit(): void {
    this.chromeBridge.historySubject.subscribe(history => {
      if (history === null) return; // Do nothing
      this.sortedHistory = history.reverse().map(k => {
        return {
          ...k,
          relativeTime: dayjs().to(dayjs(k.timestamp)),
        };
      });
    });
  }

  openDiff(index: number): void {
    // Add listener for diff
    const entryCurrent = this.sortedHistory[index];
    const entryPrev = this.sortedHistory
      .slice(index + 1)
      .find(h => h.type === 'state');
    const formatConfig = {
      type: 'space',
      size: 4,
    };
    const formatCurrent = JSONFormat(
      JSON.parse(entryCurrent.label),
      formatConfig
    ).replace(/\n/g, '<br>');

    if (entryPrev !== undefined) {
      this.partDiff.nativeElement.innerHTML = '';
      const formatLast = JSONFormat(
        JSON.parse(entryPrev.label),
        formatConfig
      ).replace(/\n/g, '<br>');

      const diff = Diff.diffWords(formatLast, formatCurrent);
      // Apply colors
      diff.forEach((part: DiffPart) => {
        const partClass = part.added
          ? 'diff-added'
          : part.removed
          ? 'diff-removed'
          : 'diff-neutral';
        const span = document.createElement('span');
        span.classList.add(partClass);
        span.innerHTML = part.value;
        this.partDiff.nativeElement.appendChild(span);
      });
    } else {
      this.partDiff.nativeElement.innerHTML = formatCurrent;
    }
    this.showList = false;
  }

  exitDiff() {
    this.showList = true;
  }
}
