import { cac } from 'cac';
import { VERSION } from './constants.js';

export * from './define-config.js';

const cli = cac('vite');

cli.option('-c, --config <file>', `[string] use specified config file`);

cli.help();
cli.version(VERSION);

cli.parse();
