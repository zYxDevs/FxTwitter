import { test, expect } from 'vitest';
import type { APITrendsResponse } from '../src/realms/api/schemas';
import { app } from '../src/worker';
import { botHeaders } from './helpers/data';
import harness from './helpers/harness';

test('API trends returns parsed trends from mocked ExplorePage initial timeline', async () => {
  const result = await app.request(
    new Request('https://api.fxtwitter.com/2/trends', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    harness
  );
  expect(result.status).toEqual(200);
  const body = (await result.json()) as APITrendsResponse;
  expect(body.code).toBe(200);
  expect(body.timeline_type).toBe('trending');
  expect(body.trends.length).toBeGreaterThanOrEqual(2);
  expect(body.trends[0].name).toBe('#ExampleTrend');
  expect(body.trends[1].grouped_topics?.length).toBe(1);
  expect(body.cursor.top).toBe('cursor-top-mock');
  expect(body.cursor.bottom).toBe('cursor-bottom-mock');
});

test('API trends returns 400 for unsupported type', async () => {
  const result = await app.request(
    new Request('https://api.fxtwitter.com/2/trends?type=unknown_kind', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    harness
  );
  expect(result.status).toEqual(400);
  const body = (await result.json()) as { code?: number; message?: string };
  expect(body.code).toBe(400);
  expect(typeof body.message).toBe('string');
  expect(body.message!.length).toBeGreaterThan(0);
});
