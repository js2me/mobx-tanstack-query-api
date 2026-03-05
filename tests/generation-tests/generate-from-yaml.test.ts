import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_DIR = path.resolve(__dirname, './generate-from-yaml.test.yaml')
const OUTPUT_DIR = path.resolve(__dirname, './__generated__')

describe('generateApi with yaml input file', () => {
  beforeEach(async () => {
    await fs.rm(path.resolve('./__generated__'), {
      recursive: true,
      force: true,
    });
  });

  it('читает playground/test.yaml и генерирует только отфильтрованные эндпоинты', async () => {
    const config = defineConfig({
      input: INPUT_DIR,
      output: OUTPUT_DIR,
      noBarrelFiles: true,
      removeUnusedTypes: true,
      outputType: 'one-endpoint-per-file',
      filterEndpoints: [
        /^browseNodeLedger$/i,
        /^createCycleMatrixRow$/i,
        /^publishRelaySignal$/i,
      ],
    });

    await generateApi(config);

    const generatedEndpointsPath = path.resolve(
      OUTPUT_DIR, 
      'endpoints',
    );
    const generatedFiles = await fs.readdir(generatedEndpointsPath);

    expect(generatedFiles).toEqual(
      expect.arrayContaining([
        'browse-node-ledger.ts',
        'create-cycle-matrix-row.ts',
        'publish-relay-signal.ts',
      ]),
    );

    expect(generatedFiles).not.toEqual(
      expect.arrayContaining([
        'register-node-ledger-entry.ts',
        'inspect-node-ledger-entry.ts',
        'tune-node-ledger-entry.ts',
        'list-cycle-matrix-rows.ts',
      ]),
    );

    await expect(
      fs.access(
        path.resolve(OUTPUT_DIR, 'data-contracts.ts'),
      ),
    ).resolves.toBeUndefined();

    const dataContractsContent = await fs.readFile(
      path.resolve(OUTPUT_DIR, 'data-contracts.ts'),
      'utf-8',
    );

    expect(dataContractsContent).not.toContain('interface NodeDraftPayloadDC');
    expect(dataContractsContent).not.toContain('interface NodePatchPayloadDC');
  });
});
