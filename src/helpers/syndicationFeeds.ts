import type { APITwitterStatus } from '../realms/api/schemas';
import { truncateWithEllipsis } from './utils';

export type SyndicationFeedMeta = {
  channelTitle: string;
  channelDescription: string;
  profileWebUrl: string;
  selfUrlRss: string;
  selfUrlAtom: string;
  /** Feed-level Atom author (RFC 4287); not duplicated on entries. */
  authorName?: string;
};

export type SyndicationFeedItem = {
  id: string;
  url: string;
  title: string;
  updated: Date;
  htmlContent: string;
};

/** Escape text for XML text nodes and attribute values. */
export const escapeXml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** CDATA cannot contain the literal `]]>` — split if present. */
const cdataWrap = (inner: string): string =>
  `<![CDATA[${inner.replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;

const toRfc822 = (d: Date): string => d.toUTCString();

const toIso8601 = (d: Date): string => d.toISOString();

function buildItemHtml(
  status: APITwitterStatus,
  options: { omitSensitive?: boolean } = {}
): string {
  const body = escapeXml(status.text).replace(/\n/g, '<br />\n');
  const parts: string[] = [`<p>${body}</p>`];

  const mediaList = status.media?.all?.length
    ? status.media.all
    : [...(status.media?.photos ?? []), ...(status.media?.videos ?? [])];

  for (const m of mediaList) {
    const url = m.url;
    if (!url) continue;
    if (m.type === 'photo' || m.type === 'gif' || m.type === 'mosaic_photo') {
      const alt = 'altText' in m && m.altText ? m.altText : '';
      parts.push(
        `<p><a href="${escapeXml(url)}"><img src="${escapeXml(url)}" alt="${escapeXml(alt)}" /></a></p>`
      );
    } else {
      parts.push(`<p><a href="${escapeXml(url)}">Media</a></p>`);
    }
  }

  const q = status.quote;
  if (q && !(options.omitSensitive && q.possibly_sensitive)) {
    const qtext = escapeXml(truncateWithEllipsis(q.text.replace(/\s+/g, ' ').trim(), 280));
    parts.push(`<blockquote><a href="${escapeXml(q.url)}">${qtext}</a></blockquote>`);
  }

  return parts.join('\n');
}

export function statusesToFeedItems(
  statuses: APITwitterStatus[],
  options: { omitSensitive?: boolean }
): SyndicationFeedItem[] {
  const out: SyndicationFeedItem[] = [];
  for (const s of statuses) {
    if (options.omitSensitive && s.possibly_sensitive) continue;
    const flat = s.text.replace(/\s+/g, ' ').trim();
    const title = truncateWithEllipsis(flat || s.url, 140);
    out.push({
      id: s.url,
      url: s.url,
      title,
      updated: new Date(s.created_timestamp * 1000),
      htmlContent: buildItemHtml(s, options)
    });
  }
  return out;
}

function feedUpdated(items: SyndicationFeedItem[]): Date {
  if (items.length === 0) return new Date();
  return new Date(Math.max(...items.map(i => i.updated.getTime())));
}

export function toRss20Xml(meta: SyndicationFeedMeta, items: SyndicationFeedItem[]): string {
  const lastBuild = feedUpdated(items);
  const channelBits = [
    `<title>${escapeXml(meta.channelTitle)}</title>`,
    `<link>${escapeXml(meta.profileWebUrl)}</link>`,
    `<description>${escapeXml(meta.channelDescription)}</description>`,
    `<language>en</language>`,
    `<lastBuildDate>${toRfc822(lastBuild)}</lastBuildDate>`,
    `<atom:link href="${escapeXml(meta.selfUrlRss)}" rel="self" type="application/rss+xml" />`
  ];

  const itemBits = items.map(
    item =>
      `<item>` +
      `<title>${escapeXml(item.title)}</title>` +
      `<link>${escapeXml(item.url)}</link>` +
      `<guid isPermaLink="true">${escapeXml(item.url)}</guid>` +
      `<pubDate>${toRfc822(item.updated)}</pubDate>` +
      `<description>${cdataWrap(item.htmlContent)}</description>` +
      `</item>`
  );

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">` +
    `<channel>` +
    channelBits.join('') +
    itemBits.join('') +
    `</channel></rss>`
  );
}

export function toAtomFeedXml(meta: SyndicationFeedMeta, items: SyndicationFeedItem[]): string {
  const updated = feedUpdated(items);
  const feedId = meta.selfUrlAtom;

  const authorBlock =
    meta.authorName !== undefined && meta.authorName !== ''
      ? `<author><name>${escapeXml(meta.authorName)}</name></author>`
      : '';

  const head =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<feed xmlns="http://www.w3.org/2005/Atom">` +
    `<title>${escapeXml(meta.channelTitle)}</title>` +
    `<link href="${escapeXml(meta.profileWebUrl)}" rel="alternate" type="text/html"/>` +
    `<link href="${escapeXml(meta.selfUrlAtom)}" rel="self" type="application/atom+xml"/>` +
    `<id>${escapeXml(feedId)}</id>` +
    `<updated>${toIso8601(updated)}</updated>` +
    `<subtitle>${escapeXml(meta.channelDescription)}</subtitle>` +
    authorBlock;

  const entries = items.map(item => {
    const eid = escapeXml(item.id);
    return (
      `<entry>` +
      `<title>${escapeXml(item.title)}</title>` +
      `<link href="${escapeXml(item.url)}" rel="alternate" type="text/html"/>` +
      `<id>${eid}</id>` +
      `<updated>${toIso8601(item.updated)}</updated>` +
      `<published>${toIso8601(item.updated)}</published>` +
      `<content type="html">${cdataWrap(item.htmlContent)}</content>` +
      `</entry>`
    );
  });

  return head + entries.join('') + `</feed>`;
}
