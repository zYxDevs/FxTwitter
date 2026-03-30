import { test, expect } from 'vitest';
import { app } from '../src/worker';
import { botHeaders } from './helpers/data';
import harness from './helpers/harness';

test('GET /2/openapi.json returns OpenAPI 3 document with v2 paths', async () => {
  const result = await app.request(
    new Request('https://api.fxtwitter.com/2/openapi.json', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    harness
  );
  expect(result.status).toBe(200);
  expect(result.headers.get('content-type')).toContain('application/json');
  const doc = (await result.json()) as {
    openapi: string;
    info: { title: string; version: string };
    paths: Record<string, unknown>;
  };
  expect(doc.openapi).toMatch(/^3\.0\./);
  expect(doc.info.title).toBe('FxTwitter API');
  expect(doc.paths['/2/status/{id}']).toBeDefined();
  expect(doc.paths['/2/status/{id}/reposts']).toBeDefined();
  expect(doc.paths['/2/openapi.json']).toBeUndefined();
  expect(doc.paths['/2/owoembed']).toBeUndefined();
  expect(doc.paths['/2/hit']).toBeUndefined();
  expect(doc.paths['/2/go']).toBeUndefined();
});
