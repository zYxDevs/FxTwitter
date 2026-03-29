export const validateAboutAccountQuery = (response: unknown): boolean => {
  const aboutAccountResponse = response as AboutAccountQueryResponse;
  const result = aboutAccountResponse?.data?.user_result_by_screen_name?.result;
  return Boolean(result && typeof result === 'object');
};

export const validateUserProfileAboutQuery = (response: unknown): boolean => {
  const r = response as UserProfileAboutResponse;
  const result = r?.data?.user_rest_result_by_rest_id?.result;
  return Boolean(result && typeof result === 'object');
};

export const validateUserTweetsTimeline = (response: unknown): boolean => {
  const r = response as TwitterUserTweetsResponse;
  return Array.isArray(r?.data?.user?.result?.timeline?.timeline?.instructions);
};

export const validateProfileTimelineResponse = (response: unknown): boolean => {
  const r = response as TwitterProfileTimelineResponse;
  return Array.isArray(
    r?.data?.user_result_by_rest_id?.result?.profile_timeline_v2?.timeline?.instructions
  );
};

/** Normalize UserTweets vs ProfileTimeline GraphQL shapes for shared processing */
export const getProfileStatusesTimelineInstructions = (
  response: unknown
): TimelineInstruction[] | undefined => {
  const asUserTweets = response as TwitterUserTweetsResponse;
  const userTweetsPath = asUserTweets?.data?.user?.result?.timeline?.timeline?.instructions;
  if (Array.isArray(userTweetsPath)) {
    return userTweetsPath;
  }
  const asProfile = response as TwitterProfileTimelineResponse;
  const profilePath =
    asProfile?.data?.user_result_by_rest_id?.result?.profile_timeline_v2?.timeline?.instructions;
  if (Array.isArray(profilePath)) {
    return profilePath;
  }
  return undefined;
};
