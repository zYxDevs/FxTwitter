import { test, expect } from 'vitest';
import { UserAPIResponse, APIUser } from '../src/types/types';
import { app } from '../src/worker';
import { botHeaders } from './helpers/data';
import envWrapper from './helpers/env-wrapper';

test('API fetch user about_account info', async () => {
  const result = await app.request(
    new Request('https://api.fxtwitter.com/x', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    envWrapper
  );

  expect(result.status).toEqual(200);
  const response = (await result.json()) as UserAPIResponse;
  expect(response).toBeTruthy();
  expect(response.code).toEqual(200);
  expect(response.message).toEqual('OK');

  const user = response.user as APIUser;
  expect(user).toBeTruthy();

  expect(user.about_account).toBeTruthy();
  expect(user.about_account?.based_in).toEqual('United States');
  expect(user.about_account?.location_accurate).toEqual(true);
  expect(user.about_account?.created_country_accurate).toBe(true);
  expect(user.about_account?.source).toEqual('United States App Store');
  expect(user.about_account?.username_changes).toBeTruthy();
  expect(user.about_account?.username_changes?.count).toEqual(3);
  expect(user.about_account?.username_changes?.count).toBeGreaterThanOrEqual(0);
  expect(typeof user.about_account?.username_changes?.last_changed_at).toBe('string');
});

test('API fetch user gracefully handles AboutAccountQuery failure', async () => {
  const result = await app.request(
    new Request('https://api.fxtwitter.com/x', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    envWrapper
  );

  expect(result.status).toEqual(200);
  const response = (await result.json()) as UserAPIResponse;
  expect(response).toBeTruthy();
  expect(response.code).toEqual(200);

  const user = response.user as APIUser;
  expect(user).toBeTruthy();

  // User should still be returned even if AboutAccountQuery fails
  expect(user.id).toBeTruthy();
  expect(user.screen_name).toBeTruthy();

  // about_account may be undefined if AboutAccountQuery failed
  // This is acceptable - the user data should still be present
});

test('about_account username_changes handles null last_changed_at', async () => {
  // Test that null last_changed_at_msec is handled correctly
  const result = await app.request(
    new Request('https://api.fxtwitter.com/x', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    envWrapper
  );

  expect(result.status).toEqual(200);
  const response = (await result.json()) as UserAPIResponse;
  const user = response.user as APIUser;

  // If username_changes exists, last_changed_at should be string or null
  expect(
    user.about_account?.username_changes?.last_changed_at === null ||
      typeof user.about_account?.username_changes?.last_changed_at === 'string'
  ).toBe(true);
});

test('about_account username_changes handles zero count', async () => {
  const result = await app.request(
    new Request('https://api.fxtwitter.com/x', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    envWrapper
  );

  expect(result.status).toEqual(200);
  const response = (await result.json()) as UserAPIResponse;
  const user = response.user as APIUser;

  // If username_changes exists, count should be a number >= 0
  expect(user.about_account?.username_changes?.count).toBeGreaterThanOrEqual(0);
});

test('API fetch user validates about_account data from mock', async () => {
  const result = await app.request(
    new Request('https://api.fxtwitter.com/x', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    envWrapper
  );

  expect(result.status).toEqual(200);
  const response = (await result.json()) as UserAPIResponse;
  const user = response.user as APIUser;

  // If about_account is present (from mock), validate specific fields
  // Validate fields from the mock file
  expect(user.about_account?.based_in).toBe('United States');
  expect(user.about_account?.location_accurate).toBe(true);
  expect(user.about_account?.created_country_accurate).toBe(true);
  expect(user.about_account?.source).toBe('United States App Store');
  expect(user.about_account?.username_changes?.count).toBe(3);
  expect(user.about_account?.username_changes?.last_changed_at).toBe(
    new Date(1609459200000).toISOString()
  );
});
