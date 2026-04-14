/* Twitter API error payloads are loosely typed */
import type { ErrorResponse } from './types';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function firstErrorEntry(json: unknown): Record<string, unknown> | undefined {
  const rec = asRecord(json);
  if (!rec) return undefined;
  const errors = rec['errors'];
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  return asRecord(errors[0]);
}

function firstErrorMessageIncludes(json: unknown, substr: string): boolean {
  const m = firstErrorEntry(json)?.['message'];
  return typeof m === 'string' && m.includes(substr);
}

/** GraphQL errors use `path` (e.g. tweetResult → result → birdwatch_pivot); REST errors do not. */
function firstGraphQLErrorPathEndsWith(json: unknown, segment: string): boolean {
  const path = firstErrorEntry(json)?.['path'];
  if (!Array.isArray(path) || path.length === 0) return false;
  return path[path.length - 1] === segment;
}

/** `json.errors` truthy (including empty array), matching prior `if (json.errors)` checks. */
export function jsonHasTruthyErrorsProperty(json: unknown): boolean {
  const rec = asRecord(json);
  if (!rec) return false;
  return Boolean(rec['errors']);
}

export function jsonError(message: string, status: number): Response {
  const body: ErrorResponse = { error: message, code: status };
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS
  });
}

export type ClassifyOutcome =
  | { action: 'respond'; response: Response }
  | { action: 'ignore' }
  | { action: 'retry' };

type RuleContext = { json: unknown; body: string; httpStatus: number };

type ErrorRule =
  | { match: (ctx: RuleContext) => boolean; log: string; disposition: 'ignore' }
  | {
      match: (ctx: RuleContext) => boolean;
      log: string;
      disposition: 'respond';
      errorMessage: string;
      status: number;
    };

const NSFW_UNDERAGE_LOG = 'NsfwViewerIsUnderage: Account country may be set to UK or EU';

/** Inner chain when `json.errors` or NSFW underage is present; order matches original worker. */
const ERROR_RULES: ErrorRule[] = [
  {
    match: ({ httpStatus }) => httpStatus === 404,
    disposition: 'respond',
    errorMessage: 'Status not found',
    status: 404,
    log: 'Status not found'
  },
  {
    match: ({ json }) => firstErrorMessageIncludes(json, 'No status found with that ID'),
    disposition: 'respond',
    errorMessage: 'Status not found',
    status: 404,
    log: 'Status not found'
  },
  {
    match: ({ json }) => firstErrorEntry(json)?.code === 366,
    disposition: 'respond',
    errorMessage: 'Status not found',
    status: 404,
    log: 'Status not found'
  },
  {
    match: ({ json }) => firstErrorEntry(json)?.code === 144,
    disposition: 'respond',
    errorMessage: 'Status not found',
    status: 404,
    log: 'Status not found'
  },
  {
    match: ({ json }) => firstErrorEntry(json)?.code === 29,
    disposition: 'ignore',
    log: 'Downstream fetch problem (Timeout: Unspecified). Ignore this as this is usually not an issue.'
  },
  {
    match: ({ json }) => firstErrorEntry(json)?.code === 88,
    disposition: 'ignore',
    log: 'Downstream fetch problem (Rate limit exceeded). Ignore this as this is usually not an issue.'
  },
  {
    match: ({ json }) => firstErrorEntry(json)?.name === 'DependencyError',
    disposition: 'ignore',
    log: 'Downstream fetch problem (DependencyError). Ignore this as this is usually not an issue.'
  },
  {
    match: ({ json }) => firstErrorEntry(json)?.kind === 'NonFatal',
    disposition: 'ignore',
    log: 'Non-Fatal Error reported by server, continuing...'
  },
  {
    match: ({ json }) => firstErrorEntry(json)?.message === 'ServiceUnavailable: Unspecified',
    disposition: 'respond',
    errorMessage: 'Downstream fetch problem (ServiceUnavailable), use fallback methods',
    status: 502,
    log: 'Downstream fetch problem (ServiceUnavailable), use fallback methods'
  },
  {
    match: ({ json }) => firstErrorEntry(json)?.name === 'DownstreamOverCapacityError',
    disposition: 'respond',
    errorMessage: 'Downstream fetch problem (DownstreamOverCapacityError), use fallback methods',
    status: 502,
    log: 'Downstream fetch problem (DownstreamOverCapacityError), use fallback methods'
  },
  {
    match: ({ json }) => firstErrorEntry(json)?.message === 'Internal: Unspecified',
    disposition: 'ignore',
    log: 'Downstream fetch problem (Internal: Unspecified). Ignore this as this is usually not an issue.'
  },
  {
    match: ({ json }) =>
      firstErrorMessageIncludes(json, 'Denied by access control: Missing LdapGroup'),
    disposition: 'ignore',
    log: 'Downstream fetch problem (Authorization: Denied by access control: Missing LdapGroup). Ignore this as this is usually not an issue.'
  },
  {
    match: ({ json }) => firstErrorMessageIncludes(json, 'Query: Unspecified'),
    disposition: 'ignore',
    log: 'Downstream fetch problem (Query: Unspecified). Ignore this as this is usually not an issue.'
  },
  {
    match: ({ json }) => firstErrorMessageIncludes(json, 'value out of range'),
    disposition: 'respond',
    errorMessage: 'Status not found',
    status: 404,
    log: 'Invalid status ID, ingoring error (strconv.ParseInt: value out of range.)'
  },
  {
    match: ({ json }) =>
      firstErrorEntry(json)?.['message'] === 'Internal server error' &&
      firstGraphQLErrorPathEndsWith(json, 'birdwatch_pivot'),
    disposition: 'ignore',
    log: 'GraphQL partial failure (birdwatch_pivot). X sometimes errors on Community Notes field; tweet data is still returned.'
  }
];

export function applyNsfwViewerErrorPatch(json: unknown): void {
  const rec = asRecord(json);
  if (!rec) return;
  rec['errors'] = [
    {
      message: 'Account country set to UK or EU and tried to access NSFW content',
      code: 451
    }
  ];
}

/**
 * When the response body has API errors (or NSFW underage), determine retry / ignore / immediate JSON error.
 */
export function classifyAPIErrors(
  json: unknown,
  decodedBody: string,
  httpStatus: number
): ClassifyOutcome {
  const ctx: RuleContext = { json, body: decodedBody, httpStatus };
  const hasNsfw = decodedBody.includes('"reason":"NsfwViewerIsUnderage"');
  if (!(jsonHasTruthyErrorsProperty(json) || hasNsfw)) {
    return { action: 'ignore' };
  }

  if (hasNsfw) {
    applyNsfwViewerErrorPatch(json);
    console.log(NSFW_UNDERAGE_LOG);
    return { action: 'retry' };
  }

  console.log(asRecord(json)?.['errors']);

  for (const rule of ERROR_RULES) {
    if (rule.match(ctx)) {
      console.log(rule.log);
      if (rule.disposition === 'respond') {
        return {
          action: 'respond',
          response: jsonError(rule.errorMessage, rule.status)
        };
      }
      return { action: 'ignore' };
    }
  }

  return { action: 'retry' };
}
