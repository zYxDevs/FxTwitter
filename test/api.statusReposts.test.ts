import { test, expect } from 'vitest';
import type { APIUserListResults } from '../src/realms/api/schemas';
import { app } from '../src/worker';
import { botHeaders, twitterBaseUrl } from './helpers/data';
import harness from './helpers/harness';

test('API status reposts returns users and cursor envelope for a known post', async () => {
  const result = await app.request(
    new Request('https://api.fxtwitter.com/2/status/20/reposts', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    harness
  );
  expect([200, 404, 500]).toContain(result.status);
  const response = (await result.json()) as APIUserListResults;
  expect(response).toBeTruthy();
  expect(typeof response.code).toBe('number');
  expect(Array.isArray(response.results)).toBe(true);
  expect(response.cursor).toBeDefined();
  expect(response.cursor).toHaveProperty('top');
  expect(response.cursor).toHaveProperty('bottom');

  if (response.code === 200 && response.results.length > 0) {
    const u = response.results[0];
    expect(u.screen_name).toBeTruthy();
    expect(u.id).toBeTruthy();
    expect(u.url).toContain(twitterBaseUrl);
  }
});

test('API status reposts accepts count query param', async () => {
  const result = await app.request(
    new Request('https://api.fxtwitter.com/2/status/20/reposts?count=5', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    harness
  );
  expect([200, 404, 500]).toContain(result.status);
  const response = (await result.json()) as APIUserListResults;
  expect(Array.isArray(response.results)).toBe(true);
});
