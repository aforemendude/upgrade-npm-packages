import * as path from 'path';
import { findFileSystemEntriesRecursively } from '../utils/find-file-system-entries';

const PACKAGE_LOCK_FILE_NAME = 'package-lock.json';
const NODE_MODULES_DIRECTORY_NAME = 'node_modules';

export type ReinstallTargets = {
  installRootPaths: string[];
  lockfilePaths: string[];
  nodeModulesPaths: string[];
};

export const findReinstallTargets = async (startingDirectory: string): Promise<ReinstallTargets> => {
  const entries = await findFileSystemEntriesRecursively(startingDirectory, {
    matches: ({ dirent }) =>
      (dirent.isFile() && dirent.name === PACKAGE_LOCK_FILE_NAME) ||
      (dirent.isDirectory() && dirent.name === NODE_MODULES_DIRECTORY_NAME),
    shouldTraverseDirectory: ({ dirent }) => dirent.name !== NODE_MODULES_DIRECTORY_NAME,
  });

  const targets: ReinstallTargets = {
    installRootPaths: [],
    lockfilePaths: [],
    nodeModulesPaths: [],
  };
  const lockfileRootPaths = new Set<string>();
  const nodeModulesRootPaths = new Set<string>();

  for (const entry of entries) {
    const rootPath = path.dirname(entry.path);

    if (entry.dirent.isDirectory()) {
      nodeModulesRootPaths.add(rootPath);
      targets.nodeModulesPaths.push(entry.path);
    } else {
      lockfileRootPaths.add(rootPath);
      targets.lockfilePaths.push(entry.path);
    }
  }

  targets.installRootPaths = [...lockfileRootPaths].filter((rootPath) => nodeModulesRootPaths.has(rootPath)).sort();
  targets.lockfilePaths.sort();
  targets.nodeModulesPaths.sort();
  return targets;
};
