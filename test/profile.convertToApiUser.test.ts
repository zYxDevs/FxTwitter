import { test, expect } from 'vitest';
import { convertToApiUser, parseHandleOrId } from '../src/providers/twitter/profile';

test('convertToApiUser expands bio t.co from entities.description.urls and builds raw_description facets', () => {
  const rawBio = 'https://t.co/fqNKQSiLQB\n@grok it';
  const user = {
    __typename: 'User' as const,
    rest_id: '1',
    core: {
      screen_name: 'grok',
      name: 'Grok',
      created_at: 'Mon Jan 01 00:00:00 +0000 2024'
    },
    profile_bio: {
      description: rawBio,
      entities: {
        url: { urls: [] as { display_url: string; expanded_url: string; url: string }[] }
      }
    },
    legacy: {
      description: rawBio,
      screen_name: 'grok',
      name: 'Grok',
      created_at: 'Mon Jan 01 00:00:00 +0000 2024',
      followers_count: 0,
      friends_count: 0,
      favourites_count: 0,
      media_count: 0,
      statuses_count: 0,
      location: '',
      profile_banner_url: '',
      default_profile: true,
      default_profile_image: false,
      fast_followers_count: 0,
      has_custom_timelines: false,
      is_translator: false,
      listed_count: 0,
      normal_followers_count: 0,
      pinned_tweet_ids_str: [],
      possibly_sensitive: false,
      profile_interstitial_type: '',
      translator_type: '',
      want_retweets: false,
      withheld_in_countries: [],
      entities: {
        description: {
          urls: [
            {
              display_url: 'grok.com/download',
              expanded_url: 'http://grok.com/download',
              indices: [0, 23] as [number, number],
              url: 'https://t.co/fqNKQSiLQB'
            }
          ],
          user_mentions: [
            {
              indices: [24, 29] as [number, number],
              name: 'Grok',
              screen_name: 'grok',
              id_str: '123456'
            }
          ]
        }
      }
    },
    action_counts: { favorites_count: 0 },
    tweet_counts: { media_tweets: 0, tweets: 0 },
    professional: { rest_id: '', professional_type: '', category: [] },
    legacy_extended_profile: { profile_image_shape: 'Circle', rest_id: '1' },
    is_profile_translatable: false,
    is_blue_verified: false,
    verification_info: { is_identity_verified: false, reason: { description: { entities: [] } } },
    user_seed_tweet_count: 0
  } as unknown as GraphQLUser;

  const apiUser = convertToApiUser(user, false);

  expect(apiUser.description).toContain('http://grok.com/download');
  expect(apiUser.description).not.toMatch(/t\.co\//);
  expect(apiUser.raw_description.text).toEqual(rawBio);
  expect(apiUser.raw_description.facets).toEqual([
    {
      type: 'url',
      indices: [0, 23],
      original: 'https://t.co/fqNKQSiLQB',
      replacement: 'http://grok.com/download',
      display: 'grok.com/download'
    },
    {
      type: 'mention',
      indices: [24, 29],
      original: 'grok',
      id: '123456'
    }
  ]);
});

test('parseHandleOrId treats id:<digits> as userId (case-insensitive prefix)', () => {
  expect(parseHandleOrId('id:783214')).toEqual({ type: 'userId', value: '783214' });
  expect(parseHandleOrId('ID:783214')).toEqual({ type: 'userId', value: '783214' });
  expect(parseHandleOrId('  id:123  ')).toEqual({ type: 'userId', value: '123' });
});

test('parseHandleOrId leaves non-id handles as screen names', () => {
  expect(parseHandleOrId('x')).toEqual({ type: 'screenName', value: 'x' });
  expect(parseHandleOrId('id:notanumber')).toEqual({ type: 'screenName', value: 'id:notanumber' });
  expect(parseHandleOrId('id:')).toEqual({ type: 'screenName', value: 'id:' });
});
