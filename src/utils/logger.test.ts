import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logger';

const originalStdoutIsTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
const originalStderrIsTTY = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY');

const setIsTTY = (stream: NodeJS.WriteStream, isTTY: boolean): void => {
  Object.defineProperty(stream, 'isTTY', {
    configurable: true,
    value: isTTY,
  });
};

const restoreIsTTY = (stream: NodeJS.WriteStream, descriptor: PropertyDescriptor | undefined): void => {
  if (descriptor) {
    Object.defineProperty(stream, 'isTTY', descriptor);
  } else {
    Reflect.deleteProperty(stream, 'isTTY');
  }
};

describe('logger', () => {
  beforeEach(() => {
    logger.setColorEnabled(true);
    vi.stubEnv('NO_COLOR', undefined);
    setIsTTY(process.stdout, true);
    setIsTTY(process.stderr, true);
  });

  afterEach(() => {
    logger.setColorEnabled(true);
    vi.unstubAllEnvs();
    restoreIsTTY(process.stdout, originalStdoutIsTTY);
    restoreIsTTY(process.stderr, originalStderrIsTTY);
    vi.restoreAllMocks();
  });

  it('logs info with its exact blue prefix and forwards arguments', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const context = { packageName: 'typescript' };

    logger.info('test message', context);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('\x1b[34mINFO:\x1b[0m test message', context);
  });

  it('logs success with its exact green prefix and forwards arguments', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const context = { packageName: 'typescript' };

    logger.success('test message', context);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('\x1b[32mSUCCESS:\x1b[0m test message', context);
  });

  it('logs warnings with their exact yellow prefix and forwards arguments', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const context = { packageName: 'typescript' };

    logger.warn('test message', context);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('\x1b[33mWARN:\x1b[0m test message', context);
  });

  it('logs errors with their exact red prefix and forwards arguments', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const context = { packageName: 'typescript' };

    logger.error('test message', context);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('\x1b[31mERROR:\x1b[0m test message', context);
  });

  it('emits plain prefixes when the applicable streams are not interactive terminals', () => {
    setIsTTY(process.stdout, false);
    setIsTTY(process.stderr, false);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.info('info message');
    logger.success('success message');
    logger.warn('warning message');
    logger.error('error message');

    expect(logSpy).toHaveBeenNthCalledWith(1, 'INFO: info message');
    expect(logSpy).toHaveBeenNthCalledWith(2, 'SUCCESS: success message');
    expect(warnSpy).toHaveBeenCalledWith('WARN: warning message');
    expect(errorSpy).toHaveBeenCalledWith('ERROR: error message');
  });

  it('honors a non-empty NO_COLOR environment variable', () => {
    vi.stubEnv('NO_COLOR', '1');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.info('info message');
    logger.error('error message');

    expect(logSpy).toHaveBeenCalledWith('INFO: info message');
    expect(errorSpy).toHaveBeenCalledWith('ERROR: error message');
  });

  it('does not treat an empty NO_COLOR environment variable as a request to disable colors', () => {
    vi.stubEnv('NO_COLOR', '');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('test message');

    expect(spy).toHaveBeenCalledWith('\x1b[34mINFO:\x1b[0m test message');
  });

  it('allows colors to be disabled explicitly', () => {
    logger.setColorEnabled(false);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.info('info message');
    logger.error('error message');

    expect(logSpy).toHaveBeenCalledWith('INFO: info message');
    expect(errorSpy).toHaveBeenCalledWith('ERROR: error message');
  });
});
