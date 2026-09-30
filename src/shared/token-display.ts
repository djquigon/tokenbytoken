// How token text is shown and spoken (CLAUDE.md §8): whitespace gets readable symbols, and screen
// readers hear names ("space", "newline") instead of silence.

const VISIBLE: Readonly<Record<string, string>> = {
  ' ': '␣',
  '\n': '↵',
  '\t': '⇥',
  '\r': '␍',
};

const SPOKEN: Readonly<Record<string, string>> = {
  ' ': 'space',
  '\n': 'newline',
  '\t': 'tab',
  '\r': 'carriage return',
  '‍': 'zero-width joiner',
  ' ': 'non-breaking space',
};

/** Token text with whitespace made visible, for chips and tables. */
export const visibleTokenText = (text: string): string =>
  Array.from(text, (ch) => VISIBLE[ch] ?? (ch === '‍' ? '‹ZWJ›' : ch)).join('');

/** A spoken description of a token's text, e.g. `space "the"` or `newline, newline`. */
export function spokenTokenText(text: string): string {
  if (text.length === 0) return 'empty';
  const parts: string[] = [];
  let word = '';
  for (const ch of Array.from(text)) {
    const name = SPOKEN[ch];
    if (name) {
      if (word) parts.push(`"${word}"`);
      word = '';
      parts.push(name);
    } else {
      word += ch;
    }
  }
  if (word) parts.push(`"${word}"`);
  return parts.join(', ');
}
