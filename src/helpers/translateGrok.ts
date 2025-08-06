import { Context } from 'hono';
import { APITwitterStatus, GrokTranslation } from '../types/types';
import { normalizeLanguage } from './language';
import { Constants } from '../constants';
import { twitterFetch } from '../providers/twitter/fetch';

/* Handles translating statuses when asked! */
export const translateStatusGrok = async (
  status: APITwitterStatus,
  _language: string,
  c: Context
): Promise<GrokTranslation | null> => {
  const language = normalizeLanguage(_language);
  const response = await twitterFetch(c, {
    url: `${Constants.TWITTER_API_ROOT}/2/grok/translation.json`,
    method: 'POST',
    body: JSON.stringify({
      content_type: 'POST',
      id: status.id,
      dst_lang: language,
      include_polls: true
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  });
  console.log('Grok translation response:', response);
  return response as GrokTranslation | null;
};
