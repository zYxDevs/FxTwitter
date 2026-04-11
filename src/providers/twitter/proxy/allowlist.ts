const ALLOWLIST_PATH: string[] = [
  '/i/api/1.1/strato/column/None/tweetId',
  '/1.1/live_video_stream/status/',
  '/2/grok/translation.json',
  '/1.1/search/typeahead.json'
];

const ALLOWLIST_GRAPHQL_QUERY: string[] = [
  'TweetResultByRestId',
  'TweetResultsByRestIds',
  'TweetResultByIdQuery',
  'TweetResultsByIdsQuery',
  'TweetDetail',
  'ConversationTimeline',
  'UserByScreenName',
  'UserByRestId',
  'UserResultByScreenNameQuery',
  'UserResultByScreenName',
  'UserResultByRestProfileWithRepliesTimelineId',
  'Retweeters',
  'RetweetersTimeline',
  'AboutAccountQuery',
  'UserProfileAbout',
  'UserTweets',
  'UserTweetsAndReplies',
  'UserMedia',
  'UserArticlesTweets',
  'ProfileTimeline',
  'ProfileWithRepliesTimeline',
  'ProfileUserPhotoTimeline',
  'ProfileUserVideoTimeline',
  'ProfileArticlesTimeline',
  'FollowingByUserIDTimeline',
  'FollowersByUserIDTimeline',
  'Followers',
  'Following',
  'SearchTimeline',
  'ExplorePage',
  'GenericTimelineById'
];

const TRANSACTION_ID_QUERIES: string[] = ['TweetDetail', 'SearchTimeline'];

export function isAllowlisted(apiUrl: string): boolean {
  const url = new URL(apiUrl);

  if (apiUrl.includes('graphql')) {
    const query = url.pathname.split('/').pop();
    return ALLOWLIST_GRAPHQL_QUERY.some(endpoint => endpoint === query);
  }

  const endpointPath = new URL(apiUrl).pathname;
  console.log('endpointPath', endpointPath);
  return ALLOWLIST_PATH.some(endpoint => endpointPath.startsWith(endpoint));
}

export function needsTransactionId(apiUrl: string): boolean {
  const url = new URL(apiUrl);

  if (apiUrl.includes('graphql')) {
    const query = url.pathname.split('/').pop();
    return TRANSACTION_ID_QUERIES.some(endpoint => endpoint === query);
  }

  return false;
}
