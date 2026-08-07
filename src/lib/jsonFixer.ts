// Best-effort auto-repair for common "almost JSON" mistakes.
// Regex-based on purpose — good enough for the common case, never silently
// applied without the caller showing the user a diff first.

export function attemptFix(input: string): string {
  let fixed = input;
  fixed = stripTrailingCommas(fixed);
  fixed = singleToDoubleQuotes(fixed);
  fixed = quoteUnquotedKeys(fixed);
  return fixed;
}

function stripTrailingCommas(input: string): string {
  return input.replace(/,(\s*[}\]])/g, '$1');
}

function singleToDoubleQuotes(input: string): string {
  return input.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
}

function quoteUnquotedKeys(input: string): string {
  return input.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)(\s*:)/g, '$1"$2"$3');
}
