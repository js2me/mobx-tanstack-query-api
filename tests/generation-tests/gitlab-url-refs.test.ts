/** @vitest-environment node */

import fs from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FIXTURE_DIR = path.resolve(__dirname, './fixtures/gitlab-url-refs');

const normalizeNewlines = (value: string) => value.replaceAll('\r\n', '\n');

async function collectGeneratedTsFiles(rootDir: string): Promise<
  { relativePath: string; content: string }[]
> {
  const results: { relativePath: string; content: string }[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        results.push({
          relativePath: path.relative(rootDir, fullPath).replace(/\\/g, '/'),
          content: normalizeNewlines(await fs.readFile(fullPath, 'utf-8')),
        });
      }
    }
  }

  await walk(rootDir);
  results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return results;
}

describe('generateApi GitLab URL refs', () => {
  let tmpRoot = '';
  let outputRoot = '';
  let baseUrl = '';
  let responsesRequestCount = 0;
  let server: Server | null = null;

  const fixturesByGitlabPath = new Map([
    [
      'src/main/resources/openapi/schema.yaml',
      path.resolve(FIXTURE_DIR, 'schema.yaml'),
    ],
    [
      'src/main/resources/openapi/common/responses.yaml',
      path.resolve(FIXTURE_DIR, 'common/responses.yaml'),
    ],
  ]);

  beforeAll(async () => {
    tmpRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'mobx-tanstack-query-api-gitlab-url-refs-'),
    );
    outputRoot = path.join(tmpRoot, 'output');

    server = createServer(async (req, res) => {
      try {
        const host = req.headers.host || '127.0.0.1';
        const requestUrl = new URL(req.url || '/', `http://${host}`);
        const match = requestUrl.pathname.match(
          /^\/api\/v4\/projects\/8882828\/repository\/files\/(.+)\/raw$/,
        );
        const encodedGitlabFilePath = match?.[1];

        if (
          !encodedGitlabFilePath ||
          requestUrl.searchParams.get('ref') !== 'master'
        ) {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }

        const gitlabFilePath = decodeURIComponent(encodedGitlabFilePath);
        const fixturePath = fixturesByGitlabPath.get(gitlabFilePath);

        if (!fixturePath) {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }

        if (gitlabFilePath.endsWith('/common/responses.yaml')) {
          responsesRequestCount += 1;
        }

        const file = await fs.readFile(fixturePath, 'utf-8');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/yaml; charset=utf-8');
        res.end(file);
      } catch {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });

    await new Promise<void>((resolve) => {
      server?.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    if (address && typeof address === 'object') {
      baseUrl = `http://127.0.0.1:${address.port}`;
    }
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      if (!server) {
        resolve();
        return;
      }

      server.close(() => resolve());
    });

    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('loads relative refs from GitLab repository file URLs', async () => {
    const schemaPath = encodeURIComponent(
      'src/main/resources/openapi/schema.yaml',
    );

    await generateApi(
      defineConfig({
        cleanOutput: true,
        removeUnusedTypes: false,
        noBarrelFiles: true,
        outputType: 'one-endpoint-per-file',
        otherCodegenParams: { silent: true },
        chooseServer: () => false,
        endpoint: 'builtin',
        input: `${baseUrl}/api/v4/projects/8882828/repository/files/${schemaPath}/raw?ref=master`,
        output: outputRoot,
      }),
    );

    const generatedFiles = await collectGeneratedTsFiles(outputRoot);
    const combined = generatedFiles
      .map(
        (file) =>
          [`/* --- ${file.relativePath} --- */`, file.content, ''].join('\n'),
      )
      .join('\n');

    expect(responsesRequestCount).toBeGreaterThan(0);
    expect(combined).toContain('export interface MemorySegmentResponseDC');
    expect(combined).toContain('export interface TestFooErrorDC');
    expect(combined).toContain('traceId?: string');
    expect(combined).toContain('export const getMemory = new Endpoint');
    expect(combined).toMatch(
      /import\s*\{[^}]*\bTestFooErrorDC\b[^}]*\}\s*from\s*"\.\.\/data-contracts"/,
    );
    expect(combined).toContain('export type GetMemoryErrorDC = TestFooErrorDC');
    expect(combined).toMatchSnapshot();
  });
});
