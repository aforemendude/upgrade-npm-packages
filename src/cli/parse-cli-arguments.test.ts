import { describe, expect, it } from 'vitest';
import { CliUsageError, parseCliArguments } from './parse-cli-arguments';

describe('parseCliArguments', () => {
  it('detects the force reinstall flag', () => {
    expect(parseCliArguments([])).toEqual({
      allowSymlinks: false,
      forceReinstall: false,
      help: false,
    });
    expect(parseCliArguments(['--force-reinstall'])).toEqual({
      allowSymlinks: false,
      forceReinstall: true,
      help: false,
    });
  });

  it('detects the allow symlinks flag', () => {
    expect(parseCliArguments(['--allow-symlinks'])).toEqual({
      allowSymlinks: true,
      forceReinstall: false,
      help: false,
    });
  });

  it('detects help flags', () => {
    expect(parseCliArguments(['--help'])).toEqual({
      allowSymlinks: false,
      forceReinstall: false,
      help: true,
    });
    expect(parseCliArguments(['-h'])).toEqual({
      allowSymlinks: false,
      forceReinstall: false,
      help: true,
    });
    expect(parseCliArguments(['--allow-symlinks', '--force-reinstall', '--help'])).toEqual({
      allowSymlinks: true,
      forceReinstall: true,
      help: true,
    });
  });

  it('reports one unexpected argument with a singular message', () => {
    expect(() => parseCliArguments(['--unknown'])).toThrow('Unexpected argument: --unknown');
  });

  it('rejects unexpected arguments', () => {
    const parseUnexpectedArguments = () => parseCliArguments(['packages/app', '--unknown']);

    expect(parseUnexpectedArguments).toThrow(CliUsageError);
    expect(parseUnexpectedArguments).toThrow('Unexpected arguments: packages/app, --unknown');
  });
});
