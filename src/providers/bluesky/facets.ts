import type { APIFacet } from '../../realms/api/schemas';
import { UnicodeString } from '../../helpers/unicodestring';

/** Map UTF-8 byte offset in `text` to UTF-16 code unit index (Bluesky facets use UTF-8 bytes). */
const utf8ByteOffsetToUtf16Index = (text: string, byteOffset: number): number => {
  const u = new UnicodeString(text);
  let i = 0;
  while (i <= text.length && u.utf16IndexToUtf8Index(i) < byteOffset) {
    i++;
  }
  return Math.min(i, text.length);
};

export const blueskyFacetsToApiFacets = (
  text: string,
  facets: BlueskyFacet[] | undefined | null
): APIFacet[] => {
  if (!facets?.length || !text) return [];
  const out: APIFacet[] = [];
  for (const facet of facets) {
    const start = utf8ByteOffsetToUtf16Index(text, facet.index.byteStart);
    const end = utf8ByteOffsetToUtf16Index(text, facet.index.byteEnd);
    for (const feature of facet.features) {
      if (feature.$type === 'app.bsky.richtext.facet#link' && feature.uri) {
        out.push({
          type: 'link',
          indices: [start, end],
          display: text.slice(start, end),
          replacement: feature.uri
        });
      }
      if (feature.$type === 'app.bsky.richtext.facet#mention' && feature.did) {
        out.push({
          type: 'mention',
          indices: [start, end],
          display: text.slice(start, end),
          id: feature.did
        });
      }
    }
  }
  return out;
};
