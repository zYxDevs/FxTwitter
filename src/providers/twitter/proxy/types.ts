export type TwitterCredentials = {
  authToken: string;
  csrfToken: string;
  username: string;
};

/** Bluesky proxy: app password auth against the account PDS (entryway or *.host.bsky.network). */
export type BlueskyProxyCredentials = {
  identifier: string;
  appPassword: string;
  service: string;
};

/** Per-provider credential buckets; extend with instagram, etc. */
export type CredentialStore = {
  twitter?: { accounts: TwitterCredentials[] };
  bluesky?: { accounts: BlueskyProxyCredentials[] };
};

export type ErrorResponse = {
  error: string;
  code: number;
};

export type ProxyEnv = {
  CREDENTIAL_KEY?: string;
  EXCEPTION_DISCORD_WEBHOOK?: string;
};
