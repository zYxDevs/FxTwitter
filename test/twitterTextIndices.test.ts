import { describe, expect, test } from 'vitest';
import {
  facetUtf16RangeOnPlainText,
  normalizeUtf16EntityRange,
  sliceByUtf16EntityIndices,
  unicodeScalarRangeToUtf16Range,
  utf16IndexFromUnicodeScalarOffset
} from '../src/helpers/twitterTextIndices';

describe('utf16IndexFromUnicodeScalarOffset', () => {
  test('counts BMP and supplementary scalars', () => {
    const t = 'a\uD83D\uDE00b';
    expect(utf16IndexFromUnicodeScalarOffset(t, 0)).toBe(0);
    expect(utf16IndexFromUnicodeScalarOffset(t, 1)).toBe(1);
    expect(utf16IndexFromUnicodeScalarOffset(t, 2)).toBe(3);
  });
});

describe('unicodeScalarRangeToUtf16Range', () => {
  test('maps scalar span over emoji to UTF-16 slice range', () => {
    const t = 'x\uD83D\uDE00y';
    expect(unicodeScalarRangeToUtf16Range(t, 1, 2)).toEqual([1, 3]);
    expect(sliceByUtf16EntityIndices(t, 1, 3)).toBe('\uD83D\uDE00');
  });
});

describe('facetUtf16RangeOnPlainText', () => {
  test('passes through when not note-tweet unicode mode', () => {
    const facet = { type: 'bold' as const, indices: [1, 3] as [number, number] };
    expect(facetUtf16RangeOnPlainText('abcd', facet, false)).toEqual([1, 3]);
  });

  test('converts richtext facet on note tweet', () => {
    const t = 'a\uD83D\uDE00bc';
    const facet = { type: 'bold' as const, indices: [1, 3] as [number, number] };
    expect(facetUtf16RangeOnPlainText(t, facet, true)).toEqual([1, 4]);
  });

  test('converts hashtag indices on note tweet (scalars, same as GraphQL entity_set)', () => {
    const t = 'a\uD83D\uDE00#tag';
    const facet = { type: 'hashtag' as const, indices: [2, 6] as [number, number] };
    expect(facetUtf16RangeOnPlainText(t, facet, true)).toEqual([3, 7]);
  });
});

describe('normalizeUtf16EntityRange', () => {
  test('clamps and keeps valid surrogate range intact', () => {
    const t = '\uD83D\uDE00';
    expect(normalizeUtf16EntityRange(t, 0, 2)).toEqual([0, 2]);
    expect(sliceByUtf16EntityIndices(t, 0, 2)).toBe(t);
  });
});
