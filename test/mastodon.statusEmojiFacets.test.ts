import { describe, expect, test } from 'vitest';
import type { Context } from 'hono';
import { buildAPIMastodonPost } from '../src/providers/mastodon/processor';

const baseAccount = (): MastodonAccount => ({
  id: '1',
  username: 'self',
  acct: 'self@mastodon.social',
  display_name: 'Self',
  locked: false,
  bot: false,
  group: false,
  created_at: '2020-01-01T00:00:00.000Z',
  note: '',
  url: 'https://mastodon.social/@self',
  avatar: '',
  avatar_static: '',
  header: '',
  header_static: '',
  followers_count: 0,
  following_count: 0,
  statuses_count: 0
});

const minimalStatus = (overrides: Partial<MastodonStatus> & Pick<MastodonStatus, 'content'>): MastodonStatus => ({
  id: '99',
  uri: 'https://mastodon.social/users/self/statuses/99',
  created_at: '2020-01-01T00:00:00.000Z',
  account: baseAccount(),
  visibility: 'public',
  sensitive: false,
  spoiler_text: '',
  media_attachments: [],
  mentions: [],
  tags: [],
  reblogs_count: 0,
  favourites_count: 0,
  replies_count: 0,
  url: 'https://mastodon.social/@self/99',
  in_reply_to_id: null,
  in_reply_to_account_id: null,
  reblog: null,
  card: null,
  language: 'en',
  ...overrides
});

describe('buildAPIMastodonPost custom emoji facets', () => {
  test('content img becomes :shortcode: with mention and hashtag facets', async () => {
    const emojis = [
      { shortcode: 'ruby', url: 'https://files.example/e/ruby.png', static_url: 'https://files.example/s/ruby.png' }
    ];
    const status = minimalStatus({
      content:
        '<p><span class="h-card"><a href="https://mastodon.social/@x" class="u-url mention">@x</a></span> ' +
        '#test ' +
        '<img src="https://files.example/e/ruby.png" alt=":ruby:" class="custom-emoji" /></p>',
      mentions: [
        {
          id: '2',
          username: 'x',
          url: 'https://mastodon.social/@x',
          acct: 'x'
        }
      ],
      tags: [{ name: 'test', url: 'https://mastodon.social/tags/test' }],
      emojis
    });

    const c = {} as Context;
    const api = await buildAPIMastodonPost(c, status, 'mastodon.social', undefined);

    expect(api.raw_text.text).toBe('@x #test :ruby:');
    const types = api.raw_text.facets.map(f => f.type);
    expect(types).toContain('mention');
    expect(types).toContain('hashtag');
    expect(types).toContain('custom_emoji');

    const ce = api.raw_text.facets.find(f => f.type === 'custom_emoji');
    expect(ce).toMatchObject({
      type: 'custom_emoji',
      display: ':ruby:',
      original: 'ruby',
      replacement: 'https://files.example/e/ruby.png',
      indices: [9, 15]
    });
  });
});
