export type TwitterCredentials = {
  authToken: string;
  csrfToken: string;
  username: string;
};

/** Per-provider credential buckets; extend with instagram, etc. */
export type CredentialStore = {
  twitter: { accounts: TwitterCredentials[] };
} & Record<string, { accounts: unknown[] }>;

export type ErrorResponse = {
  error: string;
  code: number;
};

export type ProxyEnv = {
  CREDENTIAL_KEY?: string;
  EXCEPTION_DISCORD_WEBHOOK?: string;
};
