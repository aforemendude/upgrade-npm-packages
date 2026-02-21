import { describe, it, expect, vi, beforeEach } from 'vitest';
import spawn from 'cross-spawn';
import { getLatestVersion, getLatestVersionOfMajor, installPackages } from './npm';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

vi.mock('cross-spawn', () => ({
  default: vi.fn(),
}));

function createMockChild(stdout: string, code = 0) {
  const child = new EventEmitter() as EventEmitter & { stdout: Readable; stderr: Readable };
  child.stdout = new Readable({ read() {} });
  child.stderr = new Readable({ read() {} });
  setImmediate(() => {
    child.stdout.push(stdout);
    child.stdout.push(null);
    child.stderr.push(null);
    child.emit('close', code);
  });
  return child;
}

function setupSpawnMock() {
  vi.mocked(spawn).mockImplementation((_cmd, args) => {
    const a = args as string[];
    // getLatestVersion
    if (a[0] === 'view' && a[1] === 'typescript' && a[2] === 'version') {
      return createMockChild('5.0.0\n') as any;
    }
    // getLatestVersionOfMajor success (array)
    if (a[0] === 'view' && a[1] === '@types/node@18' && a[2] === 'version' && a[3] === '--json') {
      return createMockChild('["18.0.0", "18.1.1"]\n') as any;
    }
    // getLatestVersionOfMajor success (string)
    if (a[0] === 'view' && a[1] === '@types/node@20' && a[2] === 'version' && a[3] === '--json') {
      return createMockChild('"20.0.0"\n') as any;
    }
    // installPackages
    if (a[0] === 'install') {
      return createMockChild('added 1 package\n') as any;
    }
    // error
    return createMockChild('', 1) as any;
  });
}

describe('npm util', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSpawnMock();
  });

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

  describe('cross-platform support', () => {
    it('should spawn npm with shell: false', async () => {
      await getLatestVersion('typescript');
      expect(spawn).toHaveBeenCalledWith(
        'npm',
        ['view', 'typescript', 'version'],
        expect.objectContaining({ shell: false }),
      );
    });
  });
});
