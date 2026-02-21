import { describe, it, expect, vi } from 'vitest';
import { getLatestVersion } from './npm';

vi.mock('child_process', () => ({
  execFile: vi.fn((cmd, args, callback) => {
    if (
      args[0] === 'view' &&
      args[1] === 'typescript' &&
      args[2] === 'version'
    ) {
      callback(null, { stdout: '5.0.0\n' });
    } else {
      callback(new Error('Mock error'), { stdout: '' });
    }
  }),
}));

describe('npm util', () => {
  it('should fetch latest version', async () => {
    const version = await getLatestVersion('typescript');
    expect(version).toBe('5.0.0');
  });

  it('should handle errors', async () => {
    const version = await getLatestVersion('non-existent-package');
    expect(version).toBe('');
  });
});
