import { name, version } from '../../package.json';
import { findPackageJsonFiles } from '../package-json/find-package-json-files';
import { upgradePackageJson } from '../package-json/upgrade-package-json';
import { forceReinstallDependencies } from '../reinstall/force-reinstall-dependencies';
import { logger } from '../utils/logger';
import { getHelpMessage } from './get-help-message';
import { FORCE_REINSTALL_ARGUMENT, parseCliArguments } from './parse-cli-arguments';

export type RunUpgradeCommandOptions = {
  args: string[];
  workingDirectory: string;
};

export const runUpgradeCommand = async ({ args, workingDirectory }: RunUpgradeCommandOptions): Promise<void> => {
  logger.info(`${name} ${version}`);

  const options = parseCliArguments(args);
  if (options.help) {
    logger.info(getHelpMessage());
    return;
  }

  logger.info(`Starting search for package.json files in ${workingDirectory}...`);
  const packageJsonFiles = await findPackageJsonFiles(workingDirectory, {
    allowSymlinks: options.allowSymlinks,
  });

  if (packageJsonFiles.length === 0) {
    logger.error('No package.json files found.');
    return;
  }

  logger.info(`Found ${packageJsonFiles.length} package.json files:`);
  for (const filePath of packageJsonFiles) {
    logger.info(`- ${filePath}`);
  }

  for (const filePath of packageJsonFiles) {
    logger.info(`Processing ${filePath}...`);
    await upgradePackageJson(filePath);
  }

  if (options.forceReinstall) {
    await forceReinstallDependencies(workingDirectory);
  } else {
    logger.info(`Skipping reinstall. Pass ${FORCE_REINSTALL_ARGUMENT} to refresh package locks and node_modules.`);
  }

  logger.success('Finished processing all package.json files.');
};
