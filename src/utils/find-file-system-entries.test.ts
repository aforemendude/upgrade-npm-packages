import type { Dirent } from 'fs';
import * as fs from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findFileSystemEntriesRecursively } from './find-file-system-entries';

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    readdir: vi.fn(),
  };
});

const createDirent = (name: string, type: 'directory' | 'file'): Dirent =>
  ({
    name,
    isDirectory: () => type === 'directory',
    isFile: () => type === 'file',
  }) as Dirent;

describe('findFileSystemEntriesRecursively', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns matching entries and respects the directory traversal predicate', async () => {
    const rootPackage = createDirent('package.json', 'file');
    const ignoredDirectory = createDirent('ignored', 'directory');
    const packagesDirectory = createDirent('packages', 'directory');
    const nestedPackage = createDirent('package.json', 'file');
    const directoryEntries = new Map<string, Dirent[]>([
      ['/repo', [rootPackage, ignoredDirectory, packagesDirectory]],
      ['/repo/packages', [nestedPackage]],
    ]);
    (fs.readdir as any).mockImplementation(async (directory: string) => directoryEntries.get(directory) ?? []);

    await expect(
      findFileSystemEntriesRecursively('/repo', {
        matches: ({ dirent }) => dirent.isFile() && dirent.name === 'package.json',
        shouldTraverseDirectory: ({ dirent }) => dirent.name !== 'ignored',
      }),
    ).resolves.toEqual([
      { dirent: rootPackage, path: '/repo/package.json' },
      { dirent: nestedPackage, path: '/repo/packages/package.json' },
    ]);
    expect(vi.mocked(fs.readdir).mock.calls).toEqual([
      ['/repo', { withFileTypes: true }],
      ['/repo/packages', { withFileTypes: true }],
    ]);
  });

  it('traverses directories by default', async () => {
    const nestedDirectory = createDirent('nested', 'directory');
    const nestedFile = createDirent('match.txt', 'file');
    const directoryEntries = new Map<string, Dirent[]>([
      ['/repo', [nestedDirectory]],
      ['/repo/nested', [nestedFile]],
    ]);
    (fs.readdir as any).mockImplementation(async (directory: string) => directoryEntries.get(directory) ?? []);

    await expect(
      findFileSystemEntriesRecursively('/repo', {
        matches: ({ dirent }) => dirent.name === 'match.txt',
      }),
    ).resolves.toEqual([{ dirent: nestedFile, path: '/repo/nested/match.txt' }]);
  });

  it('propagates a directory read failure', async () => {
    const readError = new Error('permission denied');
    vi.mocked(fs.readdir).mockRejectedValueOnce(readError);

    await expect(
      findFileSystemEntriesRecursively('/repo', {
        matches: () => true,
      }),
    ).rejects.toBe(readError);
  });
});
