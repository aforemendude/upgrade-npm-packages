const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`${COLORS.blue}INFO:${COLORS.reset} ${message}`, ...args);
  },
  success: (message: string, ...args: any[]) => {
    console.log(`${COLORS.green}SUCCESS:${COLORS.reset} ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`${COLORS.yellow}WARN:${COLORS.reset} ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`${COLORS.red}ERROR:${COLORS.reset} ${message}`, ...args);
  },
};

export default logger;
