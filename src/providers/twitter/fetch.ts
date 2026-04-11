import { Context } from 'hono';
import { Constants } from '../../constants';
import { generateUserAgent } from '../../helpers/useragent';
import { generateSnowflake, withTimeout } from '../../helpers/utils';
import { detokenize } from '../../helpers/detokenize';
import { hasTwitterAccountProxy } from './accountProxy';
import { initCredentials } from './proxy/credentials';
import { proxyTwitterRequest } from './proxy/handler';

const API_ATTEMPTS = 3;

interface TwitterFetchOptions {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  useElongator?: boolean;
  validateFunction?: (response: unknown) => boolean;
  elongatorRequired?: boolean;
}

export const twitterFetch = async (c: Context, options: TwitterFetchOptions): Promise<unknown> => {
  const { url, method, headers: _headers, body, validateFunction, elongatorRequired } = options;
  let useElongator = options.useElongator ?? hasTwitterAccountProxy(c.env);
  let apiAttempts = 0;
  let newTokenGenerated = false;
  let wasAccountProxyDisabled = false;

  const [userAgent, secChUa] = generateUserAgent();
  // console.log(`Outgoing useragent for this request:`, userAgent);

  const tokenHeaders: { [header: string]: string } = {
    'Authorization': Constants.GUEST_BEARER_TOKEN,
    'User-Agent': userAgent,
    'sec-ch-ua': secChUa,
    ...Constants.BASE_HEADERS
  };

  const guestTokenRequest = new Request(`${Constants.TWITTER_API_ROOT}/1.1/guest/activate.json`, {
    method: 'POST',
    headers: tokenHeaders,
    cf: {
      cacheEverything: true,
      cacheTtl: Constants.GUEST_TOKEN_MAX_AGE
    },
    body: ''
  });

  /* A dummy version of the request only used for Cloudflare caching purposes.
     The reason it exists at all is because Cloudflare won't cache POST requests. */
  const guestTokenRequestCacheDummy = new Request(
    `${Constants.TWITTER_API_ROOT}/1.1/guest/activate.json`,
    {
      method: 'GET',
      cf: {
        cacheEverything: true,
        cacheTtl: Constants.GUEST_TOKEN_MAX_AGE
      }
    }
  );

  const cache = typeof caches !== 'undefined' ? caches.default : null;

  while (apiAttempts < API_ATTEMPTS) {
    /* Generate a random CSRF token, Twitter just cares that header and cookie match,
    REST can use shorter csrf tokens (32 bytes) but graphql uses a 160 byte one. */
    const csrfToken = crypto.randomUUID().replace(/-/g, '');

    const headers: Record<string, string> = {
      Authorization: Constants.GUEST_BEARER_TOKEN,
      ...Constants.BASE_HEADERS,
      ...(_headers ?? {})
    };

    apiAttempts++;

    let activate: Response | null = null;

    if (cache === null) {
      console.log('Caching unavailable, requesting new token');
      newTokenGenerated = true;
    }

    if (!newTokenGenerated && !useElongator && cache) {
      const timeBefore = performance.now();
      const cachedResponse = await cache.match(guestTokenRequestCacheDummy.clone());
      const timeAfter = performance.now();

      console.log(`Searched cache for token, took ${timeAfter - timeBefore}ms`);

      if (cachedResponse) {
        console.log('Token cache hit');
        activate = cachedResponse;
      } else {
        console.log('Token cache miss');
        newTokenGenerated = true;
      }
    }

    if (newTokenGenerated || (activate === null && !useElongator)) {
      /* Let's get a guest token to call the API.
      
      Back in the day (2022), this was pretty much unlimited and gave us nearly unlimited read-only access to Twitter.
      
      Since the Elon buyout, this has become more stringent with rate limits, NSFW tweets not loading with this method,
      among other seemingly arbitrary restrictions and quirks. */
      const timeBefore = performance.now();
      activate = await fetch(guestTokenRequest.clone());
      const timeAfter = performance.now();

      console.log(`Guest token request after ${timeAfter - timeBefore}ms`);
    }

    /* Let's grab that guest_token so we can use it */
    let activateJson: { guest_token: string };

    try {
      activateJson = (await activate?.clone().json()) as { guest_token: string };
    } catch (_e) {
      continue;
    }

    /* Elongator doesn't need guestToken, so we just make up a snowflake */
    const guestToken = activateJson?.guest_token || generateSnowflake();

    if (activateJson) {
      console.log(newTokenGenerated ? 'Activated guest:' : 'Using guest:', activateJson);
    }

    /* Just some cookies to mimick what the Twitter Web App would send */
    headers['Cookie'] = [
      `guest_id_ads=v1%3A${guestToken}`,
      `guest_id_marketing=v1%3A${guestToken}`,
      `guest_id=v1%3A${guestToken}`,
      `ct0=${csrfToken};`
    ].join('; ');

    headers['x-csrf-token'] = csrfToken;
    headers['x-twitter-active-user'] = 'yes';
    headers['x-guest-token'] = guestToken;
    let response: unknown;
    let apiRequest: Response | null;

    try {
      if (useElongator && typeof c.env?.TwitterProxy !== 'undefined') {
        const performanceStart = performance.now();
        const headers2 = headers;
        headers2['x-twitter-auth-type'] = 'OAuth2Session';
        apiRequest = await withTimeout((signal: AbortSignal) =>
          c.env?.TwitterProxy!.fetch(url, {
            method: method,
            headers: headers2,
            signal: signal,
            body: body
          })
        );
        const performanceEnd = performance.now();
        console.log(
          `Account proxy (test binding) finished after ${performanceEnd - performanceStart}ms`
        );
      } else if (useElongator && c.env?.CREDENTIAL_KEY) {
        const performanceStart = performance.now();
        const headers2 = { ...headers };
        headers2['x-twitter-auth-type'] = 'OAuth2Session';
        await initCredentials(c.env.CREDENTIAL_KEY);
        apiRequest = await withTimeout((signal: AbortSignal) =>
          proxyTwitterRequest(
            new Request(url, {
              method: method ?? 'GET',
              headers: headers2,
              signal,
              body
            }),
            {
              CREDENTIAL_KEY: c.env.CREDENTIAL_KEY,
              EXCEPTION_DISCORD_WEBHOOK: c.env.EXCEPTION_DISCORD_WEBHOOK
            }
          )
        );
        const performanceEnd = performance.now();
        console.log(
          `Account proxy (in-process) finished after ${performanceEnd - performanceStart}ms`
        );
      } else {
        const performanceStart = performance.now();
        apiRequest = await withTimeout((signal: AbortSignal) =>
          fetch(url, {
            method: method,
            headers: headers,
            signal: signal,
            body: body
          })
        );
        const performanceEnd = performance.now();
        console.log(`Guest API request successful after ${performanceEnd - performanceStart}ms`);
      }

      const _response = (await apiRequest?.text()) ?? '';
      try {
        response = JSON.parse(_response);
      } catch (_e) {
        if (_response.split('\n').length > 1) {
          response = detokenize(_response);
        } else {
          throw new Error(`Failed to parse response as JSON ${_e}`, { cause: _e });
        }
      }
    } catch (e: unknown) {
      /* We'll usually only hit this if we get an invalid response from Twitter.
         It's uncommon, but it happens */
      console.error('Unknown error while fetching from API', e);
      /* Account proxy may surface downstream errors as thrown strings */
      if (String(e).indexOf('Status not found') !== -1) {
        console.log('Tweet was not found');
        return null;
      }
      try {
        if (!useElongator && cache && c.executionCtx) {
          c.executionCtx.waitUntil(
            cache.delete(guestTokenRequestCacheDummy.clone(), { ignoreMethod: true })
          );
        }
      } catch (error) {
        console.error((error as Error).stack);
      }
      if (useElongator) {
        if (elongatorRequired) {
          console.log('Account proxy was required, but we failed to fetch a valid response');
          return {};
        }
        console.log('Account proxy request failed, trying again without it');
        wasAccountProxyDisabled = true;
      }
      newTokenGenerated = true;
      useElongator = false;
      continue;
    }

    if (
      !wasAccountProxyDisabled &&
      !useElongator &&
      hasTwitterAccountProxy(c.env) &&
      (response as TweetResultByRestIdResponse)?.data?.tweetResult?.result?.reason ===
        'NsfwLoggedOut'
    ) {
      console.log(`nsfw tweet detected, retrying with account proxy`);
      useElongator = true;
      continue;
    }

    const remainingRateLimit = parseInt(apiRequest?.headers.get('x-rate-limit-remaining') || '0');
    console.log(`Remaining rate limit: ${remainingRateLimit} requests`);
    /* Running out of requests within our rate limit, let's purge the cache */
    if (!useElongator && remainingRateLimit < 10) {
      console.log(`Purging token on this edge due to low rate limit remaining`);
      try {
        if (c.executionCtx && cache) {
          c.executionCtx.waitUntil(
            cache.delete(guestTokenRequestCacheDummy.clone(), { ignoreMethod: true })
          );
        }
      } catch (error) {
        console.error((error as Error).stack);
      }
    }

    if (validateFunction && !validateFunction(response)) {
      console.log('Failed to fetch response, got', JSON.stringify(response));
      if (elongatorRequired) {
        console.log('Account proxy was required, but we failed to fetch a valid response');
        return {};
      }
      if (useElongator) {
        console.log('Account proxy request failed to validate, trying again without it');
        wasAccountProxyDisabled = true;
      }
      useElongator = false;
      newTokenGenerated = true;
      continue;
    }
    try {
      /* If we've generated a new token, we'll cache it */
      if (c.executionCtx && newTokenGenerated && activate && cache) {
        const cachingResponse = new Response(await activate.clone().text(), {
          headers: {
            ...tokenHeaders,
            'cache-control': `max-age=${Constants.GUEST_TOKEN_MAX_AGE}`
          }
        });
        console.log('Caching guest token');
        c.executionCtx.waitUntil(cache.put(guestTokenRequestCacheDummy.clone(), cachingResponse));
      }
    } catch (error) {
      console.error((error as Error).stack);
    }
    console.log('twitterFetch is all done here, see you soon!');
    console.log('response', JSON.stringify(response));
    return response;
  }

  console.log('Twitter has repeatedly denied our requests, so we give up now');

  return null;
};
