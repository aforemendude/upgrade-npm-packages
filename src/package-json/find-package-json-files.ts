import { findFileSystemEntriesRecursively } from '../utils/find-file-system-entries';

const PACKAGE_JSON_FILE_NAME = 'package.json';
const NODE_MODULES_DIRECTORY_NAME = 'node_modules';

export const findPackageJsonFiles = async (startingDirectory: string): Promise<string[]> => {
  const entries = await findFileSystemEntriesRecursively(startingDirectory, {
    matches: ({ dirent }) => dirent.isFile() && dirent.name === PACKAGE_JSON_FILE_NAME,
    shouldTraverseDirectory: ({ dirent }) => dirent.name !== NODE_MODULES_DIRECTORY_NAME,
  });

  return entries.map((entry) => entry.path);
};
