import * as fs from 'fs/promises';
import * as path from 'path';
import { name, version } from '../package.json';
import { forceReinstall, upgradePackageJson } from './process';
import { logger } from './utils/logger';

const FORCE_REINSTALL_ARG = '--force-reinstall';

type CliOptions = {
  forceReinstall: boolean;
};

type RunOptions = {
  args: string[];
  cwd: string;
};

export const parseArgs = (args: string[]): CliOptions => ({
  forceReinstall: args.includes(FORCE_REINSTALL_ARG),
});

export const findPackageJsonFiles = async (startingDir: string): Promise<string[]> => {
  const results: string[] = [];

  const collectFiles = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') {
          continue;
        }
        await collectFiles(fullPath);
      } else if (entry.name === 'package.json') {
        results.push(fullPath);
      }
    }
  };

  await collectFiles(startingDir);
  return results;
};

export const run = async ({ args, cwd }: RunOptions): Promise<void> => {
  logger.info(`${name} ${version}`);

  const options = parseArgs(args);
  logger.info(`Starting search for package.json files in ${cwd}...`);

  const packageJsonFiles = await findPackageJsonFiles(cwd);

  if (packageJsonFiles.length === 0) {
    logger.error('No package.json files found.');
    return;
  }

  logger.info(`Found ${packageJsonFiles.length} package.json files:`);
  for (const file of packageJsonFiles) {
    logger.info(`- ${file}`);
  }

  for (const file of packageJsonFiles) {
    logger.info(`Processing ${file}...`);
    await upgradePackageJson(file);
  }

  if (options.forceReinstall) {
    await forceReinstall(cwd);
  } else {
    logger.info(`Skipping reinstall. Pass ${FORCE_REINSTALL_ARG} to refresh package locks and node_modules.`);
  }

  logger.success('Finished processing all package.json files.');
};

export const runCli = async (): Promise<void> => {
  try {
    await run({ args: process.argv.slice(2), cwd: process.cwd() });
  } catch (error) {
    logger.error('Unhandled error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};
