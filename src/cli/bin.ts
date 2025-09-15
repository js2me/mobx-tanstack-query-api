import { cac } from 'cac';
import { generateApi } from '../codegen/index.js';
import { defineConfig } from './utils/define-config.js';
import { execConfigPath } from './utils/exec-config-path.js';
import { resolveConfigPath } from './utils/resolve-config-path.js';

let cli = cac('mobx-tanstack-query-api');

cli = cli.option('-c, --config <file>', `[string] use specified config file`);

cli.help();

const parsed = cli.parse();

if (!parsed.options.help) {
  const configPath = resolveConfigPath(
    typeof parsed.options.config === 'string' ? parsed.options.config : null,
  );

  execConfigPath(configPath).then((generateApiParams) => {
    defineConfig(generateApiParams as any).forEach(generateApi);
  });
}
