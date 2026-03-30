import { test, expect } from 'vitest';
import { app } from '../src/worker';
import { botHeaders } from './helpers/data';
import harness from './helpers/harness';

test('Twitter realm serves RSS for profile feed.xml', async () => {
  const res = await app.request(
    new Request('https://fxtwitter.com/x/feed.xml', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    harness
  );
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('application/rss+xml');
  const text = await res.text();
  expect(text).toContain('<rss version="2.0"');
  expect(text).toContain('<atom:link');
  expect(text).toContain('rel="self"');
  expect(text).toMatch(/status\/\d+/);
});

test('Twitter realm serves Atom for profile feed.atom.xml', async () => {
  const res = await app.request(
    new Request('https://fxtwitter.com/x/feed.atom.xml', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    harness
  );
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('application/atom+xml');
  const text = await res.text();
  expect(text).toContain('xmlns="http://www.w3.org/2005/Atom"');
  expect(text).toContain('rel="self"');
});

test('API profile feed.xml works without User-Agent', async () => {
  const res = await app.request(
    new Request('https://api.fxtwitter.com/2/profile/x/feed.xml', {
      method: 'GET'
    }),
    undefined,
    harness
  );
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('rss+xml');
});

test('API profile feed.atom.xml works without User-Agent', async () => {
  const res = await app.request(
    new Request('https://api.fxtwitter.com/2/profile/x/feed.atom.xml', {
      method: 'GET'
    }),
    undefined,
    harness
  );
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('atom+xml');
});

test('Twitter realm serves RSS for profile media.xml', async () => {
  const res = await app.request(
    new Request('https://fxtwitter.com/x/media.xml', {
      method: 'GET',
      headers: botHeaders
    }),
    undefined,
    harness
  );
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('application/rss+xml');
  const text = await res.text();
  expect(text).toContain('<rss version="2.0"');
  expect(text).toContain('media.xml');
  expect(text).toContain('rel="self"');
});

test('API profile media.xml works without User-Agent', async () => {
  const res = await app.request(
    new Request('https://api.fxtwitter.com/2/profile/x/media.xml', {
      method: 'GET'
    }),
    undefined,
    harness
  );
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('rss+xml');
});
