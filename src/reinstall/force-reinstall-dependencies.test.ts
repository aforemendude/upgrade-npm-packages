import * as fs from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installPackages } from '../npm/install-packages';
import { forceReinstallDependencies } from './force-reinstall-dependencies';
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
    vi.mocked(findReinstallTargets).mockResolvedValue({
      lockfilePaths: ['/repo/package-lock.json', '/repo/packages/app/package-lock.json'],
      nodeModulesPaths: ['/repo/node_modules', '/repo/packages/app/node_modules'],
    });
  });

  it('deletes every target before installing once in the working directory', async () => {
    await forceReinstallDependencies('/repo');

    expect(fs.rm).toHaveBeenCalledWith('/repo/package-lock.json', {
      force: true,
    });
    expect(fs.rm).toHaveBeenCalledWith('/repo/packages/app/package-lock.json', { force: true });
    expect(fs.rm).toHaveBeenCalledWith('/repo/node_modules', {
      recursive: true,
      force: true,
    });
    expect(fs.rm).toHaveBeenCalledWith('/repo/packages/app/node_modules', { recursive: true, force: true });
    expect(installPackages).toHaveBeenCalledTimes(1);
    expect(installPackages).toHaveBeenCalledWith('/repo');
  });
});
