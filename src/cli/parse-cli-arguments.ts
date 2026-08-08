import { parseArgs } from 'node:util';

export const ALLOW_SYMLINKS_ARGUMENT = '--allow-symlinks';
export const FORCE_REINSTALL_ARGUMENT = '--force-reinstall';

const CLI_OPTIONS = {
  'allow-symlinks': {
    type: 'boolean',
  },
  'force-reinstall': {
    type: 'boolean',
  },
  help: {
    type: 'boolean',
    short: 'h',
  },
} as const;

export type CliOptions = {
  allowSymlinks: boolean;
  forceReinstall: boolean;
  help: boolean;
};

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

export const parseCliArguments = (args: string[]): CliOptions => {
  try {
    const { values } = parseArgs({
      args,
      options: CLI_OPTIONS,
      strict: true,
    });

    return {
      allowSymlinks: values['allow-symlinks'] ?? false,
      forceReinstall: values['force-reinstall'] ?? false,
      help: values.help ?? false,
    };
  } catch (error) {
    throw new CliUsageError(error instanceof Error ? error.message : String(error));
  }
};
