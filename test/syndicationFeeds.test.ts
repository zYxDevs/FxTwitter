import { test, expect } from 'vitest';
import type { APITwitterStatus } from '../src/realms/api/schemas';
import {
  escapeXml,
  statusesToFeedItems,
  toAtomFeedXml,
  toRss20Xml,
  type SyndicationFeedMeta
} from '../src/helpers/syndicationFeeds';

const mockMeta: SyndicationFeedMeta = {
  channelTitle: 'Test channel',
  channelDescription: 'Test description',
  profileWebUrl: 'https://fxtwitter.com/example',
  selfUrlRss: 'https://fxtwitter.com/example/feed.xml',
  selfUrlAtom: 'https://fxtwitter.com/example/feed.atom.xml'
};

const baseStatus = (over: Partial<APITwitterStatus> = {}): APITwitterStatus =>
  ({
    id: '1',
    url: 'https://x.com/example/status/1',
    text: 'Hello <world> & "quotes"',
    created_at: 'Wed Jan 01 12:00:00 +0000 2020',
    created_timestamp: 1577880000,
    likes: 0,
    reposts: 0,
    quotes: 0,
    replies: 0,
    author: {
      id: 'u1',
      name: 'Ex',
      screen_name: 'example',
      avatar_url: null,
      banner_url: null,
      description: '',
      raw_description: { text: '', facets: [] },
      location: '',
      url: 'https://x.com/example',
      protected: false,
      followers: 1,
      following: 1,
      statuses: 1,
      media_count: 0,
      likes: 0,
      joined: '',
      website: null,
      possibly_sensitive: false
    },
    media: { photos: [], videos: [] },
    raw_text: { text: 'Hello', facets: [] },
    lang: 'en',
    possibly_sensitive: false,
    replying_to: null,
    source: null,
    embed_card: 'tweet',
    provider: 'twitter',
    is_note_tweet: false,
    community_note: null,
    reposted_by: null,
    ...over
  }) as APITwitterStatus;

test('escapeXml escapes special characters', () => {
  expect(escapeXml(`a & b < c > d ' e "`)).toBe(
    'a &amp; b &lt; c &gt; d &apos; e &quot;'
  );
});

test('statusesToFeedItems omits sensitive posts when safe mode', () => {
  const items = statusesToFeedItems(
    [
      baseStatus({ possibly_sensitive: true }),
      baseStatus({
        id: '2',
        url: 'https://x.com/example/status/2',
        possibly_sensitive: false
      })
    ],
    { omitSensitive: true }
  );
  expect(items).toHaveLength(1);
  expect(items[0].id).toBe('https://x.com/example/status/2');
});

test('toRss20Xml is well-formed and includes atom self link', () => {
  const xml = toRss20Xml(mockMeta, statusesToFeedItems([baseStatus()], {}));
  expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
  expect(xml).toContain('<atom:link href="https://fxtwitter.com/example/feed.xml" rel="self" type="application/rss+xml" />');
  expect(xml).toContain('<guid isPermaLink="true">https://x.com/example/status/1</guid>');
  expect(xml).toContain('<![CDATA[');
  expect(xml).toContain('&lt;world&gt;');
});

test('toAtomFeedXml includes self link and entry content', () => {
  const xml = toAtomFeedXml(mockMeta, statusesToFeedItems([baseStatus()], {}));
  expect(xml).toContain('xmlns="http://www.w3.org/2005/Atom"');
  expect(xml).toContain('<link href="https://fxtwitter.com/example/feed.atom.xml" rel="self" type="application/atom+xml"/>');
  expect(xml).toContain('<content type="html">');
  expect(xml).toContain('https://x.com/example/status/1');
});

test('tweet text with angle brackets is escaped inside CDATA-wrapped HTML', () => {
  const s = baseStatus({ text: 'a ]]> b' });
  const xml = toRss20Xml(mockMeta, statusesToFeedItems([s], {}));
  expect(xml).toContain('<![CDATA[');
  expect(xml).toContain(']]&gt;');
  expect(xml).not.toMatch(/\]\]>\s*b/);
});
