/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from 'hono';
import { ExplorePageQuery, GenericTimelineByIdQuery } from './graphql/queries';
import { graphqlRequest } from './graphql/request';

export type PublicExploreTimelineKind = 'trending';

const EXPLORE_TIMELINE_SECTIONS: Record<PublicExploreTimelineKind, { exploreSectionId: string }> = {
  trending: { exploreSectionId: 'trending' }
};

export const PUBLIC_EXPLORE_TIMELINE_KINDS = Object.keys(
  EXPLORE_TIMELINE_SECTIONS
) as PublicExploreTimelineKind[];

export function isPublicExploreTimelineKind(value: string): value is PublicExploreTimelineKind {
  return value in EXPLORE_TIMELINE_SECTIONS;
}

function isGraphQLTimelineCursorLoose(obj: unknown): obj is { cursorType: string; value: string } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as { __typename?: string }).__typename === 'TimelineTimelineCursor' &&
    typeof (obj as { value?: string }).value === 'string'
  );
}

export function timelineTrendToApiTrend(raw: TimelineTrendRaw): APITrend | null {
  const name = raw.name;
  if (!name || typeof name !== 'string') {
    return null;
  }
  const deep = raw.trend_url?.url ?? raw.trend_metadata?.url?.url;
  const grouped =
    raw.grouped_trends
      ?.map(g => ({
        name: typeof g.name === 'string' ? g.name : '',
      }))
      .filter(g => g.name) ?? [];

  const trend: APITrend = {
    name,
    rank: typeof raw.rank === 'string' ? raw.rank : null,
    context:
      typeof raw.trend_metadata?.domain_context === 'string'
        ? raw.trend_metadata.domain_context
        : null
  };

  if (grouped.length > 0) {
    trend.grouped_topics = grouped;
  }
  return trend;
}

export function parseTrendsFromGenericTimelineInstructions(
  instructions: TimelineInstruction[] | undefined
): { trends: APITrend[]; cursors: { cursorType: string; value: string }[] } {
  const trends: APITrend[] = [];
  const cursors: { cursorType: string; value: string }[] = [];

  for (const inst of instructions ?? []) {
    if (inst.type !== 'TimelineAddEntries') {
      continue;
    }
    for (const entry of inst.entries ?? []) {
      const content = (entry as { content?: any }).content;
      if (!content || typeof content !== 'object') {
        continue;
      }

      if (isGraphQLTimelineCursorLoose(content)) {
        cursors.push(content);
        continue;
      }

      if (content.__typename !== 'TimelineTimelineItem') {
        continue;
      }

      const itemContent = (content as { itemContent?: TimelineTrendRaw & { __typename?: string } })
        .itemContent;
      if (!itemContent || typeof itemContent !== 'object') {
        continue;
      }
      if (itemContent.__typename === 'TimelineFrame') {
        continue;
      }
      if (itemContent.__typename !== 'TimelineTrend') {
        if (isGraphQLTimelineCursorLoose(itemContent)) {
          cursors.push(itemContent);
        }
        continue;
      }

      const parsed = timelineTrendToApiTrend(itemContent);
      if (parsed) {
        trends.push(parsed);
      }
    }
  }

  return { trends, cursors };
}

export function pickExploreTimelineId(
  response: TwitterExplorePageResponse,
  exploreSectionId: string
): string | null {
  const timelines = response?.data?.explore_page?.body?.timelines;
  if (!Array.isArray(timelines)) {
    return null;
  }
  const row = timelines.find(t => t.id === exploreSectionId);
  const id = row?.timeline?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export const trendsAPI = async (
  c: Context,
  kind: PublicExploreTimelineKind,
  count: number
): Promise<APITrendsResponse> => {
  const { exploreSectionId } = EXPLORE_TIMELINE_SECTIONS[kind];

  let timelineId: string | null;
  try {
    const exploreResponse = (await graphqlRequest(c, {
      query: ExplorePageQuery,
      variables: { cursor: '' },
      validator: (r: unknown) => {
        const body = (r as TwitterExplorePageResponse)?.data?.explore_page?.body;
        return Boolean(body && Array.isArray(body.timelines));
      }
    })) as TwitterExplorePageResponse;
    timelineId = pickExploreTimelineId(exploreResponse, exploreSectionId);
  } catch (e) {
    console.error('ExplorePage request failed', e);
    return {
      code: 500,
      timeline_type: kind,
      trends: [],
      cursor: { top: null, bottom: null },
      message: 'Failed to load explore metadata'
    };
  }
  if (!timelineId) {
    return {
      code: 404,
      timeline_type: kind,
      trends: [],
      cursor: { top: null, bottom: null },
      message: 'Timeline id not found for requested type'
    };
  }

  let instructions: TimelineInstruction[] | undefined;
  try {
    const timelineResponse = (await graphqlRequest(c, {
      query: GenericTimelineByIdQuery,
      variables: {
        timelineId,
        count
      },
      validator: (r: unknown) => {
        const inst = (r as TwitterGenericTimelineByIdResponse)?.data?.timeline?.timeline
          ?.instructions;
        return Array.isArray(inst);
      }
    })) as TwitterGenericTimelineByIdResponse;
    instructions = timelineResponse?.data?.timeline?.timeline?.instructions;
  } catch (e) {
    console.error('GenericTimelineById request failed', e);
    return {
      code: 500,
      timeline_type: kind,
      trends: [],
      cursor: { top: null, bottom: null },
      message: 'Failed to load timeline'
    };
  }
  if (!instructions) {
    return {
      code: 404,
      timeline_type: kind,
      trends: [],
      cursor: { top: null, bottom: null },
      message: 'Timeline response was empty'
    };
  }

  const { trends, cursors } = parseTrendsFromGenericTimelineInstructions(instructions);
  const top = cursors.find(x => x.cursorType === 'Top')?.value ?? null;
  const bottom = cursors.find(x => x.cursorType === 'Bottom')?.value ?? null;

  return {
    code: 200,
    timeline_type: kind,
    trends,
    cursor: { top, bottom }
  };
};
