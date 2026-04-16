import { Context } from 'hono';
import type {
  APIBlueskyStatus,
  SocialConversationBluesky,
  SocialThreadBluesky
} from '../../realms/api/schemas';
import { fetchPostThread } from './client';
import { buildAPIBlueskyPost } from './processor';
import { atUriForFeedPost } from './uris';

const THREAD_FETCH_DEPTH = 10;
const THREAD_PARENT_HEIGHT_FIRST_PAGE = 80;
const CONVERSATION_PAGE_DEPTH = 1;
const CONVERSATION_PAGE_PARENT_HEIGHT = 0;

const CURSOR_V = 1 as const;
type ConversationCursorPayload = {
  v: typeof CURSOR_V;
  uri: string;
  mode: 'likes' | 'recency';
  skip: number;
  count: number;
};

export type BlueskyConversationResult =
  | { ok: true; data: SocialConversationBluesky }
  | { ok: false; message: string };

export const fetchBlueskyThread = async (
  post: string,
  author: string,
  processThread = false,
  credentialKey?: string
): Promise<BlueskyThreadResponse | null> => {
  if (!author || !post) {
    return null;
  }
  const uri = atUriForFeedPost(author, post);
  const depth = processThread ? THREAD_FETCH_DEPTH : 1;
  return fetchPostThread(uri, depth, undefined, { credentialKey });
};

const followReplyChain = (thread: BlueskyThread): BlueskyPost[] => {
  if (!thread.replies?.length) return [];
  const parentCid = thread.post.cid;

  for (const child of thread.replies) {
    const post = child.post;
    if (!post?.author || post.author.did !== thread.post.author?.did) {
      continue;
    }
    const replyParentCid = post.record?.reply?.parent?.cid;
    if (replyParentCid === parentCid) {
      const bucket = [post];
      const deeper = child.replies?.length ? followReplyChain(child) : [];
      return bucket.concat(deeper);
    }
  }
  return [];
};

/** Walk parents + focal + same-author reply continuation (matches `/2/thread` semantics). */
const collectProcessedThreadPosts = async (
  thread: BlueskyThread,
  author: string,
  credentialKey?: string
): Promise<BlueskyPost[]> => {
  const bucket: BlueskyPost[] = [];

  if (thread.parent) {
    let parent: BlueskyThread | undefined = thread.parent;
    while (parent?.post) {
      bucket.unshift(parent.post);
      parent = parent.parent;
    }
  }
  bucket.push(thread.post);

  if (thread.replies?.length) {
    let threadPiece: BlueskyThread = thread;
    let chain = followReplyChain(threadPiece);
    const accumulated: BlueskyPost[] = [...chain];

    while (chain.length > 0) {
      const last = chain[chain.length - 1];
      const nextId = last.uri?.match(/(?<=post\/)([^/]+)/)?.[1] ?? '';
      if (!nextId) break;

      const more = await fetchBlueskyThread(nextId, author, true, credentialKey);
      if (!more?.thread) break;

      threadPiece = more.thread;
      const moreReplies = followReplyChain(threadPiece);
      if (!moreReplies.length) break;

      accumulated.push(...moreReplies);
      chain = moreReplies;
    }

    bucket.push(...accumulated);
  }

  return bucket;
};

/** First direct child that continues the author's self-thread under `focal`. */
const findSelfBranchFirstReplyChild = (focal: BlueskyThread): BlueskyThread | undefined => {
  const parentCid = focal.post.cid;
  const focalAuthorDid = focal.post.author?.did;
  if (!parentCid || !focalAuthorDid) return undefined;
  for (const child of focal.replies ?? []) {
    const post = child.post;
    if (!post?.author || post.author.did !== focalAuthorDid) continue;
    if (post.record?.reply?.parent?.cid === parentCid) return child;
  }
  return undefined;
};

/** Top-level replies to the focal post, excluding the self-thread continuation branch. */
const collectDirectReplyPosts = (focal: BlueskyThread): BlueskyPost[] => {
  const selfChild = findSelfBranchFirstReplyChild(focal);
  const selfUri = selfChild?.post?.uri;
  const out: BlueskyPost[] = [];
  for (const child of focal.replies ?? []) {
    if (!child?.post?.uri) continue;
    if (selfUri && child.post.uri === selfUri) continue;
    out.push(child.post);
  }
  return out;
};

const sortDirectReplies = (posts: BlueskyPost[], mode: 'likes' | 'recency'): BlueskyPost[] => {
  const sorted = [...posts];
  if (mode === 'recency') {
    sorted.sort((a, b) => {
      const tb = (b.indexedAt ?? '').localeCompare(a.indexedAt ?? '');
      if (tb !== 0) return tb;
      return (b.uri ?? '').localeCompare(a.uri ?? '');
    });
  } else {
    sorted.sort((a, b) => {
      const lb = (b.likeCount ?? 0) - (a.likeCount ?? 0);
      if (lb !== 0) return lb;
      const tb = (b.indexedAt ?? '').localeCompare(a.indexedAt ?? '');
      if (tb !== 0) return tb;
      return (b.uri ?? '').localeCompare(a.uri ?? '');
    });
  }
  return sorted;
};

