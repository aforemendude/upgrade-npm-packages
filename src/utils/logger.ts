const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const formatMessage = (level: string, color: string, message: string): string =>
  `${color}${level}:${COLORS.reset} ${message}`;

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    console.log(formatMessage('INFO', COLORS.blue, message), ...args);
  },
  success: (message: string, ...args: unknown[]) => {
    console.log(formatMessage('SUCCESS', COLORS.green, message), ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(formatMessage('WARN', COLORS.yellow, message), ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(formatMessage('ERROR', COLORS.red, message), ...args);
  },
};
