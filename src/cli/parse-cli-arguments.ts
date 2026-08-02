export const FORCE_REINSTALL_ARGUMENT = '--force-reinstall';

const HELP_ARGUMENTS = new Set(['--help', '-h']);
const ALLOWED_ARGUMENTS = new Set([FORCE_REINSTALL_ARGUMENT, ...HELP_ARGUMENTS]);

export type CliOptions = {
  forceReinstall: boolean;
  help: boolean;
};

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

const formatUnexpectedArgumentsMessage = (unexpectedArguments: string[]): string => {
  const noun = unexpectedArguments.length === 1 ? 'argument' : 'arguments';
  return `Unexpected ${noun}: ${unexpectedArguments.join(', ')}`;
};

export const parseCliArguments = (args: string[]): CliOptions => {
  const unexpectedArguments = args.filter((argument) => !ALLOWED_ARGUMENTS.has(argument));

  if (unexpectedArguments.length > 0) {
    throw new CliUsageError(formatUnexpectedArgumentsMessage(unexpectedArguments));
  }

  return {
    forceReinstall: args.includes(FORCE_REINSTALL_ARGUMENT),
    help: args.some((argument) => HELP_ARGUMENTS.has(argument)),
  };
};
