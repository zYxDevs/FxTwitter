import { describe, expect, test } from 'vitest';
import { mastodonAccountToApiUser } from '../src/providers/mastodon/processor';

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

describe('mastodonAccountToApiUser note facets', () => {
  test('mention, hashtag, and link from typical Mastodon note HTML', () => {
    const note =
      '<p>Hi <a href="https://mastodon.social/@Gargron" class="mention">@<span>Gargron</span></a> see ' +
      '<a href="https://mastodon.social/tags/ruby" class="mention hashtag" rel="tag">#<span>ruby</span></a> ' +
      '<a href="https://joinmastodon.org/" target="_blank" rel="nofollow noopener">joinmastodon.org</a></p>';
    const u = mastodonAccountToApiUser({ ...baseAccount(), note }, 'mastodon.social');
    expect(u.raw_description.text).toBe('Hi @Gargron see #ruby joinmastodon.org');
    expect(u.description).toBe(u.raw_description.text);
    const { facets } = u.raw_description;
    expect(facets).toHaveLength(3);
    expect(facets[0]).toMatchObject({
      type: 'mention',
      indices: [3, 11],
      display: '@Gargron',
      original: 'Gargron@mastodon.social'
    });
    expect(facets[1]).toMatchObject({
      type: 'hashtag',
      indices: [16, 21],
      display: '#ruby',
      original: 'ruby'
    });
    expect(facets[2]).toMatchObject({
      type: 'url',
      indices: [22, 38],
      display: 'joinmastodon.org',
      replacement: 'https://joinmastodon.org/'
    });
  });

  test('relative /@ profile href resolves acct from instance host', () => {
    const note = 'Ping <a href="/@Gargron" class="mention">@Gargron</a>';
    const u = mastodonAccountToApiUser({ ...baseAccount(), note }, 'mastodon.social');
    expect(u.raw_description.text).toBe('Ping @Gargron');
    expect(u.raw_description.facets[0]).toMatchObject({
      type: 'mention',
      display: '@Gargron',
      original: 'Gargron@mastodon.social'
    });
  });

  test('preserves spacing around inline links', () => {
    const note = 'a <a href="https://mastodon.social/tags/x" class="mention hashtag" rel="tag">#x</a> b';
    const u = mastodonAccountToApiUser({ ...baseAccount(), note }, 'mastodon.social');
    expect(u.raw_description.text).toBe('a #x b');
  });

  test('custom emoji img becomes :shortcode: and custom_emoji facet', () => {
    const emojis = [
      { shortcode: 'blobcat', url: 'https://files.example/custom/blobcat.png', static_url: 'https://files.example/static/blobcat.png' }
    ];
    const note =
      '<p>Hi <img src="https://files.example/custom/blobcat.png" alt=":blobcat:" title=":blobcat:" class="custom-emoji" /></p>';
    const u = mastodonAccountToApiUser({ ...baseAccount(), note, emojis }, 'mastodon.social');
    expect(u.raw_description.text).toBe('Hi :blobcat:');
    const emojiFacet = u.raw_description.facets.find(f => f.type === 'custom_emoji');
    expect(emojiFacet).toMatchObject({
      type: 'custom_emoji',
      indices: [3, 12],
      display: ':blobcat:',
      original: 'blobcat',
      replacement: 'https://files.example/custom/blobcat.png'
    });
  });
});
