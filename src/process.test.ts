import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { upgradePackageJson } from './process';
import { installPackages } from './utils/npm';

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
  stringify: vi.fn().mockReturnValue('{}'),
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
});
