import { describe, expect, it, vi } from 'vitest';
import { runCli } from './cli/run-cli';

vi.mock('./cli/run-cli', () => ({
  runCli: vi.fn().mockResolvedValue(undefined),
}));

describe('index', () => {
  it('runs the CLI once when the executable entry point loads', async () => {
    await import('./index.js');

    expect(runCli).toHaveBeenCalledTimes(1);
    expect(runCli).toHaveBeenCalledWith();
  });
});
