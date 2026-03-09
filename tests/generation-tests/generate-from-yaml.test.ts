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
      generateZodContracts: true,
      filterEndpoints: [
        /^fooBarBaz$/i,
        /^getGoldenApple$/i,
        /^browseNodeLedger$/i,
        /^createCycleMatrixRow$/i,
        /^publishRelaySignal$/i,
        // format inference: json, text, formData, blob (spreadsheet, octet, image, audio, video, font, model, message), +json
        /^getTextReport$/i,
        /^getMultipartReport$/i,
        /^getBinaryReport$/i,
        /^getImageReport$/i,
        /^getAudioReport$/i,
        /^getVideoReport$/i,
        /^getFontReport$/i,
        /^getModelReport$/i,
        /^getMessageReport$/i,
        /^getJsonVariantReport$/i,
        // inferRequestBodyContentTypeFromRaw: request body contentType
        /^submitFormEncodedReport$/i,
        /^submitMultipartReport$/i,
        /^submitPlainTextReport$/i,
        /^submitBinaryUploadReport$/i,
        /^submitMultiContentReport$/i,
        /^applyMergePatchReport$/i,
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
        'get-golden-apple.ts',
        'publish-relay-signal.ts',
        'get-text-report.ts',
        'get-multipart-report.ts',
        'get-binary-report.ts',
        'get-image-report.ts',
        'get-audio-report.ts',
        'get-video-report.ts',
        'get-font-report.ts',
        'get-model-report.ts',
        'get-message-report.ts',
        'get-json-variant-report.ts',
        'submit-form-encoded-report.ts',
        'submit-multipart-report.ts',
        'submit-plain-text-report.ts',
        'submit-binary-upload-report.ts',
        'submit-multi-content-report.ts',
        'apply-merge-patch-report.ts',
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

    const readEndpoint = (fileName: string) =>
      fs.readFile(path.resolve(OUTPUT_DIR, 'endpoints', fileName), 'utf-8');

    // format "json" — application/json
    const createCycleMatrixRowContent = await readEndpoint(
      'create-cycle-matrix-row.ts',
    );
    expect(createCycleMatrixRowContent).toContain('format: "json"');

    // request body contentType — application/json (requestBody.content)
    expect(createCycleMatrixRowContent).toContain(
      'contentType: "application/json"',
    );

    // format "json" — +json (application/vnd.api+json)
    const getJsonVariantReportContent = await readEndpoint(
      'get-json-variant-report.ts',
    );
    expect(getJsonVariantReportContent).toContain('format: "json"');

    // format "text" — text/*
    const getTextReportContent = await readEndpoint('get-text-report.ts');
    expect(getTextReportContent).toContain('format: "text"');

    // no request body → no contentType (GET)
    expect(getTextReportContent).not.toMatch(/contentType:\s*["']/);

    // format "formData" — multipart/form-data
    const getMultipartReportContent = await readEndpoint(
      'get-multipart-report.ts',
    );
    expect(getMultipartReportContent).toContain('format: "formData"');

    // format "blob" — spreadsheet/vnd. (foo-bar-baz)
    const fooBarBazContent = await readEndpoint('foo-bar-baz.ts');
    expect(fooBarBazContent).toContain('format: "blob"');

    // no request body → no contentType in params (GET without requestBody)
    expect(fooBarBazContent).not.toMatch(/contentType:\s*["']/);

    // format "blob" — application/octet-stream
    const getBinaryReportContent = await readEndpoint('get-binary-report.ts');
    expect(getBinaryReportContent).toContain('format: "blob"');

    // JSDoc: @see from operation.externalDocs
    expect(getBinaryReportContent).toContain(
      '@see https://api.example.com/docs/binary-report',
    );
    expect(getBinaryReportContent).toContain('Binary report API reference');

    // JSDoc: @security from operation.security scheme names
    expect(getBinaryReportContent).toContain('@security TestBearer');

    // format "blob" — image/*
    const getImageReportContent = await readEndpoint('get-image-report.ts');
    expect(getImageReportContent).toContain('format: "blob"');

    // format "blob" — audio/*
    const getAudioReportContent = await readEndpoint('get-audio-report.ts');
    expect(getAudioReportContent).toContain('format: "blob"');

    // format "blob" — video/*
    const getVideoReportContent = await readEndpoint('get-video-report.ts');
    expect(getVideoReportContent).toContain('format: "blob"');

    // format "blob" — font/*
    const getFontReportContent = await readEndpoint('get-font-report.ts');
    expect(getFontReportContent).toContain('format: "blob"');

    // format "blob" — model/*
    const getModelReportContent = await readEndpoint('get-model-report.ts');
    expect(getModelReportContent).toContain('format: "blob"');

    // format "blob" — message/*
    const getMessageReportContent = await readEndpoint('get-message-report.ts');
    expect(getMessageReportContent).toContain('format: "blob"');

    // request body contentType — publish-relay-signal also has application/json body
    const publishRelaySignalContent = await readEndpoint(
      'publish-relay-signal.ts',
    );
    expect(publishRelaySignalContent).toContain(
      'contentType: "application/json"',
    );

    // JSDoc: @produces for response content type
    expect(getAudioReportContent).toContain('@produces audio/mpeg');

    // browse-node-ledger: GET without request body → no contentType
    const browseNodeLedgerContent = await readEndpoint(
      'browse-node-ledger.ts',
    );
    expect(browseNodeLedgerContent).not.toMatch(/contentType:\s*["']/);

    // --- inferRequestBodyContentTypeFromRaw: request body contentType ---
    // application/x-www-form-urlencoded
    const submitFormEncodedContent = await readEndpoint(
      'submit-form-encoded-report.ts',
    );
    expect(submitFormEncodedContent).toContain(
      'contentType: "application/x-www-form-urlencoded"',
    );
    // multipart/form-data
    const submitMultipartContent = await readEndpoint(
      'submit-multipart-report.ts',
    );
    expect(submitMultipartContent).toContain(
      'contentType: "multipart/form-data"',
    );
    // text/plain (text/*)
    const submitPlainTextContent = await readEndpoint(
      'submit-plain-text-report.ts',
    );
    expect(submitPlainTextContent).toContain('contentType: "text/plain"');
    // application/octet-stream
    const submitBinaryUploadContent = await readEndpoint(
      'submit-binary-upload-report.ts',
    );
    expect(submitBinaryUploadContent).toContain(
      'contentType: "application/octet-stream"',
    );
    // preferredOrder: when both json and form-urlencoded present → json first
    const submitMultiContentContent = await readEndpoint(
      'submit-multi-content-report.ts',
    );
    expect(submitMultiContentContent).toContain(
      'contentType: "application/json"',
    );
    // generateZodContracts: zod contracts for params and data
    expect(submitMultiContentContent).toContain('import * as z from "zod"');
    expect(submitMultiContentContent).toContain(
      'submitMultiContentReportContracts',
    );
    expect(submitMultiContentContent).toContain(
      'params: submitMultiContentReportParamsSchema',
    );
    expect(submitMultiContentContent).toContain(
      'data: submitMultiContentReportDataSchema',
    );
    expect(submitMultiContentContent).toContain('contracts: submitMultiContentReportContracts');
    // application/merge-patch+json (+json) → "application/json"
    const applyMergePatchContent = await readEndpoint(
      'apply-merge-patch-report.ts',
    );
    expect(applyMergePatchContent).toContain(
      'contentType: "application/json"',
    );
  });
});
