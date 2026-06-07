import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Dirent } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { forceReinstall, upgradePackageJson } from './process';
import { installPackages, getLatestVersion, getLatestVersionOfMajor } from './utils/npm';
import { logger } from './utils/logger';

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    readdir: vi.fn(),
    readFile: vi.fn(),
    rm: vi.fn(),
    writeFile: vi.fn(),
  };
});

vi.mock('./utils/npm', () => ({
  getLatestVersion: vi.fn().mockResolvedValue('2.0.0'),
  getLatestVersionOfMajor: vi.fn().mockResolvedValue('1.5.0'),
  installPackages: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./utils/json', () => ({
  stringify: vi.fn((value) => JSON.stringify(value)),
}));

vi.mock('./utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const createDirent = (name: string, isDirectory: boolean): Dirent =>
  ({
    name,
    isDirectory: () => isDirectory,
  }) as Dirent;

describe('upgradePackageJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upgrade packages without deleting lockfiles or running npm install', async () => {
    const filePath = '/test/package.json';
    const packageJson = {
      dependencies: {
        'some-pkg': '1.0.0',
      },
    };

    (fs.readFile as any).mockResolvedValue(JSON.stringify(packageJson));
    (fs.writeFile as any).mockResolvedValue(undefined);

    await upgradePackageJson(filePath);

    expect(getLatestVersion).toHaveBeenCalledWith('some-pkg', '1.0.0');
    expect(fs.writeFile).toHaveBeenCalledWith(filePath, expect.any(String), 'utf-8');
    expect(fs.rm).not.toHaveBeenCalled();
    expect(installPackages).not.toHaveBeenCalled();
  });

  it('should write package.json files that do not have dependency sections', async () => {
    const filePath = '/test/package.json';
    const packageJson = {};

    (fs.readFile as any).mockResolvedValue(JSON.stringify(packageJson));

    await expect(upgradePackageJson(filePath)).resolves.not.toThrow();
    expect(fs.writeFile).toHaveBeenCalledWith(filePath, '{}', 'utf-8');
    expect(installPackages).not.toHaveBeenCalled();
  });

  it('should skip packages with * version and log it', async () => {
    const filePath = '/test/package.json';
    const packageJson = {
      dependencies: {
        'some-pkg': '*',
        'other-pkg': '1.0.0',
      },
    };

    (fs.readFile as any).mockResolvedValue(JSON.stringify(packageJson));
    (fs.writeFile as any).mockResolvedValue(undefined);

    await upgradePackageJson(filePath);

    expect(logger.warn).toHaveBeenCalledWith("Skipping some-pkg as it has '*' version");

    // other-pkg should be upgraded
    expect(getLatestVersion).toHaveBeenCalledWith('other-pkg', '1.0.0');

    // some-pkg should NOT be requested
    expect(vi.mocked(getLatestVersion).mock.calls.some(([packageName]) => packageName === 'some-pkg')).toBe(false);
  });

  it('should pass the current version to same-major upgrade packages', async () => {
    const filePath = '/test/package.json';
    const packageJson = {
      devDependencies: {
        '@types/node': '^18.1.0',
      },
    };

    (fs.readFile as any).mockResolvedValue(JSON.stringify(packageJson));
    (fs.writeFile as any).mockResolvedValue(undefined);

    await upgradePackageJson(filePath);

    expect(getLatestVersionOfMajor).toHaveBeenCalledWith('@types/node', 18, '18.1.0');
    expect(getLatestVersion).not.toHaveBeenCalled();
  });

  it('should pass an incomplete range to same-major upgrade packages', async () => {
    const filePath = '/test/package.json';
    const packageJson = {
      devDependencies: {
        '@types/node': '^18',
      },
    };

    (fs.readFile as any).mockResolvedValue(JSON.stringify(packageJson));
    (fs.writeFile as any).mockResolvedValue(undefined);

    await upgradePackageJson(filePath);

    expect(getLatestVersionOfMajor).toHaveBeenCalledWith('@types/node', 18, '^18');
    expect(getLatestVersion).not.toHaveBeenCalled();
  });

  it('should pass unsupported references to unrestricted version lookup', async () => {
    const filePath = '/test/package.json';
    const packageJson = {
      devDependencies: {
        '@types/node': 'workspace:*',
      },
    };

    (fs.readFile as any).mockResolvedValue(JSON.stringify(packageJson));
    (fs.writeFile as any).mockResolvedValue(undefined);

    await upgradePackageJson(filePath);

    expect(getLatestVersion).toHaveBeenCalledWith('@types/node', 'workspace:*');
    expect(getLatestVersionOfMajor).not.toHaveBeenCalled();
  });

  it('should keep the current package reference when no eligible upgrade is returned', async () => {
    vi.mocked(getLatestVersion).mockResolvedValueOnce('');
    const filePath = '/test/package.json';
    const packageJson = {
      dependencies: {
        'some-pkg': '^2.0.0',
      },
    };

    (fs.readFile as any).mockResolvedValue(JSON.stringify(packageJson));
    (fs.writeFile as any).mockResolvedValue(undefined);

    await upgradePackageJson(filePath);

    const writtenPackageJson = JSON.parse((fs.writeFile as any).mock.calls[0][1]);
    expect(writtenPackageJson.dependencies['some-pkg']).toBe('^2.0.0');
  });

  it('should pass an incomplete range to version lookup and pin the selected version', async () => {
    vi.mocked(getLatestVersion).mockResolvedValueOnce('2.0.0');
    const filePath = '/test/package.json';
    const packageJson = {
      dependencies: {
        'some-pkg': '>=2',
      },
    };

    (fs.readFile as any).mockResolvedValue(JSON.stringify(packageJson));
    (fs.writeFile as any).mockResolvedValue(undefined);

    await upgradePackageJson(filePath);

    expect(getLatestVersion).toHaveBeenCalledWith('some-pkg', '>=2');

    const writtenPackageJson = JSON.parse((fs.writeFile as any).mock.calls[0][1]);
    expect(writtenPackageJson.dependencies['some-pkg']).toBe('2.0.0');
  });

  it('should pin the current version when the current version is newer than the latest eligible version', async () => {
    vi.mocked(getLatestVersion).mockResolvedValueOnce('2.0.0');
    const filePath = '/test/package.json';
    const packageJson = {
      dependencies: {
        'some-pkg': '^2.0.0',
      },
    };

    (fs.readFile as any).mockResolvedValue(JSON.stringify(packageJson));
    (fs.writeFile as any).mockResolvedValue(undefined);

    await upgradePackageJson(filePath);

    expect(getLatestVersion).toHaveBeenCalledWith('some-pkg', '2.0.0');

    const writtenPackageJson = JSON.parse((fs.writeFile as any).mock.calls[0][1]);
    expect(writtenPackageJson.dependencies['some-pkg']).toBe('2.0.0');
  });
});

