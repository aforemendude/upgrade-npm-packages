import * as fs from 'fs/promises';
import { findFileSystemEntriesRecursively } from '../utils/find-file-system-entries';

const PACKAGE_JSON_FILE_NAME = 'package.json';
const NODE_MODULES_DIRECTORY_NAME = 'node_modules';

export type FindPackageJsonFilesOptions = {
  allowSymlinks?: boolean;
};

export class PackageJsonSymlinkError extends Error {
  constructor(filePath: string) {
    super(
      `Refusing to process symbolic-link package.json at ${filePath}. Pass --allow-symlinks to allow modifying its target.`,
    );
    this.name = 'PackageJsonSymlinkError';
  }
}

export const findPackageJsonFiles = async (
  startingDirectory: string,
  { allowSymlinks = false }: FindPackageJsonFilesOptions = {},
): Promise<string[]> => {
  const entries = await findFileSystemEntriesRecursively(startingDirectory, {
    matches: (entry) => {
      if (entry.dirent.name !== PACKAGE_JSON_FILE_NAME) {
        return false;
      }

      if (entry.dirent.isSymbolicLink() && !allowSymlinks) {
        throw new PackageJsonSymlinkError(entry.path);
      }

      return entry.dirent.isFile() || entry.dirent.isSymbolicLink();
    },
    shouldTraverseDirectory: ({ dirent }) => dirent.name !== NODE_MODULES_DIRECTORY_NAME,
  });

  if (!allowSymlinks) {
    return entries.map((entry) => entry.path);
  }

  const canonicalFilePaths = await Promise.all(entries.map((entry) => fs.realpath(entry.path)));
  return [...new Set(canonicalFilePaths)];
};
