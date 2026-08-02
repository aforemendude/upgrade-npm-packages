import type { Dirent } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

export type FileSystemEntry = {
  dirent: Dirent;
  path: string;
};

type FindFileSystemEntriesOptions = {
  matches: (entry: FileSystemEntry) => boolean;
  shouldTraverseDirectory?: (entry: FileSystemEntry) => boolean;
};

export const findFileSystemEntriesRecursively = async (
  startingDirectory: string,
  options: FindFileSystemEntriesOptions,
): Promise<FileSystemEntry[]> => {
  const matchingEntries: FileSystemEntry[] = [];

  const searchDirectory = async (directory: string): Promise<void> => {
    const dirents = await fs.readdir(directory, { withFileTypes: true });

    for (const dirent of dirents) {
      const entry = {
        dirent,
        path: path.join(directory, dirent.name),
      };

      if (options.matches(entry)) {
        matchingEntries.push(entry);
      }

      if (dirent.isDirectory() && (options.shouldTraverseDirectory?.(entry) ?? true)) {
        await searchDirectory(entry.path);
      }
    }
  };

  await searchDirectory(startingDirectory);
  return matchingEntries;
};
