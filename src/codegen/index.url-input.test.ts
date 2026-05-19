/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => {
  const enoent = (): never => {
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    throw err;
  };
  return {
    statSync: vi.fn(() => {
      enoent();
    }) as any,
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    statSync: (...args: Parameters<typeof actual.statSync>) =>
      fsMocks.statSync(...args),
  };
});

const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());

vi.stubGlobal('fetch', fetchMock);

import { generateApi } from './index.js';

describe('generateApi url input with mocked fetch', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fsMocks.statSync.mockReset();
    fsMocks.statSync.mockImplementation(() => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    });
  });

  it('throws friendly error when URL returns non-json body (e.g. unauthorized)', async () => {
    const badUrl = 'http://foobar.com/schema.json';

    fetchMock.mockResolvedValue(
      new Response('unauthorized', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    await expect(
      generateApi({
        input: badUrl,
        output: './url-input-unauthorized-out',
        noBarrelFiles: true,
        noMetaInfo: true,
      }),
    ).rejects.toMatchObject({
      message: `⛔ failed to load swagger schema based on input ${badUrl}`,
      cause: expect.objectContaining({
        message: expect.stringContaining(
          "Cannot create property 'info' on string",
        ),
      }),
    });

    expect(fetchMock).toHaveBeenCalledWith(badUrl, expect.objectContaining({}));
  });
});
