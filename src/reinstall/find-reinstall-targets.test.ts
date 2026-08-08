import type { Dirent } from 'fs';
import * as fs from 'fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { findReinstallTargets } from './find-reinstall-targets';

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    readdir: vi.fn(),
  };
});

const createDirent = (name: string, isDirectory: boolean): Dirent =>
  ({
    name,
    isDirectory: () => isDirectory,
    isFile: () => !isDirectory,
  }) as Dirent;

describe('findReinstallTargets', () => {
  it('collects every deletion target but requires both target types for an install root', async () => {
    const directoryEntries = new Map<string, Dirent[]>([
      [
        '/repo',
        [createDirent('package-lock.json', false), createDirent('node_modules', true), createDirent('packages', true)],
      ],
      [
        '/repo/packages',
        [createDirent('app', true), createDirent('docs', true), createDirent('package-lock.json', false)],
      ],
      ['/repo/packages/app', [createDirent('node_modules', true), createDirent('package-lock.json', false)]],
      ['/repo/packages/docs', [createDirent('node_modules', true)]],
    ]);
    (fs.readdir as any).mockImplementation(async (directory: string) => directoryEntries.get(directory) ?? []);

    await expect(findReinstallTargets('/repo')).resolves.toEqual({
      installRootPaths: ['/repo', '/repo/packages/app'],
      lockfilePaths: [
        '/repo/package-lock.json',
        '/repo/packages/app/package-lock.json',
        '/repo/packages/package-lock.json',
      ],
      nodeModulesPaths: ['/repo/node_modules', '/repo/packages/app/node_modules', '/repo/packages/docs/node_modules'],
    });
    expect(fs.readdir).not.toHaveBeenCalledWith('/repo/node_modules', expect.anything());
    expect(fs.readdir).not.toHaveBeenCalledWith('/repo/packages/docs/node_modules', expect.anything());
  });
});
