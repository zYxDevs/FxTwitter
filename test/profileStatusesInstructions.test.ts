import { describe, expect, it } from 'vitest';
import {
  getProfileStatusesTimelineInstructions,
  validateProfileTimelineResponse,
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
});
