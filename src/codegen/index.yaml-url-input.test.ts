/** @vitest-environment node */

import * as fs from 'node:fs/promises';
import { createServer } from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateApi } from './index.js';

const petstoreYaml = `
openapi: "3.0.0"
info:
  version: 1.0.0
  title: Swagger Petstore
  license:
    name: MIT
servers:
  - url: http://petstore.swagger.io/v1
paths:
  /pets:
    get:
      summary: List all pets
      operationId: listPets
      tags:
        - pets
      parameters:
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            format: int32
      responses:
        "200":
          description: A paged array of pets
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Pets"
        default:
          description: unexpected error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
  /pets/{petId}:
    get:
      summary: Info for a specific pet
      operationId: showPetById
      tags:
        - pets
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Expected response to a valid request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Pet"
        default:
          description: unexpected error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
components:
  schemas:
    Pet:
      type: object
      required:
        - id
        - name
      properties:
        id:
          type: integer
          format: int64
        name:
          type: string
        tag:
          type: string
    Pets:
      type: array
      items:
        $ref: "#/components/schemas/Pet"
    Error:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: integer
          format: int32
        message:
          type: string
`;

const petstoreSpec = {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Swagger Petstore',
    license: { name: 'MIT' },
  },
  servers: [{ url: 'http://petstore.swagger.io/v1' }],
  paths: {
    '/pets': {
      get: {
        summary: 'List all pets',
        operationId: 'listPets',
        tags: ['pets'],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', format: 'int32' },
          },
        ],
        responses: {
          '200': {
            description: 'A paged array of pets',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Pets' },
              },
            },
          },
          default: {
            description: 'unexpected error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/pets/{petId}': {
      get: {
        summary: 'Info for a specific pet',
        operationId: 'showPetById',
        tags: ['pets'],
        parameters: [
          {
            name: 'petId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Expected response to a valid request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Pet' },
              },
            },
          },
          default: {
            description: 'unexpected error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Pet: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'integer', format: 'int64' },
          name: { type: 'string' },
          tag: { type: 'string' },
        },
      },
      Pets: { type: 'array', items: { $ref: '#/components/schemas/Pet' } },
      Error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'integer', format: 'int32' },
          message: { type: 'string' },
        },
      },
    },
  },
} as const;

async function readAllFiles(dir: string): Promise<string> {
  const entries = await fs.readdir(dir, { recursive: true });
  const contents: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = await fs.stat(fullPath);
    if (stat.isFile()) {
      contents.push(await fs.readFile(fullPath, { encoding: 'utf8' }));
    }
  }
  return contents.join('\n');
}

describe('generateApi with YAML URL input', () => {
  let tmpdir: string;
  let server: ReturnType<typeof createServer>;
  let yamlUrl: string;

  beforeAll(async () => {
    tmpdir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'mobx-tanstack-query-api-yaml-url-'),
    );

    server = createServer((req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/yaml');
      res.end(petstoreYaml);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, 'localhost', () => resolve());
    });

    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    yamlUrl = `http://localhost:${port}/openapi.yaml`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await fs.rm(tmpdir, { recursive: true, force: true });
  });

  it('generates API from a YAML URL passed as string input', async () => {
    const outputDir = path.join(tmpdir, 'yaml-url-output');

    await generateApi({
      input: yamlUrl,
      output: outputDir,
      noBarrelFiles: true,
      noMetaInfo: true,
    });

    const content = await readAllFiles(outputDir);

    expect(content).toContain('Pet');
    expect(content).toContain('Error');
    expect(content).toContain('listPets');
    expect(content).toContain('showPetById');
  });

  it('generates identical output whether input is YAML URL string or pre-parsed object', async () => {
    const urlOutputDir = path.join(tmpdir, 'from-url');
    const specOutputDir = path.join(tmpdir, 'from-spec');

    await generateApi({
      input: yamlUrl,
      output: urlOutputDir,
      noBarrelFiles: true,
      noMetaInfo: true,
    });

    await generateApi({
      input: petstoreSpec,
      output: specOutputDir,
      noBarrelFiles: true,
      noMetaInfo: true,
    });

    const urlContent = await readAllFiles(urlOutputDir);
    const specContent = await readAllFiles(specOutputDir);

    expect(urlContent).toBe(specContent);
  });
});
