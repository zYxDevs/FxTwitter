import { expect, test } from 'vitest';
import { blueskyFacetsToApiFacets } from '../src/providers/bluesky/facets';

test('blueskyFacetsToApiFacets maps link facets to UTF-16 indices', () => {
  const text = 'hello https://ex.com end';
  const facets: BlueskyFacet[] = [
    {
      index: { byteStart: 6, byteEnd: 23 },
      features: [
        {
          $type: 'app.bsky.richtext.facet#link',
          uri: 'https://example.com/page'
        }
      ]
    }
  ];
  const api = blueskyFacetsToApiFacets(text, facets);
  expect(api.length).toBe(1);
  expect(api[0].type).toBe('link');
  expect(text.slice(api[0].indices[0], api[0].indices[1])).toMatch(/https:\/\/ex\.com/);
});
