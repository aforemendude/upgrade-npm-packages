import { describe, it, expect, vi, beforeEach } from 'vitest';
import spawn from 'cross-spawn';
import { getLatestVersion, getLatestVersionOfMajor, installPackages } from './npm';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

vi.mock('cross-spawn', () => ({
  default: vi.fn(),
}));

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number) {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString();
}

function createTimeResponse(times: Record<string, string>) {
  return JSON.stringify({ created: daysAgo(300), modified: daysAgo(1), ...times }) + '\n';
}

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
    if (a[0] === 'view' && a[1] === 'typescript' && a[2] === 'versions' && a[3] === '--json') {
      return createMockChild('["4.9.0", "5.0.0", "5.1.0", "6.0.0-beta.1"]\n') as any;
    }
    if (a[0] === 'view' && a[1] === 'typescript' && a[2] === 'time' && a[3] === '--json') {
      return createMockChild(
        createTimeResponse({
          '4.9.0': daysAgo(40),
          '5.0.0': daysAgo(8),
          '5.1.0': daysAgo(1),
          '6.0.0-beta.1': daysAgo(30),
        }),
      ) as any;
    }
    // current version should not be downgraded
    if (a[0] === 'view' && a[1] === 'fresh-current' && a[2] === 'versions' && a[3] === '--json') {
      return createMockChild('["1.0.0", "2.0.0"]\n') as any;
    }
    if (a[0] === 'view' && a[1] === 'fresh-current' && a[2] === 'time' && a[3] === '--json') {
      return createMockChild(createTimeResponse({ '1.0.0': daysAgo(40), '2.0.0': daysAgo(1) })) as any;
    }
    // no old enough published version
    if (a[0] === 'view' && a[1] === 'brand-new' && a[2] === 'versions' && a[3] === '--json') {
      return createMockChild('["1.0.0"]\n') as any;
    }
    if (a[0] === 'view' && a[1] === 'brand-new' && a[2] === 'time' && a[3] === '--json') {
      return createMockChild(createTimeResponse({ '1.0.0': daysAgo(1) })) as any;
    }
    // getLatestVersionOfMajor success (array)
    if (a[0] === 'view' && a[1] === '@types/node@18' && a[2] === 'version' && a[3] === '--json') {
      return createMockChild('["18.0.0", "18.1.1", "18.2.0"]\n') as any;
    }
    // getLatestVersionOfMajor success (string)
    if (a[0] === 'view' && a[1] === '@types/node@20' && a[2] === 'version' && a[3] === '--json') {
      return createMockChild('"20.0.0"\n') as any;
    }
    if (a[0] === 'view' && a[1] === '@types/node' && a[2] === 'time' && a[3] === '--json') {
      return createMockChild(
        createTimeResponse({
          '18.0.0': daysAgo(30),
          '18.1.1': daysAgo(8),
          '18.2.0': daysAgo(1),
          '20.0.0': daysAgo(30),
        }),
      ) as any;
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
    it('should fetch latest version at least seven days old', async () => {
      const version = await getLatestVersion('typescript');
      expect(version).toBe('5.0.0');
    });

    it('should not return an older eligible version when the current version is newer', async () => {
      const version = await getLatestVersion('fresh-current', '2.0.0');
      expect(version).toBe('');
    });

    it('should return empty when no version is at least seven days old', async () => {
      const version = await getLatestVersion('brand-new');
      expect(version).toBe('');
    });

    it('should handle errors', async () => {
      const version = await getLatestVersion('non-existent-package');
      expect(version).toBe('');
    });
  });

  describe('getLatestVersionOfMajor', () => {
    it('should fetch latest version of major at least seven days old (array response)', async () => {
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
        ['view', 'typescript', 'versions', '--json'],
        expect.objectContaining({ shell: false }),
      );
      expect(spawn).toHaveBeenCalledWith(
        'npm',
        ['view', 'typescript', 'time', '--json'],
        expect.objectContaining({ shell: false }),
      );
    });
  });
});
