import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { upgradePackageJson } from './process';
import { installPackages, getLatestVersion, getLatestVersionOfMajor } from './utils/npm';
import { logger } from './utils/logger';

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
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

describe('upgradePackageJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upgrade packages, delete lockfile, and run npm install', async () => {
    const filePath = '/test/package.json';
    const packageJson = {
      dependencies: {
        'some-pkg': '1.0.0',
      },
    };

    (fs.readFile as any).mockResolvedValue(JSON.stringify(packageJson));
    (fs.writeFile as any).mockResolvedValue(undefined);
    (fs.unlink as any).mockResolvedValue(undefined);

    await upgradePackageJson(filePath);

    expect(getLatestVersion).toHaveBeenCalledWith('some-pkg', '1.0.0');
    expect(fs.writeFile).toHaveBeenCalledWith(filePath, expect.any(String), 'utf-8');
    expect(fs.unlink).toHaveBeenCalledWith(path.join('/test', 'package-lock.json'));
    expect(installPackages).toHaveBeenCalledWith('/test');
  });

  it('should not throw if package-lock.json does not exist', async () => {
    const filePath = '/test/package.json';
    const packageJson = {};

    (fs.readFile as any).mockResolvedValue(JSON.stringify(packageJson));
    (fs.unlink as any).mockRejectedValue({ code: 'ENOENT' });

    await expect(upgradePackageJson(filePath)).resolves.not.toThrow();
    expect(installPackages).toHaveBeenCalled();
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
    (fs.unlink as any).mockResolvedValue(undefined);

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
    (fs.unlink as any).mockResolvedValue(undefined);

    await upgradePackageJson(filePath);

    expect(getLatestVersionOfMajor).toHaveBeenCalledWith('@types/node', 18, '18.1.0');
    expect(getLatestVersion).not.toHaveBeenCalled();
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
    (fs.unlink as any).mockResolvedValue(undefined);

    await upgradePackageJson(filePath);

    const writtenPackageJson = JSON.parse((fs.writeFile as any).mock.calls[0][1]);
    expect(writtenPackageJson.dependencies['some-pkg']).toBe('^2.0.0');
  });
});
