#!/usr/bin/env node
import * as fs from 'fs/promises';
import * as path from 'path';
import { upgradePackageJson } from './process';
import { logger } from './utils/logger';

const findPackageJsonFiles = async (startingDir: string): Promise<string[]> => {
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
      } else {
        if (entry.name === 'package.json') {
          results.push(fullPath);
        }
      }
    }
  };

  await collectFiles(startingDir);
  return results;
};

const main = async (): Promise<void> => {
  const cwd = process.cwd();
  logger.info(`Starting search for package.json files in ${cwd}...`);

  try {
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

    logger.success('Finished processing all package.json files.');
  } catch (error) {
    logger.error('Unhandled error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

main();
