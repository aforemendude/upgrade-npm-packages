import { describe, expect, it } from 'vitest';
import { getHelpMessage } from './get-help-message';

describe('getHelpMessage', () => {
  it('returns the complete help text for the installed binary', () => {
    expect(getHelpMessage()).toBe(
      [
        'Usage: upgrade-npm-packages [options]',
        '',
        'Options:',
        '  --force-reinstall  Refresh package locks and node_modules after upgrading dependencies',
        '  -h, --help         Show this help message',
      ].join('\n'),
    );
  });
});
