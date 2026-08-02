import type { Dirent } from 'fs';
import * as fs from 'fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { findPackageJsonFiles } from './find-package-json-files';

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    readdir: vi.fn(),
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

  it('does not treat a package.json symbolic link as a writable manifest', async () => {
    (fs.readdir as any).mockResolvedValue([createDirent('package.json', 'symbolic-link')]);

    await expect(findPackageJsonFiles('/repo')).resolves.toEqual([]);
  });
});
