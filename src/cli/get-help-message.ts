import { bin, name } from '../../package.json';
import { FORCE_REINSTALL_ARGUMENT } from './parse-cli-arguments';

const commandName = Object.keys(bin)[0] ?? name;

export const getHelpMessage = (): string =>
  [
    `Usage: ${commandName} [options]`,
    '',
    'Options:',
    `  ${FORCE_REINSTALL_ARGUMENT}  Refresh package locks and node_modules after upgrading dependencies`,
    '  -h, --help         Show this help message',
  ].join('\n');
