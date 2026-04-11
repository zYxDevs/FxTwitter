/* Twitter API error payloads are loosely typed */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ErrorResponse } from './types';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

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

type RuleContext = { json: any; body: string; httpStatus: number };

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
    match: ({ json }) => json?.errors?.[0]?.message?.includes('No status found with that ID'),
    disposition: 'respond',
    errorMessage: 'Status not found',
    status: 404,
    log: 'Status not found'
  },
  {
    match: ({ json }) => json?.errors?.[0]?.code === 366,
    disposition: 'respond',
    errorMessage: 'Status not found',
    status: 404,
    log: 'Status not found'
  },
  {
    match: ({ json }) => json?.errors?.[0]?.code === 144,
    disposition: 'respond',
    errorMessage: 'Status not found',
    status: 404,
    log: 'Status not found'
  },
  {
    match: ({ json }) => json?.errors?.[0]?.code === 29,
    disposition: 'ignore',
    log: 'Downstream fetch problem (Timeout: Unspecified). Ignore this as this is usually not an issue.'
  },
  {
    match: ({ json }) => json?.errors?.[0]?.code === 88,
    disposition: 'ignore',
    log: 'Downstream fetch problem (Rate limit exceeded). Ignore this as this is usually not an issue.'
  },
  {
    match: ({ json }) => json?.errors?.[0]?.name === 'DependencyError',
    disposition: 'ignore',
    log: 'Downstream fetch problem (DependencyError). Ignore this as this is usually not an issue.'
  },
  {
    match: ({ json }) => json?.errors?.[0]?.kind === 'NonFatal',
    disposition: 'ignore',
    log: 'Non-Fatal Error reported by server, continuing...'
  },
  {
    match: ({ json }) => json?.errors?.[0]?.message === 'ServiceUnavailable: Unspecified',
    disposition: 'respond',
    errorMessage: 'Downstream fetch problem (ServiceUnavailable), use fallback methods',
    status: 502,
    log: 'Downstream fetch problem (ServiceUnavailable), use fallback methods'
  },
  {
    match: ({ json }) => json?.errors?.[0]?.name === 'DownstreamOverCapacityError',
    disposition: 'respond',
    errorMessage: 'Downstream fetch problem (DownstreamOverCapacityError), use fallback methods',
    status: 502,
    log: 'Downstream fetch problem (DownstreamOverCapacityError), use fallback methods'
  },
  {
    match: ({ json }) => json?.errors?.[0]?.message === 'Internal: Unspecified',
    disposition: 'ignore',
    log: 'Downstream fetch problem (Internal: Unspecified). Ignore this as this is usually not an issue.'
  },
  {
    match: ({ json }) =>
      json?.errors?.[0]?.message?.includes('Denied by access control: Missing LdapGroup'),
    disposition: 'ignore',
    log: 'Downstream fetch problem (Authorization: Denied by access control: Missing LdapGroup). Ignore this as this is usually not an issue.'
  },
  {
    match: ({ json }) => json?.errors?.[0]?.message?.includes('Query: Unspecified'),
    disposition: 'ignore',
    log: 'Downstream fetch problem (Query: Unspecified). Ignore this as this is usually not an issue.'
  },
  {
    match: ({ json }) => json?.errors?.[0]?.message?.includes('value out of range'),
    disposition: 'respond',
    errorMessage: 'Status not found',
    status: 404,
    log: 'Invalid status ID, ingoring error (strconv.ParseInt: value out of range.)'
  }
];

export function applyNsfwViewerErrorPatch(json: any): void {
  json.errors = [
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
  json: any,
  decodedBody: string,
  httpStatus: number
): ClassifyOutcome {
  const ctx: RuleContext = { json, body: decodedBody, httpStatus };
  const hasNsfw = decodedBody.includes('"reason":"NsfwViewerIsUnderage"');
  if (!(json?.errors || hasNsfw)) {
    return { action: 'ignore' };
  }

  if (hasNsfw) {
    applyNsfwViewerErrorPatch(json);
    console.log(NSFW_UNDERAGE_LOG);
    return { action: 'retry' };
  }

  console.log(json.errors);

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
