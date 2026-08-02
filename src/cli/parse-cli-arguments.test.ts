import { describe, expect, it } from 'vitest';
import { CliUsageError, parseCliArguments } from './parse-cli-arguments';

describe('parseCliArguments', () => {
  it('detects the force reinstall flag', () => {
    expect(parseCliArguments([])).toEqual({
      forceReinstall: false,
      help: false,
    });
    expect(parseCliArguments(['--force-reinstall'])).toEqual({
      forceReinstall: true,
      help: false,
    });
  });

  it('detects help flags', () => {
    expect(parseCliArguments(['--help'])).toEqual({
      forceReinstall: false,
      help: true,
    });
    expect(parseCliArguments(['-h'])).toEqual({
      forceReinstall: false,
      help: true,
    });
    expect(parseCliArguments(['--force-reinstall', '--help'])).toEqual({
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
