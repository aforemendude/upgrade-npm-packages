import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Dirent } from 'fs';
import * as fs from 'fs/promises';
import { parseArgs, run } from './cli';
import { forceReinstall, upgradePackageJson } from './process';

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    readdir: vi.fn(),
  };
});

vi.mock('./process', () => ({
  forceReinstall: vi.fn().mockResolvedValue(undefined),
  upgradePackageJson: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const createDirent = (name: string, isDirectory: boolean): Dirent =>
  ({
    name,
    isDirectory: () => isDirectory,
  }) as Dirent;

const mockDirectoryEntries = (entries: Map<string, Dirent[]>) => {
  (fs.readdir as any).mockImplementation(async (dir: string) => entries.get(String(dir)) ?? []);
};

const mockPackageTree = () => {
  mockDirectoryEntries(
    new Map<string, Dirent[]>([
      [
        '/repo',
        [createDirent('package.json', false), createDirent('node_modules', true), createDirent('packages', true)],
      ],
      ['/repo/packages', [createDirent('app', true)]],
      ['/repo/packages/app', [createDirent('package.json', false)]],
    ]),
  );
};

describe('parseArgs', () => {
  it('should detect the force reinstall flag', () => {
    expect(parseArgs([])).toEqual({ forceReinstall: false });
    expect(parseArgs(['--force-reinstall'])).toEqual({ forceReinstall: true });
  });
});

describe('run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(forceReinstall).mockResolvedValue(undefined);
    vi.mocked(upgradePackageJson).mockResolvedValue(undefined);
  });

  it('should upgrade package.json files without reinstalling by default', async () => {
    mockPackageTree();

    await run({ args: [], cwd: '/repo' });

    expect(upgradePackageJson).toHaveBeenCalledTimes(2);
    expect(upgradePackageJson).toHaveBeenNthCalledWith(1, '/repo/package.json');
    expect(upgradePackageJson).toHaveBeenNthCalledWith(2, '/repo/packages/app/package.json');
    expect(forceReinstall).not.toHaveBeenCalled();
    expect(fs.readdir).not.toHaveBeenCalledWith('/repo/node_modules', expect.anything());
  });

  it('should run one force reinstall at cwd after all package.json files when the flag is present', async () => {
    const order: string[] = [];
    mockPackageTree();
    vi.mocked(upgradePackageJson).mockImplementation(async (filePath) => {
      order.push(`upgrade:${filePath}`);
    });
    vi.mocked(forceReinstall).mockImplementation(async (cwd) => {
      order.push(`reinstall:${cwd}`);
    });

    await run({ args: ['--force-reinstall'], cwd: '/repo' });

    expect(forceReinstall).toHaveBeenCalledTimes(1);
    expect(forceReinstall).toHaveBeenCalledWith('/repo');
    expect(order).toEqual(['upgrade:/repo/package.json', 'upgrade:/repo/packages/app/package.json', 'reinstall:/repo']);
  });
});
