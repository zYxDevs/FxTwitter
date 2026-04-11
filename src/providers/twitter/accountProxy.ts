/** Env shape for in-process X account proxy (tests may still use optional TwitterProxy Fetcher). */
export type TwitterAccountProxyEnv = {
  TwitterProxy?: Fetcher;
  CREDENTIAL_KEY?: string;
};

export function hasTwitterAccountProxy(env: TwitterAccountProxyEnv | undefined): boolean {
  return (
    typeof env?.TwitterProxy !== 'undefined' ||
    Boolean(env?.CREDENTIAL_KEY && env.CREDENTIAL_KEY.length > 0)
  );
}
