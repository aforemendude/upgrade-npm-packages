import { describe, it, expect, vi } from 'vitest';
import { getLatestVersion, getLatestVersionOfMajor } from './npm';

vi.mock('child_process', () => ({
  execFile: vi.fn((_cmd, args, callback) => {
    // getLatestVersion
    if (args[0] === 'view' && args[1] === 'typescript' && args[2] === 'version') {
      callback(null, { stdout: '5.0.0\n' });
    }
    // getLatestVersionOfMajor success (array)
    else if (args[0] === 'view' && args[1] === '@types/node@18' && args[2] === 'version' && args[3] === '--json') {
      callback(null, { stdout: '["18.0.0", "18.1.1"]\n' });
    }
    // getLatestVersionOfMajor success (string)
    else if (args[0] === 'view' && args[1] === '@types/node@20' && args[2] === 'version' && args[3] === '--json') {
      callback(null, { stdout: '"20.0.0"\n' });
    }
    // Mock error
    else {
      callback(new Error('Mock error'), { stdout: '' });
    }
  }),
}));

describe('npm util', () => {
  describe('getLatestVersion', () => {
    it('should fetch latest version', async () => {
      const version = await getLatestVersion('typescript');
      expect(version).toBe('5.0.0');
    });

    it('should handle errors', async () => {
      const version = await getLatestVersion('non-existent-package');
      expect(version).toBe('');
    });
  });

  describe('getLatestVersionOfMajor', () => {
    it('should fetch latest version of major (array response)', async () => {
      const version = await getLatestVersionOfMajor('@types/node', 18);
      expect(version).toBe('18.1.1');
    });

    it('should fetch latest version of major (string response)', async () => {
      const version = await getLatestVersionOfMajor('@types/node', 20);
      expect(version).toBe('20.0.0');
    });

    it('should handle errors', async () => {
      const version = await getLatestVersionOfMajor('non-existent-package', 1);
      expect(version).toBe('');
    });
  });
});
