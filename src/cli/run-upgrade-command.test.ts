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
    setColorEnabled: vi.fn(),
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

    expect(logger.setColorEnabled).toHaveBeenCalledWith(true);
    expect(findPackageJsonFiles).toHaveBeenCalledWith('/repo', { allowSymlinks: false });
    expect(upgradePackageJson).toHaveBeenCalledTimes(2);
    expect(upgradePackageJson).toHaveBeenNthCalledWith(1, '/repo/package.json');
    expect(upgradePackageJson).toHaveBeenNthCalledWith(2, '/repo/packages/app/package.json');
    expect(forceReinstallDependencies).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'Skipping reinstall. Pass --force-reinstall to refresh package locks and node_modules.',
    );
    expect(logger.success).toHaveBeenCalledTimes(1);
    expect(logger.success).toHaveBeenCalledWith('Finished processing all package.json files.');
  });

  it('disables logger colors before logging when explicitly requested', async () => {
    await runUpgradeCommand({ args: ['--no-color'], workingDirectory: '/repo' });

    expect(logger.setColorEnabled).toHaveBeenCalledTimes(1);
    expect(logger.setColorEnabled).toHaveBeenCalledWith(false);
    expect(logger.info).toHaveBeenCalled();
  });

  it('disables logger colors before reporting another invalid argument', async () => {
    await expect(runUpgradeCommand({ args: ['--no-color', '--unknown'], workingDirectory: '/repo' })).rejects.toThrow(
      "Unknown option '--unknown'",
    );

    expect(logger.setColorEnabled).toHaveBeenCalledTimes(1);
    expect(logger.setColorEnabled).toHaveBeenCalledWith(false);
    expect(logger.info).toHaveBeenCalledTimes(1);
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

  it('allows canonical symlink targets when explicitly requested', async () => {
    vi.mocked(findPackageJsonFiles).mockResolvedValue(['/outside/shared-manifest.json']);

    await runUpgradeCommand({
      args: ['--allow-symlinks'],
      workingDirectory: '/repo',
    });

    expect(findPackageJsonFiles).toHaveBeenCalledWith('/repo', { allowSymlinks: true });
    expect(upgradePackageJson).toHaveBeenCalledTimes(1);
    expect(upgradePackageJson).toHaveBeenCalledWith('/outside/shared-manifest.json');
  });

  it('stops before processing any files when a symlink is not explicitly allowed', async () => {
    const symlinkError = new Error('Symbolic-link package.json is not allowed');
    vi.mocked(findPackageJsonFiles).mockRejectedValueOnce(symlinkError);

    await expect(runUpgradeCommand({ args: [], workingDirectory: '/repo' })).rejects.toBe(symlinkError);

    expect(findPackageJsonFiles).toHaveBeenCalledWith('/repo', { allowSymlinks: false });
    expect(upgradePackageJson).not.toHaveBeenCalled();
    expect(forceReinstallDependencies).not.toHaveBeenCalled();
    expect(logger.success).not.toHaveBeenCalled();
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
    expect(forceReinstallDependencies).not.toHaveBeenCalled();
    expect(logger.success).not.toHaveBeenCalled();
  });

  it('stops processing and does not reinstall when a package.json upgrade fails', async () => {
    const upgradeError = new Error('invalid package.json');
    vi.mocked(upgradePackageJson).mockRejectedValueOnce(upgradeError);

    await expect(runUpgradeCommand({ args: ['--force-reinstall'], workingDirectory: '/repo' })).rejects.toBe(
      upgradeError,
    );

    expect(upgradePackageJson).toHaveBeenCalledTimes(1);
    expect(upgradePackageJson).toHaveBeenCalledWith('/repo/package.json');
    expect(forceReinstallDependencies).not.toHaveBeenCalled();
    expect(logger.success).not.toHaveBeenCalled();
  });
});
