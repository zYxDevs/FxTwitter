import { describe, expect, it } from 'vitest';
import {
  getProfilePhotoTimelineInstructions,
  getProfileStatusesTimelineInstructions,
  validateProfileTimelineResponse,
  validateProfileUserPhotoTimelineResponse,
  validateProfileUserVideoTimelineResponse,
  validateProfileWithRepliesTimelineResponse,
  validateUserMediaTimelineResponse,
  validateUserTweetsTimeline
} from '../src/providers/twitter/graphql/validators';

describe('profile statuses timeline (UserTweets vs ProfileTimeline)', () => {
  const instructions = [{ type: 'TimelineClearCache', entries: [] }];

  it('validates and reads UserTweets-shaped responses', () => {
    const body = {
      data: {
        user: {
          result: {
            timeline: { timeline: { instructions } }
          }
        }
      }
    };
    expect(validateUserTweetsTimeline(body)).toBe(true);
    expect(validateProfileTimelineResponse(body)).toBe(false);
    expect(getProfileStatusesTimelineInstructions(body)).toEqual(instructions);
  });

  it('validates and reads ProfileTimeline-shaped responses', () => {
    const body = {
      data: {
        user_result_by_rest_id: {
          rest_id: '783214',
          result: {
            __typename: 'User',
            profile_timeline_v2: {
              timeline: { instructions }
            }
          }
        }
      }
    };
    expect(validateProfileTimelineResponse(body)).toBe(true);
    expect(validateUserTweetsTimeline(body)).toBe(false);
    expect(getProfileStatusesTimelineInstructions(body)).toEqual(instructions);
  });

  it('validates and reads ProfileWithRepliesTimeline-shaped responses', () => {
    const body = {
      data: {
        user_result_by_rest_id: {
          rest_id: '783214',
          result: {
            __typename: 'User',
            profile_with_replies_timeline_v2: {
              timeline: { instructions }
            }
          }
        }
      }
    };
    expect(validateProfileWithRepliesTimelineResponse(body)).toBe(true);
    expect(validateProfileTimelineResponse(body)).toBe(false);
    expect(validateUserTweetsTimeline(body)).toBe(false);
    expect(getProfileStatusesTimelineInstructions(body)).toEqual(instructions);
  });

  it('validates and reads ProfileUserPhotoTimeline-shaped responses', () => {
    const body = {
      data: {
        user_result_by_rest_id: {
          rest_id: '783214',
          result: {
            __typename: 'User',
            profile_user_photo_timeline: {
              timeline: { instructions }
            }
          }
        }
      }
    };
    expect(validateProfileUserPhotoTimelineResponse(body)).toBe(true);
    expect(validateProfileTimelineResponse(body)).toBe(false);
    expect(getProfilePhotoTimelineInstructions(body)).toEqual(instructions);
  });

  it('validates and reads ProfileUserVideoTimeline-shaped responses', () => {
    const body = {
      data: {
        user_result_by_rest_id: {
          rest_id: '783214',
          result: {
            __typename: 'User',
            profile_user_video_timeline: {
              timeline: { instructions }
            }
          }
        }
      }
    };
    expect(validateProfileUserVideoTimelineResponse(body)).toBe(true);
    expect(validateProfileTimelineResponse(body)).toBe(false);
    expect(validateProfileUserPhotoTimelineResponse(body)).toBe(false);
    expect(getProfileStatusesTimelineInstructions(body)).toEqual(instructions);
  });

  it('validates and reads ProfileUserMediaTimeline-shaped responses (UserMediaQuery)', () => {
    const body = {
      data: {
        user_result_by_rest_id: {
          rest_id: '783214',
          result: {
            __typename: 'User',
            profile_user_media_timeline: {
              timeline: { instructions }
            }
          }
        }
      }
    };
    expect(validateUserMediaTimelineResponse(body)).toBe(true);
    expect(validateUserTweetsTimeline(body)).toBe(false);
    expect(validateProfileTimelineResponse(body)).toBe(false);
    expect(getProfileStatusesTimelineInstructions(body)).toEqual(instructions);
  });
});
