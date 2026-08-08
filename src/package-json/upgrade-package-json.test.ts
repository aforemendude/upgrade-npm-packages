import * as fs from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NpmRegistry } from '../npm/npm-registry';
import { logger } from '../utils/logger';
import { stringifyJsonWithSortedKeys } from '../utils/stringify-json';
import { upgradeDependencySection } from './upgrade-dependency-section';
import { upgradePackageJson } from './upgrade-package-json';

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn(),
  };
});

vi.mock('./upgrade-dependency-section', () => ({
  upgradeDependencySection: vi.fn(),
}));

vi.mock('../utils/stringify-json', () => ({
  stringifyJsonWithSortedKeys: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const npmRegistry: NpmRegistry = {
  getPackageVersionMetadata: vi.fn(),
  isPackageVersionDeprecated: vi.fn(),
};

describe('upgradePackageJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.readFile).mockResolvedValue('{}' as never);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(upgradeDependencySection).mockResolvedValue(undefined);
    vi.mocked(stringifyJsonWithSortedKeys).mockReturnValue('formatted package json');
  });

  it('upgrades both dependency sections and writes the formatted result', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        dependencies: { runtime: '1.0.0' },
        devDependencies: { development: '1.0.0' },
        name: 'package',
      }) as never,
    );
    vi.mocked(upgradeDependencySection).mockImplementation(async (section) => {
      if (section?.['runtime']) {
        section['runtime'] = '2.0.0';
      }
      if (section?.['development']) {
        section['development'] = '3.0.0';
      }
    });

    await upgradePackageJson('/repo/package.json', npmRegistry);

    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(fs.readFile).toHaveBeenCalledWith('/repo/package.json', 'utf-8');
    expect(upgradeDependencySection).toHaveBeenCalledTimes(2);
    expect(upgradeDependencySection).toHaveBeenNthCalledWith(1, { runtime: '2.0.0' }, npmRegistry);
    expect(upgradeDependencySection).toHaveBeenNthCalledWith(2, { development: '3.0.0' }, npmRegistry);
    expect(stringifyJsonWithSortedKeys).toHaveBeenCalledTimes(1);
    expect(stringifyJsonWithSortedKeys).toHaveBeenCalledWith({
      dependencies: { runtime: '2.0.0' },
      devDependencies: { development: '3.0.0' },
      name: 'package',
    });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith('/repo/package.json', 'formatted package json', 'utf-8');
    expect(logger.success).toHaveBeenCalledTimes(1);
    expect(logger.success).toHaveBeenCalledWith('Successfully upgraded packages in /repo/package.json');
  });

  it('formats and writes package.json files without dependency sections', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"name":"package"}' as never);

    await upgradePackageJson('/repo/package.json', npmRegistry);

    expect(vi.mocked(upgradeDependencySection).mock.calls).toEqual([
      [undefined, npmRegistry],
      [undefined, npmRegistry],
    ]);
    expect(stringifyJsonWithSortedKeys).toHaveBeenCalledWith({ name: 'package' });
    expect(fs.writeFile).toHaveBeenCalledWith('/repo/package.json', 'formatted package json', 'utf-8');
  });

  it('logs and propagates file errors without writing a result', async () => {
    const readError = new Error('permission denied');
    vi.mocked(fs.readFile).mockRejectedValueOnce(readError);

    await expect(upgradePackageJson('/repo/package.json', npmRegistry)).rejects.toBe(readError);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Unable to process /repo/package.json:', 'permission denied');
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(logger.success).not.toHaveBeenCalled();
  });

  it('formats a non-Error failure for the log and propagates the original value', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"dependencies":{"package":"1.0.0"}}' as never);
    vi.mocked(upgradeDependencySection).mockRejectedValueOnce('registry unavailable');

    await expect(upgradePackageJson('/repo/package.json', npmRegistry)).rejects.toBe('registry unavailable');

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Unable to process /repo/package.json:', 'registry unavailable');
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(logger.success).not.toHaveBeenCalled();
  });
});
