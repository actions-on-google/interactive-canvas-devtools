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
