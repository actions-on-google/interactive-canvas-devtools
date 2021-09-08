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

/**
 * Converts a user-provided JSON string to a properly formatted JSON string.
 *
 * @example
 * ```
 * User: { key: 'value' }
 * Output: {"key": "value"}
 * ```
 *
 * @param jsonlike A string that resembles JSON with minor syntax issues.
 * @returns A properly-constructed JSON object.
 */
export default function (jsonlike: string) {
  const repaired = jsonlike
    // key: "value" => "key": "value"
    .replace(/([\w.]+):/g, '"$1":')
    // "key": 'value' => "key": "value"
    .replace(/'([\w.]+)'/g, '"$1"')
    .replace(/\n/g, '')
    .replace(/\s\s/g, '')
    .replace(/, }/g, '}')
    .replace(/,}/g, '}')
    .replace(/{ "/g, '{"')
    .replace(/" }/g, '"}')
    .trim();
  return repaired;
}
