import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  afterEach(() => {
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
});
