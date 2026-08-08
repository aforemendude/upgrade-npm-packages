import { bin, name } from '../../package.json';
import { ALLOW_SYMLINKS_ARGUMENT, FORCE_REINSTALL_ARGUMENT } from './parse-cli-arguments';

const commandName = Object.keys(bin)[0] ?? name;

export const getHelpMessage = (): string =>
  [
    `Usage: ${commandName} [options]`,
    '',
    'Options:',
    `  ${ALLOW_SYMLINKS_ARGUMENT}   Allow symbolic-link manifests, including targets outside the scanned directory`,
    `  ${FORCE_REINSTALL_ARGUMENT}  Refresh package locks and node_modules after upgrading dependencies`,
    '  -h, --help         Show this help message',
  ].join('\n');
