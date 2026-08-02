import { describe, expect, it } from 'vitest';
import { getHelpMessage } from './get-help-message';

describe('getHelpMessage', () => {
  it('uses the installed binary name in the usage line', () => {
    expect(getHelpMessage()).toContain('Usage: upgrade-npm-packages [options]');
  });
});