describe('forceReinstall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete all package locks and node_modules folders, then run one install at cwd', async () => {
    const entries = new Map<string, Dirent[]>([
      [
        '/repo',
        [
          createDirent('package-lock.json', false),
          createDirent('node_modules', true),
          createDirent('packages', true),
          createDirent('package.json', false),
        ],
      ],
      ['/repo/packages', [createDirent('app', true), createDirent('package-lock.json', false)]],
      ['/repo/packages/app', [createDirent('node_modules', true), createDirent('package-lock.json', false)]],
    ]);

    (fs.readdir as any).mockImplementation(async (dir: string) => entries.get(String(dir)) ?? []);
    vi.mocked(fs.rm).mockResolvedValue(undefined);

    await forceReinstall('/repo');

    expect(fs.rm).toHaveBeenCalledWith(path.join('/repo', 'package-lock.json'), { force: true });
    expect(fs.rm).toHaveBeenCalledWith(path.join('/repo', 'packages', 'package-lock.json'), { force: true });
    expect(fs.rm).toHaveBeenCalledWith(path.join('/repo', 'packages', 'app', 'package-lock.json'), { force: true });
    expect(fs.rm).toHaveBeenCalledWith(path.join('/repo', 'node_modules'), { recursive: true, force: true });
    expect(fs.rm).toHaveBeenCalledWith(path.join('/repo', 'packages', 'app', 'node_modules'), {
      recursive: true,
      force: true,
    });
    expect(fs.readdir).not.toHaveBeenCalledWith(path.join('/repo', 'node_modules'), expect.anything());
    expect(installPackages).toHaveBeenCalledTimes(1);
    expect(installPackages).toHaveBeenCalledWith('/repo');
  });
});
