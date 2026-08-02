import * as fs from 'fs/promises';
import { installPackages } from '../npm/install-packages';
import { logger } from '../utils/logger';
import { findReinstallTargets } from './find-reinstall-targets';

export const forceReinstallDependencies = async (workingDirectory: string): Promise<void> => {
  const targets = await findReinstallTargets(workingDirectory);

  for (const lockfilePath of targets.lockfilePaths) {
    await fs.rm(lockfilePath, { force: true });
    logger.info(`Deleted ${lockfilePath}`);
  }

  for (const nodeModulesPath of targets.nodeModulesPaths) {
    await fs.rm(nodeModulesPath, { recursive: true, force: true });
    logger.info(`Deleted ${nodeModulesPath}`);
  }

  logger.info(`Running npm install in ${workingDirectory}...`);
  await installPackages(workingDirectory);

  logger.success(`Successfully reinstalled dependencies in ${workingDirectory}`);
};
