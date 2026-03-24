import { test, expect } from 'vitest';
import { APISearchResults, APITwitterStatus } from '../src/types/types';
import { app } from '../src/worker';
import { botHeaders, twitterBaseUrl } from './helpers/data';
import harness from './helpers/harness';

test('API profile statuses returns tweets and cursors for known user', async () => {
  const result = await app.request(
    new Request('https://api.fxtwitter.com/2/profile/x/statuses', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    harness
  );
  expect(result.status).toEqual(200);
  const response = (await result.json()) as APISearchResults;
  expect(response.code).toEqual(200);
  expect(response.results).toBeDefined();
  expect(Array.isArray(response.results)).toBe(true);
  expect(response.results.length).toBeGreaterThan(0);
  expect(response.cursor).toBeDefined();
  expect(response.cursor.top).toBeTruthy();
  expect(response.cursor.bottom).toBeTruthy();
  expect(typeof response.cursor.top).toBe('string');
  expect(typeof response.cursor.bottom).toBe('string');

  const first = response.results[0] as APITwitterStatus;
  expect(first.id).toBeTruthy();
  expect(first.text).toBeTruthy();
  expect(first.url).toContain(twitterBaseUrl);
  expect(first.url).toContain('/status/');
  expect(first.author?.screen_name).toBeTruthy();
});

test('API profile statuses accepts count and cursor query params', async () => {
  const result = await app.request(
    new Request(
      'https://api.fxtwitter.com/2/profile/x/statuses?count=5&cursor=DAAHCgABHEJR3hu___QLAAIAAAATMjAyODI4MTMx',
      {
        method: 'GET',
        headers: botHeaders
      }
    ),
    undefined,
    harness
  );
  expect(result.status).toEqual(200);
  const response = (await result.json()) as APISearchResults;
  expect(response.code).toEqual(200);
  expect(response.results.length).toBeGreaterThan(0);
});

test('API profile statuses returns 404 for unknown user', async () => {
  const result = await app.request(
    new Request('https://api.fxtwitter.com/2/profile/__no_such_user_fxt__/statuses', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    harness
  );
  expect(result.status).toEqual(404);
  const response = (await result.json()) as APISearchResults;
  expect(response.code).toEqual(404);
  expect(response.results).toEqual([]);
  expect(response.cursor.top).toBeNull();
  expect(response.cursor.bottom).toBeNull();
});
