import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const credMocks = vi.hoisted(() => ({
  initCredentials: vi.fn().mockResolvedValue(undefined),
  hasBundledEncryptedCredentials: vi.fn(() => true),
  hasBlueskyProxyAccounts: vi.fn(() => true),
  getShuffledBlueskyAccounts: vi.fn(() => [
    { identifier: 'u.test', appPassword: 'x', service: 'https://pds.example' }
  ])
}));

const sessionMocks = vi.hoisted(() => ({
  getBlueskyAccessJwt: vi.fn().mockResolvedValue('jwt-test'),
  invalidateBlueskySession: vi.fn()
}));

vi.mock('../src/providers/twitter/proxy/credentials', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/providers/twitter/proxy/credentials')>();
  return {
    ...actual,
    initCredentials: credMocks.initCredentials,
    hasBundledEncryptedCredentials: credMocks.hasBundledEncryptedCredentials,
    hasBlueskyProxyAccounts: credMocks.hasBlueskyProxyAccounts,
    getShuffledBlueskyAccounts: credMocks.getShuffledBlueskyAccounts
  };
});

vi.mock('../src/providers/bluesky/session', () => sessionMocks);

import { fetchActorProfile, fetchPostThread } from '../src/providers/bluesky/client';

beforeEach(() => {
  credMocks.initCredentials.mockClear();
  sessionMocks.getBlueskyAccessJwt.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('fetchPostThread uses PDS proxy when public API returns 503', async () => {
  const calls: { url: string; authorization?: string }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;
    const headers = init?.headers;
    let authorization: string | undefined;
    if (headers && typeof headers === 'object' && !Array.isArray(headers) && !(headers instanceof Headers)) {
      authorization = (headers as Record<string, string>)['Authorization'];
    } else if (headers instanceof Headers) {
      authorization = headers.get('Authorization') ?? undefined;
    }
    calls.push({ url, authorization });

    if (url.includes('public.api.bsky.app')) {
      return new Response('unavailable', { status: 503 });
    }
    if (url.includes('pds.example')) {
      expect(authorization).toBe('Bearer jwt-test');
      return new Response(JSON.stringify({ thread: { $type: 'test', post: null } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });

  const result = await fetchPostThread('at://did:plc:x/app.bsky.feed.post/rkey', 1, undefined, {
    credentialKey: 'dummy-key'
  });

  expect(result).not.toBeNull();
  expect(calls.some(c => c.url.includes('public.api.bsky.app'))).toBe(true);
  expect(calls.some(c => c.url.includes('pds.example'))).toBe(true);
  expect(credMocks.initCredentials).toHaveBeenCalledWith('dummy-key');
});

test('fetchPostThread does not call proxy when public returns NotFound', async () => {
  const calls: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push(url);
    if (url.includes('public.api.bsky.app')) {
      return new Response(JSON.stringify({ error: 'NotFound', message: 'Not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });

  const result = await fetchPostThread('at://did:plc:x/app.bsky.feed.post/missing', 1, undefined, {
    credentialKey: 'dummy-key'
  });

  expect(result).toBeNull();
  expect(calls.length).toBe(1);
  expect(calls[0]).toContain('public.api.bsky.app');
  expect(credMocks.initCredentials).not.toHaveBeenCalled();
});

test('fetchActorProfile preserves public outage when proxy returns NotFound', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('public.api.bsky.app')) {
      return new Response('upstream overloaded', { status: 503 });
    }
    if (url.includes('pds.example')) {
      return new Response(JSON.stringify({ error: 'NotFound', message: 'Record not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });

  const result = await fetchActorProfile('did:plc:test', { credentialKey: 'dummy-key' });

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.status).toBe(503);
    expect(result.body).toContain('overloaded');
  }
});
