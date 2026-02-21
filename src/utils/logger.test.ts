import { describe, it, expect, vi } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  it('should log info with blue color', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('test message');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('\x1b[34mINFO:\x1b[0m test message'));
    spy.mockRestore();
  });

  it('should log success with green color', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.success('test message');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('\x1b[32mSUCCESS:\x1b[0m test message'));
    spy.mockRestore();
  });

  it('should log warn with yellow color', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('test message');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('\x1b[33mWARN:\x1b[0m test message'));
    spy.mockRestore();
  });

  it('should log error with red color', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('test message');
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/\x1b\[31mERROR:\x1b\[0m test message/));
    spy.mockRestore();
  });
});
