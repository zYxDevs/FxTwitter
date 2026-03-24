import { test, expect } from 'vitest';
import {
  parseTrendsFromGenericTimelineInstructions,
  pickExploreTimelineId,
  timelineTrendToApiTrend
} from '../src/providers/twitter/trends';

test('pickExploreTimelineId reads explore section from ExplorePage shape', () => {
  const res: TwitterExplorePageResponse = {
    data: {
      explore_page: {
        body: {
          timelines: [
            { id: 'for_you', timeline: { id: 'a' } },
            { id: 'trending', timeline: { id: 'tid-xyz' } }
          ]
        }
      }
    }
  };
  expect(pickExploreTimelineId(res, 'trending')).toBe('tid-xyz');
  expect(pickExploreTimelineId(res, 'missing')).toBeNull();
  expect(pickExploreTimelineId({}, 'trending')).toBeNull();
});

test('timelineTrendToApiTrend builds grouped_topics and urls', () => {
  const t = timelineTrendToApiTrend({
    __typename: 'TimelineTrend',
    name: 'Main',
    rank: '3',
    is_ai_trend: true,
    grouped_trends: [{ name: 'Side', url: { url: 'twitter://search/?query=Side' } }],
    trend_url: { url: 'twitter://search/?query=Main' },
    trend_metadata: { domain_context: 'News · Trending' }
  });
  expect(t).toMatchObject({
    name: 'Main',
    rank: '3',
    context: 'News · Trending',
    is_ai_trend: true,
    grouped_topics: [{ name: 'Side' }]
  });
});

test('parseTrendsFromGenericTimelineInstructions skips frames and collects cursors', () => {
  const { trends, cursors } = parseTrendsFromGenericTimelineInstructions([
    {
      type: 'TimelineAddEntries',
      entries: [
        {
          content: {
            __typename: 'TimelineTimelineItem',
            itemContent: { __typename: 'TimelineFrame', name: 'ignored' }
          }
        },
        {
          content: {
            __typename: 'TimelineTimelineItem',
            itemContent: {
              __typename: 'TimelineTrend',
              name: 'Only Trend',
              trend_url: { url: 'twitter://search/?query=Only' }
            }
          }
        },
        {
          content: {
            __typename: 'TimelineTimelineCursor',
            cursorType: 'Top',
            value: 't1'
          }
        },
        {
          content: {
            __typename: 'TimelineTimelineCursor',
            cursorType: 'Bottom',
            value: 'b1'
          }
        }
      ]
    }
  ]);
  expect(trends).toHaveLength(1);
  expect(trends[0].name).toBe('Only Trend');
  expect(cursors.map(c => c.value)).toEqual(['t1', 'b1']);
});
