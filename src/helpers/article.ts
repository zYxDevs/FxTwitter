import {
  TwitterArticleContentState,
  TwitterArticleContentBlock,
  TwitterArticleEntityMapEntry,
  TwitterApiMedia,
  TwitterApiImage,
  TwitterApiVideo
} from '../types/vendor/twitter';
import { sanitizeText, truncateWithEllipsis } from './utils';

const DISCORD_ARTICLE_MAX_LENGTH = 10000;

interface ArticleRenderOptions {
  maxLength?: number; // undefined = no limit (Telegram)
  renderInlineMedia?: boolean; // true for Telegram, false for Discord
  mediaEntities: TwitterApiMedia[];
}

interface ArticleRenderResult {
  html: string;
  collectedMedia: TwitterApiMedia[]; // For Discord media_attachments
  wasTruncated: boolean;
}

interface StyleRange {
  offset: number;
  length: number;
  style: string;
}

interface EntityRange {
  offset: number;
  length: number;
  key: number;
}

/**
 * Applies inline styles to text, handling overlapping styles
 */
const applyInlineStyles = (text: string, styleRanges: StyleRange[]): string => {
  if (styleRanges.length === 0) {
    return sanitizeText(text);
  }

  // Build a map of style tags
  const styleTagMap: Record<string, { open: string; close: string }> = {
    Bold: { open: '<b>', close: '</b>' },
    Italic: { open: '<i>', close: '</i>' },
    Strikethrough: { open: '<s>', close: '</s>' }
  };

  // Build segments by tracking style changes at each character position
  const segments: Array<{ text: string; styles: Set<string> }> = [];
  const currentStyles = new Set<string>();
  let segmentStart = 0;

  // Create events for style start and end
  const events: Array<{ position: number; style: string; isStart: boolean }> = [];
  for (const range of styleRanges) {
    events.push({ position: range.offset, style: range.style, isStart: true });
    events.push({ position: range.offset + range.length, style: range.style, isStart: false });
  }

  // Sort events by position
  events.sort((a, b) => a.position - b.position);

  for (const event of events) {
    // If we've moved to a new position, save the previous segment
    if (event.position > segmentStart) {
      const segmentText = text.substring(segmentStart, event.position);
      if (segmentText.length > 0) {
        segments.push({
          text: segmentText,
          styles: new Set(currentStyles)
        });
      }
      segmentStart = event.position;
    }

    // Update current styles
    if (event.isStart) {
      currentStyles.add(event.style);
    } else {
      currentStyles.delete(event.style);
    }
  }

  // Add remaining text
  if (segmentStart < text.length) {
    segments.push({
      text: text.substring(segmentStart),
      styles: new Set(currentStyles)
    });
  }

  // Build HTML with nested tags
  let result = '';
  for (const segment of segments) {
    // Check if this segment contains HTML tags (from inline media)
    const containsHtml = /<[^>]+>/.test(segment.text);

    // Only sanitize if it doesn't contain HTML tags
    const processedText = containsHtml ? segment.text : sanitizeText(segment.text);
    if (segment.styles.size === 0) {
      result += processedText;
    } else {
      // Apply styles in a consistent order for proper nesting
      const styleOrder = ['Bold', 'Italic', 'Strikethrough'];
      const stylesToApply = styleOrder.filter(s => segment.styles.has(s));

      // If the text contains HTML, we can't apply styles to it (HTML tags break style ranges)
      // So we just output it as-is
      if (containsHtml) {
        result += processedText;
      } else {
        let wrapped = processedText;
        for (const style of stylesToApply) {
          const tags = styleTagMap[style];
          if (tags) {
            wrapped = tags.open + wrapped + tags.close;
          }
        }
        result += wrapped;
      }
    }
  }

  return result;
};

/**
 * Renders a single block to HTML
 */
