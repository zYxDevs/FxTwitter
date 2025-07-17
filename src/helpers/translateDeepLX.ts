import { Context } from 'hono';
import { APIBlueskyStatus, APITwitterStatus } from '../types/types';
import { Constants } from '../constants';
import { normalizeLanguage } from './language';

const getDomain = (): string | null => {
  const deepLXDomains: string[] = Constants.DEEPLX_DOMAIN_LIST;
  if (deepLXDomains.length === 0) {
    return null;
  }

  return deepLXDomains[Math.floor(Math.random() * deepLXDomains.length)];
};

/* Handles translating statuses when asked! */
export const translateStatusDeepLX = async (
  status: APITwitterStatus | APIBlueskyStatus,
  _language: string,
  c: Context
): Promise<DeepLXTranslation | null> => {
  const language = normalizeLanguage(_language);

  console.log('Using DeepLX translation');
  const domain = getDomain();
  if (!domain) {
    return null;
  }

  const response = await fetch(`https://${domain}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Constants.DEEPLX_TOKEN}`,
      'User-Agent': Constants.FRIENDLY_USER_AGENT
    },
    body: JSON.stringify({ text: status.text, source_lang: status.lang, target_lang: language })
  });

  const data: DeepLXTranslation = await response.json();

  if (data.code !== 200) {
    console.error('DeepLX translation failed', data);
    return null;
  }

  console.log('DeepLX translation successful', data.data);

  return data;
};
