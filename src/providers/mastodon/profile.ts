import type { Context } from 'hono';
import type { UserAPIResponse } from '../../realms/api/schemas';
import { assertSafeMastodonDomain, lookupAccount } from './client';
import { mastodonAccountToApiUser } from './processor';

export const mastodonUserProfileAPI = async (
  username: string,
  domain: string,
  _c: Context
): Promise<UserAPIResponse> => {
  let result: Awaited<ReturnType<typeof lookupAccount>>;
  try {
    const safeDomain = assertSafeMastodonDomain(domain);
    const acct = username.includes('@') ? username : `${username}@${safeDomain}`;
    result = await lookupAccount(safeDomain, acct);
  } catch (e) {
    if (e instanceof Error && e.message === 'invalid_domain') {
      return { code: 400, message: 'Invalid Mastodon domain' };
    }
    return { code: 500, message: 'Mastodon profile request failed' };
  }

  if (!result.ok) {
    if (result.status === 404 || result.status === 400) {
      return { code: 404, message: 'User not found' };
    }
    return { code: 500, message: 'Mastodon profile request failed' };
  }

  if (!result.data?.id) {
    return { code: 404, message: 'User not found' };
  }

  return {
    code: 200,
    message: 'OK',
    user: mastodonAccountToApiUser(result.data, domain)
  };
};