const renderBlock = (
  block: TwitterArticleContentBlock,
  entityMap: TwitterArticleEntityMapEntry[],
  mediaEntities: TwitterApiMedia[],
  options: ArticleRenderOptions
): { html: string; collectedMedia: TwitterApiMedia[] } => {
  const collectedMedia: TwitterApiMedia[] = [];
  let blockText = block.text;

  // Handle entity ranges (media, markdown, etc.)
  const entityRanges: EntityRange[] = block.entityRanges.map(er => ({
    offset: er.offset,
    length: er.length,
    key: er.key
  }));

  // Sort entity ranges by offset (reverse order for replacement)
  entityRanges.sort((a, b) => b.offset - a.offset);

  // Track media HTML insertions for atomic blocks
  let hasMediaHtml = false;

  for (const entityRange of entityRanges) {
    const entityKey = String(entityRange.key);
    const entityEntry = entityMap.find(e => e.key === entityKey);

    if (entityEntry?.value.type === 'MEDIA') {
      const mediaItem = entityEntry.value.data.mediaItems[0];
      if (mediaItem) {
        const media = mediaEntities.find(m => m.media_id === mediaItem.mediaId);
        if (media) {
          if (options.renderInlineMedia) {
            // Render inline media for Telegram
            let mediaHtml = '';
            if (media.media_info.__typename === 'ApiImage') {
              const image = media.media_info as TwitterApiImage;
              mediaHtml = `<img src="${image.original_img_url}" alt="" />`;
            } else {
              const video = media.media_info as TwitterApiVideo;
              // Use the first variant URL
              const videoUrl = video.video_info?.variants?.[0]?.url || video.media_url_https;
              mediaHtml = `<video src="${videoUrl}" controls></video>`;
            }
            hasMediaHtml = true;
            // Replace the placeholder text with the media
            blockText =
              blockText.substring(0, entityRange.offset) +
              mediaHtml +
              blockText.substring(entityRange.offset + entityRange.length);
          } else {
            // Collect media for Discord
            collectedMedia.push(media);
            // Remove the placeholder text
            blockText =
              blockText.substring(0, entityRange.offset) +
              blockText.substring(entityRange.offset + entityRange.length);
          }
        }
      }
    } else if (entityEntry?.value.type === 'MARKDOWN') {
      // Handle MARKDOWN entities (typically code blocks)
      const markdown = (entityEntry.value.data as { markdown?: string }).markdown || '';
      let markdownHtml = '';

      if (markdown.startsWith('```')) {
        // It's a code block - extract language identifier and content
        const lines = markdown.split('\n');
        // First line is ```language - extract the language
        const firstLine = lines[0];
        const language = firstLine.slice(3).trim(); // Remove ``` and trim
        // Remove first line (```language) and last line (```)
        const codeContent = lines.slice(1, -1).join('\n');
        // Sanitize and wrap in code tag with optional data-language for syntax highlighting
        const langAttr = language ? ` data-language="${sanitizeText(language)}"` : '';
        if (options.renderInlineMedia) {
          markdownHtml = `<pre${langAttr}>${sanitizeText(codeContent)}</pre>`;
        } else {
          markdownHtml = `<code${langAttr}>${sanitizeText(codeContent)}</code>`;
        }
      } else {
        // Unknown markdown format - render in blockquote as fallback
        markdownHtml = `<blockquote>${sanitizeText(markdown)}</blockquote>`;
      }

      hasMediaHtml = true; // Treat like media to skip style processing
      // Replace the placeholder text with the markdown HTML
      blockText =
        blockText.substring(0, entityRange.offset) +
        markdownHtml +
        blockText.substring(entityRange.offset + entityRange.length);
    }
  }

  // For atomic blocks with media HTML, return early without style processing
  if (block.type === 'atomic' && hasMediaHtml) {
    return { html: blockText, collectedMedia };
  }

  // Apply inline styles
  const styledText = applyInlineStyles(blockText, block.inlineStyleRanges);

  // Determine block tag based on type
  // For Discord (renderInlineMedia = false), render headers as bold text instead of header tags
  let blockTag = 'p';
  let isHeader = false;
  switch (block.type) {
    case 'header-one':
      if (options.renderInlineMedia) {
        // Telegram: use actual header tags
        blockTag = 'h1';
      } else {
        // Discord: render as bold text
        blockTag = 'p';
        isHeader = true;
      }
      break;
    case 'header-two':
      if (options.renderInlineMedia) {
        // Telegram: use actual header tags
        blockTag = 'h2';
      } else {
        // Discord: render as bold text
        blockTag = 'p';
        isHeader = true;
      }
      break;
    case 'blockquote':
      blockTag = 'blockquote';
      break;
    case 'ordered-list-item':
    case 'unordered-list-item':
      blockTag = 'li';
      break;
    case 'atomic':
      // Atomic blocks are typically media placeholders
      // If we're not rendering inline media, skip it
      if (!options.renderInlineMedia && blockText.trim() === '') {
        return { html: '', collectedMedia };
      }
      // This case should have been handled earlier, but just in case
      blockTag = 'p';
      break;
    case 'unstyled':
    default:
      blockTag = 'p';
      break;
  }

  // Wrap header text in bold tags for Discord
  const finalText = isHeader ? `<b>${styledText}</b>` : styledText;
  const html = `<${blockTag}>${finalText}</${blockTag}>`;

  return { html, collectedMedia };
};

