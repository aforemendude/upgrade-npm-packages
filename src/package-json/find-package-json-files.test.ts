import type { Dirent } from 'fs';
import * as fs from 'fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { findPackageJsonFiles } from './find-package-json-files';

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    readdir: vi.fn(),
    realpath: vi.fn(),
  };
});

const createDirent = (name: string, type: 'directory' | 'file' | 'symbolic-link'): Dirent =>
  ({
    name,
    isDirectory: () => type === 'directory',
    isFile: () => type === 'file',
    isSymbolicLink: () => type === 'symbolic-link',
  }) as Dirent;

describe('findPackageJsonFiles', () => {
  it('finds regular package.json files while skipping node_modules', async () => {
    const directoryEntries = new Map<string, Dirent[]>([
      [
        '/repo',
        [
          createDirent('package.json', 'file'),
          createDirent('linked-package.json', 'symbolic-link'),
          createDirent('node_modules', 'directory'),
          createDirent('packages', 'directory'),
        ],
      ],
      ['/repo/packages', [createDirent('app', 'directory')]],
      ['/repo/packages/app', [createDirent('package.json', 'file')]],
    ]);
    (fs.readdir as any).mockImplementation(async (directory: string) => directoryEntries.get(directory) ?? []);

    await expect(findPackageJsonFiles('/repo')).resolves.toEqual([
      '/repo/package.json',
      '/repo/packages/app/package.json',
    ]);
    expect(fs.readdir).not.toHaveBeenCalledWith('/repo/node_modules', expect.anything());
  });

  it('rejects a package.json symbolic link by default', async () => {
    (fs.readdir as any).mockResolvedValue([createDirent('package.json', 'symbolic-link')]);

    await expect(findPackageJsonFiles('/repo')).rejects.toThrow(
      'Refusing to process symbolic-link package.json at /repo/package.json. Pass --allow-symlinks to allow modifying its target.',
    );
    expect(fs.realpath).not.toHaveBeenCalled();
  });

  it('allows symlink targets outside the starting directory and deduplicates canonical files', async () => {
    const directoryEntries = new Map<string, Dirent[]>([
      [
        '/repo',
        [
          createDirent('package.json', 'file'),
          createDirent('packages', 'directory'),
          createDirent('external', 'directory'),
        ],
      ],
      ['/repo/packages', [createDirent('package.json', 'symbolic-link')]],
      ['/repo/external', [createDirent('package.json', 'symbolic-link')]],
    ]);
    (fs.readdir as any).mockImplementation(async (directory: string) => directoryEntries.get(directory) ?? []);
    vi.mocked(fs.realpath).mockImplementation(async (filePath) => {
      const canonicalPaths = new Map([
        ['/repo/package.json', '/repo/package.json'],
        ['/repo/packages/package.json', '/repo/package.json'],
        ['/repo/external/package.json', '/outside/shared-manifest.json'],
      ]);
      return canonicalPaths.get(filePath.toString()) ?? filePath.toString();
    });

    await expect(findPackageJsonFiles('/repo', { allowSymlinks: true })).resolves.toEqual([
      '/repo/package.json',
      '/outside/shared-manifest.json',
    ]);
    expect(fs.realpath).toHaveBeenCalledTimes(3);
  });
});
