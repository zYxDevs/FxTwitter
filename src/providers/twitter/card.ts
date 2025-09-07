import { APIPoll, APIExternalMedia, APIBroadcast } from '../../types/types';
import { calculateTimeLeftString } from '../../helpers/pollTime';
import { twitterFetch } from './fetch';
import { Context } from 'hono';
import { Constants } from '../../constants';

/* Renders card for polls and non-Twitter video embeds (i.e. YouTube) */
export const renderCard = async (
  c: Context,
  card: GraphQLTwitterStatus['card']
): Promise<{
  poll?: APIPoll;
  external_media?: APIExternalMedia;
  broadcast?: APIBroadcast;
  media?: { videos: TweetMedia[]; photos: TweetMedia[] };
}> => {
  if (!Array.isArray(card.legacy?.binding_values)) {
    return {};
  }

  const binding_values: Record<
    string,
    { string_value?: string; boolean_value?: boolean; image_value?: { url: string } }
  > = {};

  card.legacy.binding_values.forEach(value => {
    if (value.key && value.value) {
      binding_values[value.key] = value.value;
    }
  });

  console.log('rendering card');
  console.log('binding_values', JSON.stringify(binding_values));

  if (binding_values.broadcast_url?.string_value) {
    const broadcast: APIBroadcast = {
      url: binding_values.broadcast_url.string_value,
      width: parseInt(binding_values.broadcast_width?.string_value || '1280'),
      height: parseInt(binding_values.broadcast_height?.string_value || '720'),
      state: binding_values.broadcast_state?.string_value as 'LIVE' | 'ENDED',
      broadcaster: {
        username: binding_values.broadcaster_username?.string_value || '',
        display_name: binding_values.broadcaster_display_name?.string_value || '',
        id: binding_values.broadcaster_twitter_id?.string_value || ''
      },
      title: binding_values.broadcast_title?.string_value || '',
      orientation:
        binding_values.broadcast_orientation?.string_value === '1' ? 'portrait' : 'landscape',
      broadcast_id: binding_values.broadcast_id?.string_value || '',
      media_id: binding_values.broadcast_media_id?.string_value || '',
      media_key: binding_values.broadcast_media_key?.string_value || '',
      is_high_latency: binding_values.broadcast_is_high_latency?.boolean_value || false,
      thumbnail: {
        original: {
          url: binding_values.broadcast_thumbnail_original?.image_value?.url || ''
        },
        small: {
          url: binding_values.broadcast_thumbnail_small?.image_value?.url || ''
        },
        medium: {
          url: binding_values.broadcast_thumbnail_medium?.image_value?.url || ''
        },
        large: {
          url: binding_values.broadcast_thumbnail_large?.image_value?.url || ''
        },
        x_large: {
          url: binding_values.broadcast_thumbnail_x_large?.image_value?.url || ''
        }
      },
      source: binding_values.broadcast_source?.string_value || 'Producer'
    };
    // Fetch https://x.com/i/api/1.1/broadcasts/show.json?ids=media_id&include_events=false
    const broadcastData = (await twitterFetch(c, {
      url: `${Constants.TWITTER_API_ROOT}/1.1/live_video_stream/status/${broadcast.media_key}?client=web&use_syndication_guest_id=false&cookie_set_host=x.com`
    })) as {
      source: {
        location: string;
        noRedirectPlaybackUrl: string;
        status: string;
        streamType: string;
      };
      sessionId: string;
      chatToken: string;
      lifecycleToken: string;
      shareUrl: string;
    };
    console.log('broadcastData', broadcastData);
    if (broadcastData) {
      console.log('time to load stream data');
      broadcast.stream = {
        url: broadcastData.source.location
      };
    }
    return {
      broadcast: broadcast
    };
  }

  if (binding_values.choice1_count?.string_value) {
    const choices: { [label: string]: number } = {};
    for (let i = 1; i <= 4; i++) {
      choices[binding_values[`choice${i}_label`]?.string_value || ''] = parseInt(
        binding_values[`choice${i}_count`]?.string_value || '0'
      );
    }

    const total_votes = Object.values(choices).reduce((a, b) => a + b, 0);

    return {
      poll: {
        ends_at: binding_values.end_datetime_utc?.string_value || '',
        time_left_en: calculateTimeLeftString(
          new Date(binding_values.end_datetime_utc?.string_value || '')
        ),
        total_votes,
        choices: Object.keys(choices)
          .filter(label => label !== '')
          .map(label => ({
            label: label,
            count: choices[label],
            percentage: (Math.round((choices[label] / total_votes) * 1000) || 0) / 10
          }))
      }
    };
  }

  if (binding_values.player_url?.string_value) {
    /* Oh good, a non-Twitter video URL! This enables YouTube embeds and stuff to just work */
    return {
      external_media: {
        type: 'video',
        url: binding_values.player_url.string_value,
        width: parseInt((binding_values.player_width?.string_value || '1280').replace('px', '')), // TODO: Replacing px might not be necessary, it's just there as a precaution
        height: parseInt((binding_values.player_height?.string_value || '720').replace('px', ''))
      }
    };
  }

  if (binding_values.unified_card?.string_value) {
    try {
      const card = JSON.parse(binding_values.unified_card.string_value);
      const mediaEntities = card?.media_entities as Record<string, TweetMedia>;

      if (mediaEntities) {
        const media = {
          videos: [] as TweetMedia[],
          photos: [] as TweetMedia[]
        };
        Object.keys(mediaEntities).forEach(key => {
          const mediaItem = mediaEntities[key];
          switch (mediaItem.type) {
            case 'photo':
              media.photos.push(mediaItem);
              break;
            case 'animated_gif':
            case 'video':
              media.videos.push(mediaItem);
              break;
          }
        });

        console.log('media', media);

        return { media: media };
      }
    } catch (e) {
      console.error('Failed to parse unified card JSON', e);
    }
  }

  return {};
};