/**
 * Renders Twitter Article content to HTML
 */
export const renderArticleToHtml = (
  content: TwitterArticleContentState,
  options: ArticleRenderOptions
): ArticleRenderResult => {
  const collectedMedia: TwitterApiMedia[] = [];
  const htmlParts: string[] = [];
  let currentLength = 0;
  let wasTruncated = false;

  // Group consecutive list items
  let inList = false;
  let listType: 'ol' | 'ul' | null = null;
  const listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const listHtml = `<${listType}>${listItems.join('')}</${listType}>`;
      if (options.maxLength && currentLength + listHtml.length > options.maxLength) {
        wasTruncated = true;
        return;
      }
      htmlParts.push(listHtml);
      currentLength += listHtml.length;
      listItems.length = 0;
      inList = false;
      listType = null;
    }
  };

  for (const block of content.blocks) {
    if (wasTruncated) {
      break;
    }

    const { html, collectedMedia: blockMedia } = renderBlock(
      block,
      content.entityMap,
      options.mediaEntities,
      options
    );

    collectedMedia.push(...blockMedia);

    // Handle list items
    if (block.type === 'ordered-list-item' || block.type === 'unordered-list-item') {
      const newListType = block.type === 'ordered-list-item' ? 'ol' : 'ul';
      if (!inList || listType !== newListType) {
        flushList();
        if (wasTruncated) {
          break;
        }
        listType = newListType;
        inList = true;
      }
      // Check if adding this item would exceed the limit
      const testListHtml = `<${listType}>${listItems.join('')}${html}</${listType}>`;
      if (options.maxLength && currentLength + testListHtml.length > options.maxLength) {
        // Flush what we have and truncate
        flushList();
        wasTruncated = true;
        break;
      }
      listItems.push(html);
    } else {
      flushList();
      // Check truncation for non-list blocks
      if (options.maxLength && currentLength + html.length > options.maxLength) {
        const remaining = options.maxLength - currentLength;
        if (remaining > 0) {
          // Try to truncate at word boundary if possible
          const truncated = truncateWithEllipsis(html, remaining);
          htmlParts.push(truncated);
        }
        wasTruncated = true;
        break;
      }
      htmlParts.push(html);
      currentLength += html.length;
    }
  }

  // Flush any remaining list items
  flushList();

  return {
    html: htmlParts.join('\n'),
    collectedMedia,
    wasTruncated
  };
};

export { DISCORD_ARTICLE_MAX_LENGTH };
