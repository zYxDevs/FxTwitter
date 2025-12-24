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
