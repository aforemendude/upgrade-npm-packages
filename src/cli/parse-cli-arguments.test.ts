import { describe, expect, it } from 'vitest';
import { CliUsageError, parseCliArguments } from './parse-cli-arguments';

describe('parseCliArguments', () => {
  it('detects the force reinstall flag', () => {
    expect(parseCliArguments([])).toEqual({
      allowSymlinks: false,
      forceReinstall: false,
      help: false,
      noColor: false,
    });
    expect(parseCliArguments(['--force-reinstall'])).toEqual({
      allowSymlinks: false,
      forceReinstall: true,
      help: false,
      noColor: false,
    });
  });

  it('detects the allow symlinks flag', () => {
    expect(parseCliArguments(['--allow-symlinks'])).toEqual({
      allowSymlinks: true,
      forceReinstall: false,
      help: false,
      noColor: false,
    });
  });

  it('detects the no color flag', () => {
    expect(parseCliArguments(['--no-color'])).toEqual({
      allowSymlinks: false,
      forceReinstall: false,
      help: false,
      noColor: true,
    });
  });

  it('detects help flags', () => {
    expect(parseCliArguments(['--help'])).toEqual({
      allowSymlinks: false,
      forceReinstall: false,
      help: true,
      noColor: false,
    });
    expect(parseCliArguments(['-h'])).toEqual({
      allowSymlinks: false,
      forceReinstall: false,
      help: true,
      noColor: false,
    });
    expect(parseCliArguments(['--allow-symlinks', '--force-reinstall', '--help'])).toEqual({
      allowSymlinks: true,
      forceReinstall: true,
      help: true,
      noColor: false,
    });
  });

  it('rejects unknown options in strict mode', () => {
    const parseUnknownOption = () => parseCliArguments(['--unknown']);

    expect(parseUnknownOption).toThrow(CliUsageError);
    expect(parseUnknownOption).toThrow("Unknown option '--unknown'");
  });

  it('rejects positional arguments in strict mode', () => {
    const parsePositionalArgument = () => parseCliArguments(['packages/app']);

    expect(parsePositionalArgument).toThrow(CliUsageError);
    expect(parsePositionalArgument).toThrow(
      "Unexpected argument 'packages/app'. This command does not take positional arguments",
    );
  });

  it('rejects values for boolean options in strict mode', () => {
    expect(() => parseCliArguments(['--force-reinstall=true'])).toThrow(
      "Option '--force-reinstall' does not take an argument",
    );
  });
});
