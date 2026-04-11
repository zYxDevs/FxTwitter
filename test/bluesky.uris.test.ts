import { expect, test } from 'vitest';
import { blueskyWebPostUrl, didFromAtUri, rkeyFromPostAtUri } from '../src/providers/bluesky/uris';

test('rkeyFromPostAtUri extracts record key', () => {
  expect(rkeyFromPostAtUri('at://did:plc:abc123/app.bsky.feed.post/3lhzfc23cc22v')).toEqual(
    '3lhzfc23cc22v'
  );
  expect(rkeyFromPostAtUri(null)).toBeNull();
});

test('didFromAtUri extracts DID', () => {
  expect(didFromAtUri('at://did:plc:abc123/app.bsky.feed.post/rkey')).toEqual('did:plc:abc123');
  expect(didFromAtUri('at://did:web:example.com/app.bsky.feed.post/rkey')).toEqual(
    'did:web:example.com'
  );
  expect(didFromAtUri('at://user.bsky.social/app.bsky.feed.post/rkey')).toBeNull();
  expect(didFromAtUri('at://Did:plc:abc/app.bsky.feed.post/rkey')).toBeNull();
  expect(didFromAtUri('at://did:/app.bsky.feed.post/rkey')).toBeNull();
  expect(didFromAtUri('https://bsky.app')).toBeNull();
});

test('bskyWebPostUrl', () => {
  expect(blueskyWebPostUrl('user.bsky.social', '3labc')).toEqual(
    'https://bsky.app/profile/user.bsky.social/post/3labc'
  );
});