const encodeConversationCursor = (payload: ConversationCursorPayload): string => {
  const json = JSON.stringify(payload);
  const b64 = btoa(json);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const decodeConversationCursor = (raw: string): ConversationCursorPayload | null => {
  try {
    let b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = atob(b64);
    const o = JSON.parse(json) as Partial<ConversationCursorPayload>;
    if (o.v !== CURSOR_V || typeof o.uri !== 'string') return null;
    if (o.mode !== 'likes' && o.mode !== 'recency') return null;
    if (typeof o.skip !== 'number' || !Number.isFinite(o.skip) || o.skip < 0) return null;
    if (typeof o.count !== 'number' || !Number.isFinite(o.count) || o.count < 1 || o.count > 100) {
      return null;
    }
    return {
      v: CURSOR_V,
      uri: o.uri,
      mode: o.mode,
      skip: o.skip,
      count: o.count
    };
  } catch {
    return null;
  }
};

export const constructBlueskyThread = async (
  id: string,
  author: string,
  processThread = false,
  c: Context,
  language: string | undefined
): Promise<SocialThreadBluesky> => {
  const credentialKey = c.env?.CREDENTIAL_KEY;
  const _thread = await fetchBlueskyThread(id, author, processThread, credentialKey);

  if (!_thread?.thread?.post) {
    return {
      status: null,
      thread: [],
      author: null,
      code: 404
    };
  }

  const thread = _thread.thread;
  const bucket: BlueskyPost[] = processThread
    ? await collectProcessedThreadPosts(thread, author, credentialKey)
    : [thread.post];

  const consumedPost = (await buildAPIBlueskyPost(c, thread.post, language)) as APIBlueskyStatus;
  const consumedPosts = (await Promise.all(
    bucket.map(post => buildAPIBlueskyPost(c, post, language))
  )) as APIBlueskyStatus[];

  return {
    status: consumedPost,
    thread: consumedPosts,
    author: consumedPost.author,
    code: 200
  };
};

export const constructBlueskyConversation = async (
  author: string,
  rkey: string,
  c: Context,
  options: {
    rankingMode: 'likes' | 'recency';
    cursor: string | null;
    count: number;
    language?: string;
  }
): Promise<BlueskyConversationResult> => {
  const credentialKey = c.env?.CREDENTIAL_KEY;
  const count = Math.min(100, Math.max(1, Math.floor(options.count)));
  let focalUri: string;
  let mode: 'likes' | 'recency';
  let skip: number;
  let pageCount: number;
  let isContinuation: boolean;

  if (options.cursor) {
    const decoded = decodeConversationCursor(options.cursor);
    if (!decoded) {
      return { ok: false, message: 'Invalid cursor' };
    }
    focalUri = decoded.uri;
    mode = decoded.mode;
    skip = decoded.skip;
    pageCount = decoded.count;
    isContinuation = true;
  } else {
    if (!author || !rkey) {
      return {
        ok: true,
        data: {
          code: 404,
          status: null,
          thread: null,
          replies: null,
          author: null,
          cursor: null
        }
      };
    }
    focalUri = atUriForFeedPost(author, rkey);
    mode = options.rankingMode;
    skip = 0;
    pageCount = count;
    isContinuation = false;
  }

  const raw = isContinuation
    ? await fetchPostThread(focalUri, CONVERSATION_PAGE_DEPTH, CONVERSATION_PAGE_PARENT_HEIGHT, {
        credentialKey
      })
    : await fetchPostThread(focalUri, THREAD_FETCH_DEPTH, THREAD_PARENT_HEIGHT_FIRST_PAGE, {
        credentialKey
      });

  if (!raw?.thread?.post) {
    return {
      ok: true,
      data: {
        code: 404,
        status: null,
        thread: null,
        replies: null,
        author: null,
        cursor: null
      }
    };
  }

  const focalNode = raw.thread;
  const lang = options.language;

  const threadPosts: BlueskyPost[] = isContinuation
    ? [focalNode.post]
    : await collectProcessedThreadPosts(focalNode, author, credentialKey);

  const directBluesky = collectDirectReplyPosts(focalNode);
  const sorted = sortDirectReplies(directBluesky, mode);
  const pageSlice = sorted.slice(skip, skip + pageCount);

  const statusPost = focalNode.post;
  const consumedStatus = (await buildAPIBlueskyPost(c, statusPost, lang)) as APIBlueskyStatus;
  const threadApi = (await Promise.all(
    threadPosts.map(p => buildAPIBlueskyPost(c, p, lang))
  )) as APIBlueskyStatus[];
  const repliesApi = (await Promise.all(
    pageSlice.map(p => buildAPIBlueskyPost(c, p, lang))
  )) as APIBlueskyStatus[];

  const canonicalUri = statusPost.uri ?? focalUri;
  const nextSkip = skip + pageSlice.length;
  const hasMore = nextSkip < sorted.length;
  const bottomCursor = hasMore
    ? encodeConversationCursor({
        v: CURSOR_V,
        uri: canonicalUri,
        mode,
        skip: nextSkip,
        count: pageCount
      })
    : null;

  return {
    ok: true,
    data: {
      code: 200,
      status: consumedStatus,
      thread: threadApi,
      replies: repliesApi,
      author: consumedStatus.author,
      cursor: { bottom: bottomCursor }
    }
  };
};
