import * as fs from 'fs/promises';
import * as path from 'path';
import { name, version } from '../package.json';
import { forceReinstall, upgradePackageJson } from './process';
import { logger } from './utils/logger';

const FORCE_REINSTALL_ARG = '--force-reinstall';
const HELP_ARGS = new Set(['--help', '-h']);
const ALLOWED_ARGS = new Set([FORCE_REINSTALL_ARG, ...HELP_ARGS]);

type CliOptions = {
  forceReinstall: boolean;
  help: boolean;
};

type RunOptions = {
  args: string[];
  cwd: string;
};

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

export const getHelpMessage = (): string =>
  [
    `Usage: ${name} [options]`,
    '',
    'Options:',
    `  ${FORCE_REINSTALL_ARG}  Refresh package locks and node_modules after upgrading dependencies`,
    '  -h, --help         Show this help message',
  ].join('\n');

const formatUnexpectedArgsMessage = (unexpectedArgs: string[]): string => {
  const noun = unexpectedArgs.length === 1 ? 'argument' : 'arguments';
  return `Unexpected ${noun}: ${unexpectedArgs.join(', ')}`;
};

export const parseArgs = (args: string[]): CliOptions => {
  const unexpectedArgs = args.filter((arg) => !ALLOWED_ARGS.has(arg));

  if (unexpectedArgs.length > 0) {
    throw new CliUsageError(formatUnexpectedArgsMessage(unexpectedArgs));
  }

  return {
    forceReinstall: args.includes(FORCE_REINSTALL_ARG),
    help: args.some((arg) => HELP_ARGS.has(arg)),
  };
};

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

  if (options.help) {
    logger.info(getHelpMessage());
    return;
  }

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
    if (error instanceof CliUsageError) {
      logger.error(error.message);
      logger.info(getHelpMessage());
      process.exit(1);
    }

    logger.error('Unhandled error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};
