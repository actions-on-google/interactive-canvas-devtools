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
import test from 'ava';
import jsonRepair from './json-repair';

test('Fix quotes in JSON string', t => {
  const expected = '{"command": "START_GAME"}';
  const example1 = '{command: "START_GAME"}';
  const example2 = "{command: 'START_GAME'}";
  const example3 = "{'command': 'START_GAME'}";
  [example1, example2, example3].forEach(ex => {
    const actual = jsonRepair(ex);
    t.is(actual, expected);
  });
});

test('Fix spacing in JSON string', t => {
  const expected = '{"command": "START_GAME"}';
  const example1 = `{
    "command": "START_GAME"
  }`;
  const example2 = '{  "command": "START_GAME"  }';
  [example1, example2].forEach(ex => {
    const actual = jsonRepair(ex);
    t.is(actual, expected);
  });
});

test('Fix commas in JSON string', t => {
  const expected = '{"command": "START_GAME"}';
  const example1 = '{"command": "START_GAME",}';
  [example1].forEach(ex => {
    const actual = jsonRepair(ex);
    t.is(actual, expected);
  });
});
