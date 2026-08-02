import { describe, expect, it } from 'vitest';
import { parseNpmJsonOutput } from './parse-npm-json-output';

describe('parseNpmJsonOutput', () => {
  it.each(['', '   \n', 'undefined', '  undefined\n'])('returns the fallback for %p', (output) => {
    const fallback = { versions: [] };

    expect(parseNpmJsonOutput(output, fallback)).toBe(fallback);
  });

  it('parses trimmed JSON output', () => {
    expect(parseNpmJsonOutput(' \n {"versions":["1.0.0"],"deprecated":false}\n', null)).toEqual({
      deprecated: false,
      versions: ['1.0.0'],
    });
  });

  it('propagates a syntax error for malformed JSON', () => {
    expect(() => parseNpmJsonOutput('{invalid', null)).toThrow(SyntaxError);
  });
});
