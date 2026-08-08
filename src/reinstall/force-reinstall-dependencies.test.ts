import * as fs from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installPackages } from '../npm/install-packages';
import { logger } from '../utils/logger';
import { forceReinstallDependencies, ReinstallSafetyError } from './force-reinstall-dependencies';
import { findReinstallTargets } from './find-reinstall-targets';

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    rm: vi.fn(),
  };
});

vi.mock('../npm/install-packages', () => ({
  installPackages: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./find-reinstall-targets', () => ({
  findReinstallTargets: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('forceReinstallDependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(installPackages).mockResolvedValue(undefined);
    vi.mocked(findReinstallTargets).mockResolvedValue({
      installRootPaths: ['/repo'],
      lockfilePaths: ['/repo/package-lock.json'],
      nodeModulesPaths: ['/repo/node_modules'],
    });
  });

  it('deletes every target before installing once in the working directory', async () => {
    const operations: string[] = [];
    vi.mocked(fs.rm).mockImplementation(async (targetPath) => {
      operations.push(`remove:${String(targetPath)}`);
    });
    vi.mocked(installPackages).mockImplementation(async (workingDirectory) => {
      operations.push(`install:${workingDirectory}`);
    });

    await forceReinstallDependencies('/repo');

    expect(findReinstallTargets).toHaveBeenCalledTimes(1);
    expect(findReinstallTargets).toHaveBeenCalledWith('/repo');
    expect(fs.rm).toHaveBeenCalledWith('/repo/package-lock.json', {
      force: true,
    });
    expect(fs.rm).toHaveBeenCalledWith('/repo/node_modules', {
      recursive: true,
      force: true,
    });
    expect(installPackages).toHaveBeenCalledTimes(1);
    expect(installPackages).toHaveBeenCalledWith('/repo');
    expect(operations).toEqual(['remove:/repo/package-lock.json', 'remove:/repo/node_modules', 'install:/repo']);
    expect(logger.info).toHaveBeenCalledWith('Running npm install in /repo...');
    expect(logger.success).toHaveBeenCalledWith('Successfully reinstalled dependencies in /repo');
  });

  it('deletes every target and installs once in the working directory before rejecting other install roots', async () => {
    vi.mocked(findReinstallTargets).mockResolvedValue({
      installRootPaths: ['/repo', '/repo/packages/app'],
      lockfilePaths: ['/repo/package-lock.json', '/repo/packages/app/package-lock.json'],
      nodeModulesPaths: ['/repo/node_modules', '/repo/packages/app/node_modules'],
    });
    const operations: string[] = [];
    vi.mocked(fs.rm).mockImplementation(async (targetPath) => {
      operations.push(`remove:${String(targetPath)}`);
    });
    vi.mocked(installPackages).mockImplementation(async (workingDirectory) => {
      operations.push(`install:${workingDirectory}`);
    });

    await expect(forceReinstallDependencies('/repo')).rejects.toMatchObject({
      name: ReinstallSafetyError.name,
      message:
        'npm install ran in /repo, but other install roots were found and cleaned without being reinstalled: /repo/packages/app. Run npm install manually in each listed directory.',
    });

    expect(operations).toEqual([
      'remove:/repo/package-lock.json',
      'remove:/repo/packages/app/package-lock.json',
      'remove:/repo/node_modules',
      'remove:/repo/packages/app/node_modules',
      'install:/repo',
    ]);
    expect(installPackages).toHaveBeenCalledTimes(1);
    expect(installPackages).toHaveBeenCalledWith('/repo');
    expect(logger.success).not.toHaveBeenCalled();
  });

  it('deletes every target, skips installation, and rejects when the working directory is not an install root', async () => {
    vi.mocked(findReinstallTargets).mockResolvedValue({
      installRootPaths: ['/repo/packages/app'],
      lockfilePaths: ['/repo/packages/app/package-lock.json'],
      nodeModulesPaths: ['/repo/packages/app/node_modules'],
    });

    await expect(forceReinstallDependencies('/repo')).rejects.toMatchObject({
      name: ReinstallSafetyError.name,
      message:
        'Skipped npm install because the current working directory is not an install root: /repo. Cleaned install roots require a manual npm install: /repo/packages/app.',
    });

    expect(fs.rm).toHaveBeenCalledWith('/repo/packages/app/package-lock.json', { force: true });
    expect(fs.rm).toHaveBeenCalledWith('/repo/packages/app/node_modules', { recursive: true, force: true });
    expect(installPackages).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalledWith('Running npm install in /repo...');
    expect(logger.success).not.toHaveBeenCalled();
  });

  it('stops before installation when removing a target fails', async () => {
    const removalError = new Error('permission denied');
    vi.mocked(fs.rm).mockRejectedValueOnce(removalError);

    await expect(forceReinstallDependencies('/repo')).rejects.toBe(removalError);

    expect(fs.rm).toHaveBeenCalledTimes(1);
    expect(installPackages).not.toHaveBeenCalled();
    expect(logger.success).not.toHaveBeenCalled();
  });
});
