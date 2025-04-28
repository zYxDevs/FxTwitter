/* eslint-disable @typescript-eslint/no-explicit-any */

import { Context } from "hono";
import { Constants } from "../../../constants";
import { twitterFetch } from "../fetch";

export interface GraphQLQuery {
  httpMethod: string;
  queryId: string;
  queryName: string;
  requiresAccount: boolean;
  forceTwitterEndpoint?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables: Record<string, any>;
  features?: Record<string, boolean>;
  fieldToggles?: Record<string, boolean>;
}

interface GraphQLRequest {
  query: GraphQLQuery;
  validator: (response: unknown) => boolean;
  variables: Record<string, any>;
  useElongator?: boolean;
}

export const graphqlRequest = async (c: Context, request: GraphQLRequest): Promise<unknown> => {
  const { query, validator, variables } = request;
  const allVariables = { ...query.variables, ...(variables ?? []) };

  let url = `${Constants.TWITTER_ROOT}/i/api/graphql/${query.queryId}/${query.queryName}`;
  if (query.forceTwitterEndpoint) {
    url = `https://api.twitter.com/graphql/${query.queryId}/${query.queryName}`;
  }
  url += `?variables=${encodeURIComponent(JSON.stringify(allVariables))}`;
  if (query.features) {
    url += `&features=${encodeURIComponent(JSON.stringify(query.features))}`;
  }
  if (query.fieldToggles) {
    url += `&fieldToggles=${encodeURIComponent(JSON.stringify(query.fieldToggles))}`;
  }
  return twitterFetch(c, url, request.useElongator ?? query.requiresAccount, validator)
}