import { test, expect } from 'vitest';
import type { APIProfileRelationshipList, APIUser } from '../src/realms/api/schemas';
import { app } from '../src/worker';
import { botHeaders } from './helpers/data';
import harness from './helpers/harness';

test('API profile followers returns users and cursors for known user', async () => {
  const result = await app.request(
    new Request('https://api.fxtwitter.com/2/profile/x/followers', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    harness
  );
  expect(result.status).toEqual(200);
  const response = (await result.json()) as APIProfileRelationshipList;
  expect(response.code).toEqual(200);
  expect(Array.isArray(response.results)).toBe(true);
  expect(response.results.length).toBeGreaterThan(0);
  expect(response.cursor).toBeDefined();
  expect(response.cursor.top).toBeTruthy();
  expect(response.cursor.bottom).toBeTruthy();

  const first = response.results[0] as APIUser;
  expect(first.screen_name).toBeTruthy();
  expect(first.id).toBeTruthy();
});

test('API profile following returns users and cursors for known user', async () => {
  const result = await app.request(
    new Request('https://api.fxtwitter.com/2/profile/x/following', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    harness
  );
  expect(result.status).toEqual(200);
  const response = (await result.json()) as APIProfileRelationshipList;
  expect(response.code).toEqual(200);
  expect(response.results.length).toBeGreaterThan(0);
  expect(response.cursor.bottom).toBeTruthy();

  const first = response.results[0] as APIUser;
  expect(first.screen_name).toBeTruthy();
});

test('API profile followers accepts count and cursor query params', async () => {
  const firstReq = await app.request(
    new Request('https://api.fxtwitter.com/2/profile/x/followers?count=5', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    harness
  );
  expect(firstReq.status).toEqual(200);
  const first = (await firstReq.json()) as APIProfileRelationshipList;
  expect(first.code).toEqual(200);
  expect(first.results.length).toBeLessThanOrEqual(5);
  const bottom = first.cursor.bottom;
  expect(bottom).toBeTruthy();

  const secondReq = await app.request(
    new Request(
      `https://api.fxtwitter.com/2/profile/x/followers?count=5&cursor=${encodeURIComponent(bottom as string)}`,
      {
        method: 'GET',
        headers: botHeaders
      }
    ),
    undefined,
    harness
  );
  expect(secondReq.status).toEqual(200);
  const second = (await secondReq.json()) as APIProfileRelationshipList;
  expect(second.code).toEqual(200);
  expect(second.results.length).toBeGreaterThan(0);
});

test('API profile followers returns 404 for unknown user', async () => {
  const result = await app.request(
    new Request('https://api.fxtwitter.com/2/profile/__no_such_user_fxt__/followers', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    harness
  );
  expect(result.status).toEqual(404);
  const response = (await result.json()) as APIProfileRelationshipList;
  expect(response.code).toEqual(404);
  expect(response.results).toEqual([]);
  expect(response.cursor.top).toBeNull();
  expect(response.cursor.bottom).toBeNull();
});

test('API profile following returns 404 for unknown user', async () => {
  const result = await app.request(
    new Request('https://api.fxtwitter.com/2/profile/__no_such_user_fxt__/following', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    harness
  );
  expect(result.status).toEqual(404);
  const response = (await result.json()) as APIProfileRelationshipList;
  expect(response.code).toEqual(404);
  expect(response.results).toEqual([]);
});
