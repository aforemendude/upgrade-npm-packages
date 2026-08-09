import * as fs from 'fs/promises';
import * as path from 'path';
import { installPackages } from '../npm/install-packages';
import { logger } from '../utils/logger';
import { findReinstallTargets } from './find-reinstall-targets';

export class ReinstallSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReinstallSafetyError';
  }
}

const pathsReferToSameLocation = (firstPath: string, secondPath: string): boolean =>
  path.resolve(firstPath) === path.resolve(secondPath);

export const forceReinstallDependencies = async (workingDirectory: string): Promise<void> => {
  const targets = await findReinstallTargets(workingDirectory);
  const workingDirectoryIsInstallRoot = targets.installRootPaths.some((installRootPath) =>
    pathsReferToSameLocation(installRootPath, workingDirectory),
  );
  const otherInstallRootPaths = targets.installRootPaths.filter(
    (installRootPath) => !pathsReferToSameLocation(installRootPath, workingDirectory),
  );

  for (const lockfilePath of targets.lockfilePaths) {
    await fs.rm(lockfilePath, { force: true });
    logger.info(`Deleted ${lockfilePath}`);
  }

  for (const nodeModulesPath of targets.nodeModulesPaths) {
    await fs.rm(nodeModulesPath, { recursive: true, force: true });
    logger.info(`Deleted ${nodeModulesPath}`);
  }

  if (workingDirectoryIsInstallRoot) {
    logger.info(`Running npm install in ${workingDirectory}...`);
    await installPackages(workingDirectory);
  }

  if (!workingDirectoryIsInstallRoot) {
    const manualInstallMessage =
      targets.installRootPaths.length === 0
        ? ''
        : ` The following directories appeared to be install roots and were cleaned, but npm install was not run in them: ${targets.installRootPaths.join(', ')}. Consider running npm install manually in each listed directory.`;
    throw new ReinstallSafetyError(
      `Skipped npm install because the current working directory appears to not be an install root: ${workingDirectory}.${manualInstallMessage}`,
    );
  }

  if (otherInstallRootPaths.length > 0) {
    throw new ReinstallSafetyError(
      `npm install ran in ${workingDirectory}. The following other directories appeared to be install roots and were cleaned, but npm install was not run in them: ${otherInstallRootPaths.join(', ')}. Consider running npm install manually in each listed directory.`,
    );
  }

  logger.success(`Successfully reinstalled dependencies in ${workingDirectory}`);
};
