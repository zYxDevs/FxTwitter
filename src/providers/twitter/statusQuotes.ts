import { Context } from 'hono';
import { searchAPI } from './search';
import type { APISearchResults } from '../../realms/api/schemas';

export const statusQuotesAPI = async (
  statusId: string,
  count: number,
  cursor: string | null,
  c: Context,
  language?: string
): Promise<APISearchResults> => {
  return searchAPI(`quoted_tweet_id:${statusId}`, 'latest', count, cursor, c, language);
};
