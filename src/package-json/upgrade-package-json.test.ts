import * as fs from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLatestPackageVersion, getLatestPackageVersionOfMajor } from '../npm/get-latest-version';
import { logger } from '../utils/logger';
import { upgradePackageJson } from './upgrade-package-json';

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn(),
  };
});

vi.mock('../npm/get-latest-version', () => ({
  getLatestPackageVersion: vi.fn().mockResolvedValue('2.0.0'),
  getLatestPackageVersionOfMajor: vi.fn().mockResolvedValue('1.5.0'),
}));

vi.mock('../utils/stringify-json', () => ({
  stringifyJsonWithSortedKeys: vi.fn((value) => JSON.stringify(value)),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('upgradePackageJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upgrades dependency versions and writes the package.json', async () => {
    const filePath = '/test/package.json';
    (fs.readFile as any).mockResolvedValue(JSON.stringify({ dependencies: { 'some-pkg': '1.0.0' } }));

    await upgradePackageJson(filePath);

    expect(getLatestPackageVersion).toHaveBeenCalledWith('some-pkg', '1.0.0');
    expect(fs.writeFile).toHaveBeenCalledWith(filePath, expect.any(String), 'utf-8');
  });

  it('uses an aliased package registry name and preserves the alias', async () => {
    const filePath = '/test/package.json';
    (fs.readFile as any).mockResolvedValue(
      JSON.stringify({
        dependencies: {
          'custom-name': 'npm:other-package@1.0.0',
        },
      }),
    );

    await upgradePackageJson(filePath);

    expect(getLatestPackageVersion).toHaveBeenCalledWith('other-package', '1.0.0');
    const writtenPackageJson = JSON.parse((fs.writeFile as any).mock.calls[0][1]);
    expect(writtenPackageJson.dependencies['custom-name']).toBe('npm:other-package@2.0.0');
  });

  it('applies same-major upgrades to scoped packages behind an alias', async () => {
    vi.mocked(getLatestPackageVersionOfMajor).mockResolvedValueOnce('18.1.1');
    const filePath = '/test/package.json';
    (fs.readFile as any).mockResolvedValue(
      JSON.stringify({
        devDependencies: {
          'node-types': 'npm:@types/node@^18.1.0',
        },
      }),
    );

    await upgradePackageJson(filePath);

    expect(getLatestPackageVersionOfMajor).toHaveBeenCalledWith('@types/node', 18, '18.1.0');
    expect(getLatestPackageVersion).not.toHaveBeenCalled();
    const writtenPackageJson = JSON.parse((fs.writeFile as any).mock.calls[0][1]);
    expect(writtenPackageJson.devDependencies['node-types']).toBe('npm:@types/node@18.1.1');
  });

  it('writes package.json files without dependency sections', async () => {
    const filePath = '/test/package.json';
    (fs.readFile as any).mockResolvedValue('{}');

    await expect(upgradePackageJson(filePath)).resolves.not.toThrow();
    expect(fs.writeFile).toHaveBeenCalledWith(filePath, '{}', 'utf-8');
  });

  it("skips '*' versions and continues upgrading the section", async () => {
    const filePath = '/test/package.json';
    (fs.readFile as any).mockResolvedValue(
      JSON.stringify({
        dependencies: {
          'some-pkg': '*',
          'other-pkg': '1.0.0',
        },
      }),
    );

    await upgradePackageJson(filePath);

    expect(logger.warn).toHaveBeenCalledWith("Skipping some-pkg as it has '*' version");
    expect(getLatestPackageVersion).toHaveBeenCalledWith('other-pkg', '1.0.0');
    expect(vi.mocked(getLatestPackageVersion).mock.calls.some(([packageName]) => packageName === 'some-pkg')).toBe(
      false,
    );
  });

  it('passes the current version to same-major package selection', async () => {
    const filePath = '/test/package.json';
    (fs.readFile as any).mockResolvedValue(
      JSON.stringify({
        devDependencies: { '@types/node': '^18.1.0' },
      }),
    );

    await upgradePackageJson(filePath);

    expect(getLatestPackageVersionOfMajor).toHaveBeenCalledWith('@types/node', 18, '18.1.0');
    expect(getLatestPackageVersion).not.toHaveBeenCalled();
  });

  it('passes an incomplete range to same-major package selection', async () => {
    const filePath = '/test/package.json';
    (fs.readFile as any).mockResolvedValue(JSON.stringify({ devDependencies: { '@types/node': '^18' } }));

    await upgradePackageJson(filePath);

    expect(getLatestPackageVersionOfMajor).toHaveBeenCalledWith('@types/node', 18, '^18');
    expect(getLatestPackageVersion).not.toHaveBeenCalled();
  });

  it('passes unsupported references to unrestricted version selection', async () => {
    const filePath = '/test/package.json';
    (fs.readFile as any).mockResolvedValue(
      JSON.stringify({
        devDependencies: { '@types/node': 'workspace:*' },
      }),
    );

    await upgradePackageJson(filePath);

    expect(getLatestPackageVersion).toHaveBeenCalledWith('@types/node', 'workspace:*');
    expect(getLatestPackageVersionOfMajor).not.toHaveBeenCalled();
  });

  it('keeps the current reference when no eligible version is returned', async () => {
    vi.mocked(getLatestPackageVersion).mockResolvedValueOnce('');
    const filePath = '/test/package.json';
    (fs.readFile as any).mockResolvedValue(JSON.stringify({ dependencies: { 'some-pkg': '^2.0.0' } }));

    await upgradePackageJson(filePath);

    const writtenPackageJson = JSON.parse((fs.writeFile as any).mock.calls[0][1]);
    expect(writtenPackageJson.dependencies['some-pkg']).toBe('^2.0.0');
  });

  it('passes an incomplete range to selection and pins the result', async () => {
    const filePath = '/test/package.json';
    (fs.readFile as any).mockResolvedValue(JSON.stringify({ dependencies: { 'some-pkg': '>=2' } }));

    await upgradePackageJson(filePath);

    expect(getLatestPackageVersion).toHaveBeenCalledWith('some-pkg', '>=2');
    const writtenPackageJson = JSON.parse((fs.writeFile as any).mock.calls[0][1]);
    expect(writtenPackageJson.dependencies['some-pkg']).toBe('2.0.0');
  });

  it('pins the current version extracted from a range', async () => {
    const filePath = '/test/package.json';
    (fs.readFile as any).mockResolvedValue(JSON.stringify({ dependencies: { 'some-pkg': '^2.0.0' } }));

    await upgradePackageJson(filePath);

    expect(getLatestPackageVersion).toHaveBeenCalledWith('some-pkg', '2.0.0');
    const writtenPackageJson = JSON.parse((fs.writeFile as any).mock.calls[0][1]);
    expect(writtenPackageJson.dependencies['some-pkg']).toBe('2.0.0');
  });
});
