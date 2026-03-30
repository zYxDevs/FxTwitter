import { Context } from 'hono';
import { Constants } from '../../../constants';
import { twitterFetch } from '../fetch';
import { pickTwitterGqlFeatures, type TwitterGqlFeatureKey } from './features';

export interface GraphQLQuery {
  httpMethod: string;
  queryId: string;
  queryName: string;
  requiresAccount: boolean;
  variables: Record<string, unknown>;
  featureKeys?: readonly TwitterGqlFeatureKey[];
  fieldToggles?: Record<string, boolean>;
}

interface GraphQLRequest {
  query: GraphQLQuery;
  validator: (response: unknown) => boolean;
  variables: Record<string, unknown>;
  useElongator?: boolean;
}

export const graphqlRequest = async (c: Context, request: GraphQLRequest): Promise<unknown> => {
  const { query, validator, variables } = request;
  console.log(`📤 ${query.queryName} (${JSON.stringify(variables)})`);
  const allVariables = { ...query.variables, ...(variables ?? {}) };

  let url = `${Constants.TWITTER_API_ROOT}/graphql/${query.queryId}/${query.queryName}`;
  url += `?variables=${encodeURIComponent(JSON.stringify(allVariables))}`;
  if (query.featureKeys && query.featureKeys.length > 0) {
    const features = pickTwitterGqlFeatures(query.featureKeys);
    url += `&features=${encodeURIComponent(JSON.stringify(features))}`;
  }
  if (query.fieldToggles) {
    url += `&fieldToggles=${encodeURIComponent(JSON.stringify(query.fieldToggles))}`;
  }
  return twitterFetch(c, {
    url,
    method: 'GET',
    validateFunction: validator,
    elongatorRequired: query.requiresAccount
  });
};
