import { EventEmitter } from 'events';
import spawn from 'cross-spawn';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runNpmCommand } from './run-npm-command';

vi.mock('cross-spawn', () => ({
  default: vi.fn(),
}));

type MockChild = EventEmitter & {
  stderr?: EventEmitter;
  stdout?: EventEmitter;
};

const createMockChild = (includeOutputStreams = true): MockChild => {
  const child = new EventEmitter() as MockChild;
  if (includeOutputStreams) {
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
  }
  return child;
};

describe('runNpmCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs npm without a shell and returns complete stdout and stderr', async () => {
    const child = createMockChild();
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);

    const result = runNpmCommand(['view', 'package'], { cwd: '/repo', shell: true });
    child.stdout?.emit('data', Buffer.from('first '));
    child.stdout?.emit('data', 'second');
    child.stderr?.emit('data', Buffer.from('warning'));
    child.emit('close', 0);

    await expect(result).resolves.toEqual({ stdout: 'first second', stderr: 'warning' });
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledWith('npm', ['view', 'package'], {
      cwd: '/repo',
      shell: false,
    });
  });

  it('rejects with the command, exit code, and stderr after a nonzero exit', async () => {
    const child = createMockChild();
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);

    const result = runNpmCommand(['view', 'package']);
    child.stderr?.emit('data', 'permission denied');
    child.emit('close', 2);

    await expect(result).rejects.toThrow('npm view exited with code 2\npermission denied');
  });

  it('propagates a subprocess spawn error', async () => {
    const child = createMockChild();
    const spawnError = new Error('npm executable not found');
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);

    const result = runNpmCommand(['install']);
    child.emit('error', spawnError);

    await expect(result).rejects.toBe(spawnError);
  });

  it('returns empty output when the child has no output streams', async () => {
    const child = createMockChild(false);
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);

    const result = runNpmCommand(['install']);
    child.emit('close', 0);

    await expect(result).resolves.toEqual({ stdout: '', stderr: '' });
  });
});
