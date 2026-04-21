import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_FILE = path.resolve(
  __dirname,
  './result-priority-with-explicit-data-error.swagger2.json',
);
const OUTPUT_DIR = path.resolve(
  __dirname,
  './__generated__/result-priority-with-explicit-data-error',
);
const ENDPOINT_FILE = path.resolve(OUTPUT_DIR, 'endpoints', 'get-collision.ts');
const DC_FILE = path.resolve(OUTPUT_DIR, 'data-contracts.ts');

describe('generateApi result/data/error name collision behavior', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('uses STA-renamed Output/Fail aliases when Data/Error/Result schemas all exist', async () => {
    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        filterEndpoints: [/^getCollision$/i],
      }),
    );

    const endpoint = (await fs.readFile(ENDPOINT_FILE, 'utf-8'));

    const dataContracts = (await fs.readFile(DC_FILE, 'utf-8'));

    expect(endpoint).toContain(
      'import { GetCollisionErrorDC, GetCollisionResultDC } from "../data-contracts";',
    );

    // потому что этот тип не нужен, так как можно испольовать напрямую
    expect(endpoint).not.toContain('export type GetCollisionOutputDC = GetCollisionResultDC;');
    // так
    expect(endpoint).toContain('export type GetCollisionDataDC = GetCollisionResultDC;');



    // этого типа не должно быть потому что тип с таким же именем импортируется в файл
    expect(endpoint).not.toContain('export type GetCollisionErrorDC = GetCollisionFailDC;');
    // должен быть этот тип, где Fail по сути доп резолв нейминг, если Error уже занят
    expect(endpoint).toContain('export type GetCollisionFailDC = GetCollisionErrorDC;');

    // также еще одно доказательство что нужны типы импортируются
    expect(endpoint).toContain(`import { GetCollisionErrorDC, GetCollisionResultDC } from "../data-contracts";`);

    expect(endpoint).toContain(
      'HttpResponse<GetCollisionDataDC, GetCollisionFailDC>',
    );
    expect(endpoint).toContain(
`export const getCollision = new Endpoint<
  HttpResponse<GetCollisionDataDC, GetCollisionFailDC>,`
);


    // а тут доказательство что нужные типы есть
    expect(dataContracts).toContain(
`export interface GetCollisionDataDC {
  id: string;
}

export interface GetCollisionErrorDC {
  /** @format int32 */
  code?: number;
}

export interface GetCollisionResultDC {
  data?: GetCollisionDataDC;
}
`)
  });
});
