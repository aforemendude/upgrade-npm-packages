import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findPackageJsonFiles } from '../package-json/find-package-json-files';
import { upgradePackageJson } from '../package-json/upgrade-package-json';
import { forceReinstallDependencies } from '../reinstall/force-reinstall-dependencies';
import { logger } from '../utils/logger';
import { getHelpMessage } from './get-help-message';
import { runUpgradeCommand } from './run-upgrade-command';

vi.mock('../package-json/find-package-json-files', () => ({
  findPackageJsonFiles: vi.fn(),
}));

vi.mock('../package-json/upgrade-package-json', () => ({
  upgradePackageJson: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../reinstall/force-reinstall-dependencies', () => ({
  forceReinstallDependencies: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('runUpgradeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findPackageJsonFiles).mockResolvedValue(['/repo/package.json', '/repo/packages/app/package.json']);
    vi.mocked(forceReinstallDependencies).mockResolvedValue(undefined);
    vi.mocked(upgradePackageJson).mockResolvedValue(undefined);
  });

  it('upgrades each package.json without reinstalling by default', async () => {
    await runUpgradeCommand({ args: [], workingDirectory: '/repo' });

    expect(findPackageJsonFiles).toHaveBeenCalledWith('/repo');
    expect(upgradePackageJson).toHaveBeenCalledTimes(2);
    expect(upgradePackageJson).toHaveBeenNthCalledWith(1, '/repo/package.json');
    expect(upgradePackageJson).toHaveBeenNthCalledWith(2, '/repo/packages/app/package.json');
    expect(forceReinstallDependencies).not.toHaveBeenCalled();
  });

  it('runs one force reinstall after upgrading every package.json', async () => {
    const operationOrder: string[] = [];
    vi.mocked(upgradePackageJson).mockImplementation(async (filePath) => {
      operationOrder.push(`upgrade:${filePath}`);
    });
    vi.mocked(forceReinstallDependencies).mockImplementation(async (workingDirectory) => {
      operationOrder.push(`reinstall:${workingDirectory}`);
    });

    await runUpgradeCommand({
      args: ['--force-reinstall'],
      workingDirectory: '/repo',
    });

    expect(forceReinstallDependencies).toHaveBeenCalledTimes(1);
    expect(forceReinstallDependencies).toHaveBeenCalledWith('/repo');
    expect(operationOrder).toEqual([
      'upgrade:/repo/package.json',
      'upgrade:/repo/packages/app/package.json',
      'reinstall:/repo',
    ]);
  });

  it('prints help without discovering or processing files', async () => {
    await runUpgradeCommand({
      args: ['--help'],
      workingDirectory: '/repo',
    });

    expect(logger.info).toHaveBeenCalledWith(getHelpMessage());
    expect(findPackageJsonFiles).not.toHaveBeenCalled();
    expect(upgradePackageJson).not.toHaveBeenCalled();
    expect(forceReinstallDependencies).not.toHaveBeenCalled();
  });

  it('reports when no package.json files are found', async () => {
    vi.mocked(findPackageJsonFiles).mockResolvedValue([]);

    await runUpgradeCommand({ args: [], workingDirectory: '/repo' });

    expect(logger.error).toHaveBeenCalledWith('No package.json files found.');
    expect(upgradePackageJson).not.toHaveBeenCalled();
  });
});
