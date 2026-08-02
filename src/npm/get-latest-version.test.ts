import { EventEmitter } from 'events';
import { Readable } from 'stream';
import spawn from 'cross-spawn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../utils/logger';
import { getLatestPackageVersion, getLatestPackageVersionOfMajor } from './get-latest-version';

vi.mock('cross-spawn', () => ({
  default: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-01-15T12:00:00.000Z').getTime();

type RegistryPackage = {
  versions: string[] | string;
  times: Record<string, string>;
  deprecatedVersions?: Record<string, string>;
};

function daysAgo(days: number) {
  return new Date(NOW - days * MS_PER_DAY).toISOString();
}

function createTimeResponse(times: Record<string, string>) {
  return { created: daysAgo(300), modified: daysAgo(1), ...times };
}

function createMetadataResponse(versions: string[] | string, times: Record<string, string>) {
  return JSON.stringify({ versions, time: createTimeResponse(times) }) + '\n';
}

function createDeprecationResponse(version: string, deprecatedVersions: Record<string, string> = {}) {
  const deprecationMessage = deprecatedVersions[version];
  return deprecationMessage ? JSON.stringify(deprecationMessage) + '\n' : '';
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
  const registryPackages: Record<string, RegistryPackage> = {
    typescript: {
      versions: ['4.9.0', '5.0.0', '5.1.0', '6.0.0-beta.1'],
      times: {
        '4.9.0': daysAgo(40),
        '5.0.0': daysAgo(8),
        '5.1.0': daysAgo(1),
        '6.0.0-beta.1': daysAgo(30),
      },
    },
    'fresh-current': {
      versions: ['1.0.0', '2.0.0'],
      times: { '1.0.0': daysAgo(40), '2.0.0': daysAgo(1) },
    },
    'brand-new': {
      versions: ['1.0.0'],
      times: { '1.0.0': daysAgo(1) },
    },
    'range-eligible': {
      versions: ['1.9.0', '2.0.0', '2.1.0', '2.2.0'],
      times: {
        '1.9.0': daysAgo(40),
        '2.0.0': daysAgo(10),
        '2.1.0': daysAgo(8),
        '2.2.0': daysAgo(1),
      },
    },
    'range-current': {
      versions: ['1.9.0', '2.1.0', '2.2.0'],
      times: {
        '1.9.0': daysAgo(40),
        '2.1.0': daysAgo(1),
        '2.2.0': daysAgo(1),
      },
    },
    'range-deprecated-current': {
      versions: ['1.9.0', '2.1.0', '2.2.0'],
      times: {
        '1.9.0': daysAgo(40),
        '2.1.0': daysAgo(1),
        '2.2.0': daysAgo(1),
      },
      deprecatedVersions: {
        '2.1.0': 'bad release',
      },
    },
    'workspace-current': {
      versions: ['1.0.0', '2.0.0'],
      times: { '1.0.0': daysAgo(40), '2.0.0': daysAgo(8) },
    },
    'deprecated-latest': {
      versions: ['1.0.0', '2.0.0', '3.0.0'],
      times: { '1.0.0': daysAgo(40), '2.0.0': daysAgo(30), '3.0.0': daysAgo(20) },
      deprecatedVersions: {
        '3.0.0': 'bad release',
      },
    },
    'deprecated-current': {
      versions: ['1.0.0', '2.0.0'],
      times: { '1.0.0': daysAgo(40), '2.0.0': daysAgo(30) },
      deprecatedVersions: {
        '2.0.0': 'bad release',
      },
    },
    '@aforemendude/fresh-package': {
      versions: ['1.0.0', '1.1.0'],
      times: { '1.0.0': daysAgo(1), '1.1.0': daysAgo(0) },
    },
    '@aforemendude/deprecated-fresh-package': {
      versions: ['1.0.0', '1.1.0'],
      times: { '1.0.0': daysAgo(1), '1.1.0': daysAgo(0) },
      deprecatedVersions: {
        '1.1.0': 'bad release',
      },
    },
    '@types/node': {
      versions: ['18.0.0', '18.1.1', '18.2.0', '20.0.0'],
      times: {
        '18.0.0': daysAgo(30),
        '18.1.1': daysAgo(8),
        '18.2.0': daysAgo(1),
        '20.0.0': daysAgo(30),
      },
    },
    'deprecated-major': {
      versions: ['1.0.0', '1.1.0', '2.0.0'],
      times: { '1.0.0': daysAgo(30), '1.1.0': daysAgo(20), '2.0.0': daysAgo(30) },
      deprecatedVersions: {
        '1.1.0': 'bad release',
      },
    },
    'single-major': {
      versions: '20.0.0',
      times: { '20.0.0': daysAgo(30) },
    },
  };

  const parsePackageVersionSpec = (spec: string | undefined) => {
    if (!spec) {
      return undefined;
    }

    const versionSeparatorIndex = spec.lastIndexOf('@');
    if (versionSeparatorIndex <= 0) {
      return undefined;
    }

    return {
      packageName: spec.slice(0, versionSeparatorIndex),
      version: spec.slice(versionSeparatorIndex + 1),
    };
  };

  vi.mocked(spawn).mockImplementation((_cmd, args) => {
    const a = args as string[];

    if (a[0] === 'view' && a[2] === 'versions' && a[3] === 'time' && a[4] === '--json') {
      const packageName = a[1];
      const registryPackage = packageName ? registryPackages[packageName] : undefined;
      if (registryPackage) {
        return createMockChild(createMetadataResponse(registryPackage.versions, registryPackage.times)) as any;
      }
    }

    if (a[0] === 'view' && a[2] === 'deprecated' && a[3] === '--json') {
      const packageVersionSpec = parsePackageVersionSpec(a[1]);
      const registryPackage = packageVersionSpec ? registryPackages[packageVersionSpec.packageName] : undefined;
      if (packageVersionSpec && registryPackage) {
        return createMockChild(
          createDeprecationResponse(packageVersionSpec.version, registryPackage.deprecatedVersions),
        ) as any;
      }
    }

    return createMockChild('', 1) as any;
  });
}

describe('get-latest-version', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    setupSpawnMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getLatestPackageVersion', () => {
    it('should fetch latest version at least seven days old', async () => {
      const version = await getLatestPackageVersion('typescript');
      expect(version).toBe('5.0.0');
    });

    it('should return the current version when it is newer than the latest eligible version', async () => {
      const version = await getLatestPackageVersion('fresh-current', '2.0.0');
      expect(version).toBe('2.0.0');
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    it('should return empty when no version is at least seven days old', async () => {
      const version = await getLatestPackageVersion('brand-new');
      expect(version).toBe('');
    });

    it('should return the latest old enough version that satisfies an incomplete range', async () => {
      const version = await getLatestPackageVersion('range-eligible', '>=2');
      expect(version).toBe('2.1.0');
    });

    it('should return the earliest version satisfying an incomplete range when none are old enough', async () => {
      const version = await getLatestPackageVersion('range-current', '>=2');
      expect(version).toBe('2.1.0');
    });

    it('should exclude deprecated versions from incomplete range fallback selection', async () => {
      const version = await getLatestPackageVersion('range-deprecated-current', '>=2');
      expect(version).toBe('2.2.0');
    });

    it('should ignore invalid current references while selecting the latest old enough version', async () => {
      const version = await getLatestPackageVersion('workspace-current', 'workspace:*');
      expect(version).toBe('2.0.0');
    });

    it('should exclude deprecated versions from latest selection', async () => {
      const version = await getLatestPackageVersion('deprecated-latest');
      expect(version).toBe('2.0.0');
    });

    it('should not check deprecated versions below the current version to avoid a downgrade', async () => {
      const version = await getLatestPackageVersion('deprecated-current', '2.0.0');
      expect(version).toBe('');
      expect(spawn).toHaveBeenNthCalledWith(
        2,
        'npm',
        ['view', 'deprecated-current@2.0.0', 'deprecated', '--json'],
        expect.objectContaining({ shell: false }),
      );
      expect(spawn).toHaveBeenCalledTimes(2);
    });

    it('should skip the minimum age check for @aforemendude packages', async () => {
      const version = await getLatestPackageVersion('@aforemendude/fresh-package');
      expect(version).toBe('1.1.0');
    });

    it('should still exclude deprecated @aforemendude package versions', async () => {
      const version = await getLatestPackageVersion('@aforemendude/deprecated-fresh-package');
      expect(version).toBe('1.0.0');
    });

    it('should handle errors', async () => {
      const version = await getLatestPackageVersion('non-existent-package');
      expect(version).toBe('');
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'Could not fetch the latest version for non-existent-package. Skipping...',
      );
    });
  });

  describe('getLatestPackageVersionOfMajor', () => {
    it('should fetch latest version of major at least seven days old (array response)', async () => {
      const version = await getLatestPackageVersionOfMajor('@types/node', 18);
      expect(version).toBe('18.1.1');
    });

    it('should fetch latest version of major (string versions response)', async () => {
      const version = await getLatestPackageVersionOfMajor('single-major', 20);
      expect(version).toBe('20.0.0');
    });

    it('should exclude deprecated versions when selecting within a major', async () => {
      const version = await getLatestPackageVersionOfMajor('deprecated-major', 1);
      expect(version).toBe('1.0.0');
    });

    it('should handle errors', async () => {
      const version = await getLatestPackageVersionOfMajor('non-existent-package', 1);
      expect(version).toBe('');
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('Could not fetch versions for non-existent-package@1. Skipping...');
    });
  });
});
