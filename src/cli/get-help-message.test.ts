import { describe, expect, it } from 'vitest';
import { getHelpMessage } from './get-help-message';

describe('getHelpMessage', () => {
  it('returns the complete help text for the installed binary', () => {
    expect(getHelpMessage()).toBe(
      [
        'Usage: upgrade-npm-packages [options]',
        '',
        'Options:',
        '  --allow-dirty      Allow upgrades when the Git worktree has uncommitted changes',
        '  --allow-symlinks   Allow symbolic-link manifests, including targets outside the scanned directory',
        '  --force-reinstall  Refresh package locks and node_modules after upgrading dependencies',
        '  --no-color         Disable ANSI colors in output',
        '  -h, --help         Show this help message',
      ].join('\n'),
    );
  });
});
