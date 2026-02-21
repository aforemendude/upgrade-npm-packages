import { describe, it, expect, vi } from 'vitest';
import { getLatestVersion, getLatestVersionOfMajor, installPackages } from './npm';

vi.mock('child_process', () => ({
  execFile: vi.fn((_cmd: string, args: string[], optionsOrCallback: any, callback?: any) => {
    const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
    // getLatestVersion
    if (args[0] === 'view' && args[1] === 'typescript' && args[2] === 'version') {
      cb(null, { stdout: '5.0.0\n' });
    }
    // getLatestVersionOfMajor success (array)
    else if (args[0] === 'view' && args[1] === '@types/node@18' && args[2] === 'version' && args[3] === '--json') {
      cb(null, { stdout: '["18.0.0", "18.1.1"]\n' });
    }
    // getLatestVersionOfMajor success (string)
    else if (args[0] === 'view' && args[1] === '@types/node@20' && args[2] === 'version' && args[3] === '--json') {
      cb(null, { stdout: '"20.0.0"\n' });
    }
    // installPackages
    else if (args[0] === 'install') {
      cb(null, { stdout: 'added 1 package\n' });
    }
    // Mock error
    else {
      cb(new Error('Mock error'), { stdout: '' });
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

  describe('installPackages', () => {
    it('should run npm install', async () => {
      await expect(installPackages('./')).resolves.not.toThrow();
    });
  });
});
