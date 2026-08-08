import { logger } from '../utils/logger';
import { PackageJsonSymlinkError } from '../package-json/find-package-json-files';
import { getHelpMessage } from './get-help-message';
import { CliUsageError } from './parse-cli-arguments';
import { NoPackageJsonFilesError, runUpgradeCommand } from './run-upgrade-command';

export const runCli = async (): Promise<void> => {
  try {
    await runUpgradeCommand({
      args: process.argv.slice(2),
      workingDirectory: process.cwd(),
    });
  } catch (error) {
    if (error instanceof CliUsageError) {
      logger.error(error.message);
      logger.info(getHelpMessage());
      process.exit(1);
    }

    if (error instanceof PackageJsonSymlinkError || error instanceof NoPackageJsonFilesError) {
      logger.error(error.message);
      process.exit(1);
    }

    logger.error('Unhandled error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};
