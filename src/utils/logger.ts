const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

let colorEnabled = true;

const hasNoColorEnvironmentVariable = (): boolean => {
  const noColor = process.env['NO_COLOR'];
  return noColor !== undefined && noColor !== '';
};

const formatMessage = (level: string, color: string, message: string, stream: NodeJS.WriteStream): string => {
  const prefix =
    colorEnabled && !hasNoColorEnvironmentVariable() && stream.isTTY ? `${color}${level}:${COLORS.reset}` : `${level}:`;
  return `${prefix} ${message}`;
};

export const logger = {
  setColorEnabled: (enabled: boolean) => {
    colorEnabled = enabled;
  },
  info: (message: string, ...args: unknown[]) => {
    console.log(formatMessage('INFO', COLORS.blue, message, process.stdout), ...args);
  },
  success: (message: string, ...args: unknown[]) => {
    console.log(formatMessage('SUCCESS', COLORS.green, message, process.stdout), ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(formatMessage('WARN', COLORS.yellow, message, process.stderr), ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(formatMessage('ERROR', COLORS.red, message, process.stderr), ...args);
  },
};
