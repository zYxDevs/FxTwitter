import { GraphQLQuery } from './request';

export const TweetResultByRestIdQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'f2sagi1jweVHFkTUIHzmMQ',
  queryName: 'TweetResultByRestId',
  requiresAccount: false,
  variables: {
    withCommunity: false,
    includePromotedContent: false,
    withVoice: false
  },
  features: {
    creator_subscriptions_tweet_preview_api_enabled: true,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: false,
    responsive_web_jetfuel_frame: true,
    responsive_web_grok_share_attachment_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: true,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    payments_enabled: false,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    verified_phone_label_enabled: false,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_enhance_cards_enabled: false
  },
  fieldToggles: {
    withArticleRichContentState: true,
    withArticlePlainText: false,
    withGrokAnalyze: false,
    withDisallowedReplyControls: false
  }
};

export const TweetResultsByRestIdsQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'XM66WIszpd1XC97myrIS0w',
  queryName: 'TweetResultsByRestIds',
  requiresAccount: true,
  variables: {
    withCommunity: false,
    includePromotedContent: false,
    withVoice: false
  },
  features: {
    creator_subscriptions_tweet_preview_api_enabled: true,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: false,
    responsive_web_jetfuel_frame: false,
    responsive_web_grok_share_attachment_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    verified_phone_label_enabled: false,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_enhance_cards_enabled: false
  },
  fieldToggles: {
    withArticleRichContentState: true
  }
};

export const TweetDetailQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'R9IzzyzQBV87-DOWpcvDmw',
  queryName: 'TweetDetail',
  requiresAccount: true,
  variables: {
    // focalTweetId: 0,
    with_rux_injections: false,
    rankingMode: 'Relevance', // | 'Recency' | 'Likes'
    includePromotedContent: false,
    withCommunity: false,
    withQuickPromoteEligibilityTweetFields: false,
    withBirdwatchNotes: true,
    withVoice: false,
    cursor: null
  },
  features: {
    rweb_video_screen_enabled: false,
    payments_enabled: false,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    responsive_web_jetfuel_frame: true,
    responsive_web_grok_share_attachment_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: true,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_enhance_cards_enabled: false
  },
  fieldToggles: {
    withArticleRichContentState: true,
    withArticlePlainText: false,
    withGrokAnalyze: false,
    withDisallowedReplyControls: false
  }
};

/** Captured from Twitter iPhone ConversationTimeline; higher rate limit than TweetDetail */
export const ConversationTimelineQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'b-bCN9RelT8k0fCr_s2BFg',
  queryName: 'ConversationTimeline',
  requiresAccount: true,
  variables: {
    include_grok_translated_bio: false,
    display_location: 'Default',
    ranking_mode: 'Relevance',
    cta_display_location: 'TweetDetails',
    include_unmention_info_override: false,
    is_member_target_user_id: '0',
    cursor: null,
    include_conversation_context: false,
    include_reply_device_follow: false,
    include_is_member: false,
    // controller_data: 'DAACDAABDAABCgABAAAAAAAAAAAKAAkW0pcLr1YgAQoACgAAAZ0uryT6AAAAAA==',
    include_pill_groups_in_modules: false,
    include_dm_muting: false,
    include_community_tweet_relationship: true,
    referrer: 'me',
    include_grok_analysis_button: true,
    include_professional: false,
    include_is_translatable: true,
    include_tweet_quick_promote_eligibility: false,
    include_cta: true,
    skip_author_community_relationship: false
  },
  features: {
    ios_button_layout_fix_use_grok_annotations: false,
    conversational_replies_ios_downvote_api_enabled: false,
    ios_home_timeline_external_status_injections_fetch_tweet_facepile_enabled: false,
    profile_foundations_has_spaces_graphql_enabled: false,
    graphql_unified_card_enabled: true,
    birdwatch_consumption_enabled: false,
    ios_notifications_replies_mentions_device_follow_enabled: true,
    grok_ios_tweet_detail_followups_enabled: false,
    ios_tweet_detail_always_load_is_translatable: false,
    tweet_context_is_enabled: true,
    unified_cards_destination_url_params_enabled: true,
    grok_translations_community_note_translation_is_enabled: true,
    rito_safety_mode_features_enabled: false,
    profile_label_improvements_pcf_settings_enabled: true,
    view_counts_everywhere_api_enabled: true,
    profile_label_improvements_pcf_edit_profile_enabled: true,
    x_jetfuel_enable_frames_on_posts: true,
    unified_cards_ad_metadata_container_dynamic_card_content_query_enabled: true,
    continue_watching_consume_graphql: false,
    grok_translations_post_auto_translation_is_enabled: false,
    tweetypie_unmention_optimization_enabled: true,
    grok_ios_author_view_analyze_button_fetch_trends_enabled: false,
    grok_edit_with_grok_button_under_post_include_grok_image_annotation_in_graphql: false,
    tweet_with_visibility_results_prefer_gql_media_interstitial_enabled: true,
    immersive_video_status_linkable_timestamps: true,
    ssp_ads_preroll_enabled: false,
    grok_translations_community_note_auto_translation_is_enabled: false,
    articles_api_enabled: true,
    articles_preview_enabled: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true
  }
};

export const TweetResultsByIdsQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'q8hBgBMTfE_-_bEaJoeHMQ',
  queryName: 'TweetResultsByIdsQuery',
  requiresAccount: true,
  variables: {
    includeTweetImpression: true,
    includeHasBirdwatchNotes: false,
    includeEditPerspective: false,
    rest_ids: [],
    includeEditControl: true,
    includeCommunityTweetRelationship: true,
    includeTweetVisibilityNudge: true
  },
  features: {
    grok_translations_community_note_translation_is_enabled: false,
    longform_notetweets_inline_media_enabled: true,
    grok_android_analyze_trend_fetch_enabled: false,
    super_follow_badge_privacy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    super_follow_user_api_enabled: true,
    super_follow_tweet_api_enabled: true,
    articles_api_enabled: true,
    profile_label_improvements_pcf_label_in_profile_enabled: true,
    premium_content_api_read_enabled: false,
    grok_translations_community_note_auto_translation_is_enabled: false,
    android_graphql_skip_api_media_color_palette: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    freedom_of_speech_not_reach_fetch_enabled: true,
    tweetypie_unmention_optimization_enabled: true,
    longform_notetweets_consumption_enabled: true,
    subscriptions_verification_info_enabled: true,
    grok_translations_post_auto_translation_is_enabled: false,
    blue_business_profile_image_shape_enabled: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    immersive_video_status_linkable_timestamps: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    super_follow_exclusive_tweet_notifications_enabled: true
  }
};

export const TweetResultByIdQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'XcmCoTco-zSOvAZESj78OQ',
  queryName: 'TweetResultByIdQuery',
  requiresAccount: true,
  variables: {
    includeTweetImpression: true,
    includeHasBirdwatchNotes: true,
    includeEditPerspective: false,
    includeEditControl: true,
    includeCommunityTweetRelationship: true,
    includeTweetVisibilityNudge: true
  },
  features: {
    grok_translations_community_note_translation_is_enabled: false,
    longform_notetweets_inline_media_enabled: true,
    grok_android_analyze_trend_fetch_enabled: false,
    super_follow_badge_privacy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    super_follow_user_api_enabled: true,
    super_follow_tweet_api_enabled: true,
    articles_api_enabled: true,
    profile_label_improvements_pcf_label_in_profile_enabled: true,
    premium_content_api_read_enabled: false,
    grok_translations_community_note_auto_translation_is_enabled: false,
    android_graphql_skip_api_media_color_palette: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    freedom_of_speech_not_reach_fetch_enabled: true,
    tweetypie_unmention_optimization_enabled: true,
    longform_notetweets_consumption_enabled: true,
    subscriptions_verification_info_enabled: true,
    grok_translations_post_auto_translation_is_enabled: false,
    blue_business_profile_image_shape_enabled: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    immersive_video_status_linkable_timestamps: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    super_follow_exclusive_tweet_notifications_enabled: true
  }
};

export const UserByScreenNameQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'U15Q5V7hgjzCEg6WpSWhqg',
  queryName: 'UserByScreenName',
  requiresAccount: true,
  variables: {
    // screen_name: ''
  },
  features: {
    responsive_web_grok_bio_auto_translation_is_enabled: false,
    hidden_profile_subscriptions_enabled: true,
    payments_enabled: false,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    responsive_web_twitter_article_notes_tab_enabled: true,
    subscriptions_feature_can_gift_premium: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true
  },
  fieldToggles: {
    withAuxiliaryUserLabels: true
  }
};

export const UserResultByScreenNameQueryQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: '2DgQpAxdL3NfBVOokJ_XcA',
  queryName: 'UserResultByScreenNameQuery',
  requiresAccount: true,
  variables: {
    include_smart_block: true,
    includeTweetImpression: true,
    include_profile_info: true,
    includeTranslatableProfile: true,
    includeHasBirdwatchNotes: false,
    include_tipjar: true,
    includeEditPerspective: false,
    // screen_name: '',
    include_reply_device_follow: true,
    includeEditControl: true,
    include_verified_phone_status: false
  },
  features: {
    profile_label_improvements_pcf_label_in_profile_enabled: true,
    verified_phone_label_enabled: false,
    super_follow_badge_privacy_enabled: true,
    subscriptions_verification_info_enabled: true,
    super_follow_user_api_enabled: true,
    blue_business_profile_image_shape_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    immersive_video_status_linkable_timestamps: true,
    super_follow_exclusive_tweet_notifications_enabled: true
  }
};

export const UserResultByScreenNameQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: '5moJkBXyS_m_WjHEEZUm9Q',
  queryName: 'UserResultByScreenName',
  requiresAccount: true,
  variables: {
    creator_subscriptions_email_share_enabled: true,
    include_grok_translated_bio: false,
    include_can_pay: false,
    include_highlights_info: true,
    include_professional: true,
    include_is_profile_translatable: true,
    include_business_account: true,
    include_creator_subscriptions_count: true,
    include_reply_device_follow: true,
    include_tipjar: true,
    include_dm_muting: false,
    include_hidden_profile_likes: true
    // screen_name: 'x'
  },
  features: {
    rito_safety_mode_features_enabled: false,
    hidden_profile_subscriptions_enabled: true,
    profile_foundations_has_spaces_graphql_enabled: false,
    articles_timeline_profile_tab_enabled: true,
    ios_notifications_replies_mentions_device_follow_enabled: true,
    subscriptions_feature_can_gift_premium: true,
    immersive_video_status_linkable_timestamps: true
  }
};

export const AboutAccountQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'zs_jFPFT78rBpXv9Z3U2YQ',
  queryName: 'AboutAccountQuery',
  requiresAccount: true,
  variables: {
    screenName: ''
  }
};

export const UserByRestIdQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'VQfQ9wwYdk6j_u2O4vt64Q',
  queryName: 'UserByRestId',
  requiresAccount: true,
  variables: {
    withGrokTranslatedBio: true
  },
  features: {
    hidden_profile_subscriptions_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: false,
    rweb_tipjar_consumption_enabled: false,
    verified_phone_label_enabled: false,
    highlights_tweets_tab_ui_enabled: true,
    responsive_web_twitter_article_notes_tab_enabled: true,
    subscriptions_feature_can_gift_premium: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true
  },
  fieldToggles: {
    withPayments: false,
    withAuxiliaryUserLabels: true
  }
};

export const UserResultByRestIdQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'Xe7WXUEMI2F7kK-kZSZoWA',
  queryName: 'UserResultByRestId',
  requiresAccount: true,
  variables: {
    creator_subscriptions_email_share_enabled: false,
    include_grok_translated_bio: false,
    include_can_pay: false,
    include_highlights_info: false,
    include_professional: true,
    include_is_profile_translatable: false,
    include_business_account: false,
    include_creator_subscriptions_count: false,
    include_reply_device_follow: true,
    include_tipjar: true,
    include_dm_muting: false,
    include_hidden_profile_likes: false
  },
  features: {
    rito_safety_mode_features_enabled: false,
    profile_foundations_has_spaces_graphql_enabled: false,
    hidden_profile_subscriptions_enabled: true,
    subscriptions_feature_can_gift_premium: true,
    ios_notifications_replies_mentions_device_follow_enabled: true,
    profile_label_improvements_pcf_settings_enabled: true,
    articles_timeline_profile_tab_enabled: true,
    profile_label_improvements_pcf_edit_profile_enabled: true,
    immersive_video_status_linkable_timestamps: true
  }
};

export const UserProfileAboutQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'xT7-nTEDL_VgiUQXZDtuAA',
  queryName: 'UserProfileAbout',
  requiresAccount: true,
  variables: {}
};

/** Shared with SearchTimeline, ExplorePage, and GenericTimelineById */
const exploreAndGenericTimelineFeatures = {
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: false,
  rweb_tipjar_consumption_enabled: false,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: false,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_annotations_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  content_disclosure_indicator_enabled: true,
  content_disclosure_ai_generated_indicator_enabled: true,
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_grok_analysis_button_from_backend: true,
  post_ctas_fetch_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: false,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
  responsive_web_enhance_cards_enabled: false
};

export const SearchTimelineQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'GcXk9vN_d1jUfHNqLacXQA',
  queryName: 'SearchTimeline',
  requiresAccount: true,
  variables: {
    // rawQuery: '',
    // count: 20, // max 100
    querySource: 'typed_query'
    // product: 'Latest', // | 'Top' | 'Media',
    // cursor: null
  },
  features: exploreAndGenericTimelineFeatures
};

export const ExplorePageQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: '0ocOmOo8rQuZCkxCg7Bs7w',
  queryName: 'ExplorePage',
  requiresAccount: true,
  variables: {
    cursor: ''
  },
  features: exploreAndGenericTimelineFeatures
};

export const GenericTimelineByIdQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'IXBKaPnXncdeAOoCEgco4A',
  queryName: 'GenericTimelineById',
  requiresAccount: true,
  variables: {
    // timelineId set per request
    count: 20,
    withQuickPromoteEligibilityTweetFields: true
  },
  features: exploreAndGenericTimelineFeatures
};

/** Captured from x.com web UserTweets */
const userTweetsFeatures = {
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: false,
  rweb_tipjar_consumption_enabled: false,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_annotations_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  content_disclosure_indicator_enabled: true,
  content_disclosure_ai_generated_indicator_enabled: true,
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_grok_analysis_button_from_backend: true,
  post_ctas_fetch_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: false,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
  responsive_web_enhance_cards_enabled: false
};

export const UserTweetsQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'O0epvwaQPUx-bT9YlqlL6w',
  queryName: 'UserTweets',
  requiresAccount: true,
  variables: {
    // userId: '',
    // count: 20,
    includePromotedContent: true,
    withQuickPromoteEligibilityTweetFields: true,
    withVoice: true,
    cursor: null
  },
  features: userTweetsFeatures
};

/** Captured from x.com web UserMedia (profile Media tab) */
const userMediaFeatures = {
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: false,
  rweb_tipjar_consumption_enabled: false,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_annotations_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  content_disclosure_indicator_enabled: true,
  content_disclosure_ai_generated_indicator_enabled: true,
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_grok_analysis_button_from_backend: true,
  post_ctas_fetch_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: false,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
  responsive_web_enhance_cards_enabled: false
};

export const UserMediaQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'SjiAp7wyuCUBkKAJJObU8w',
  queryName: 'UserMedia',
  requiresAccount: true,
  variables: {
    includePromotedContent: false,
    withClientEventToken: false,
    withBirdwatchNotes: false,
    withVoice: true,
    cursor: null
  },
  features: userMediaFeatures
};

/** Captured from x.com iOS/web ProfileTimeline — same timeline instructions as UserTweets, higher rate limit */
const profileTimelineFeatures = {
  ios_button_layout_fix_use_grok_annotations: false,
  profile_foundations_has_spaces_graphql_enabled: false,
  birdwatch_consumption_enabled: false,
  ios_home_timeline_external_status_injections_fetch_tweet_facepile_enabled: false,
  conversational_replies_ios_downvote_api_enabled: true,
  graphql_unified_card_enabled: true,
  ios_notifications_replies_mentions_device_follow_enabled: true,
  grok_ios_tweet_detail_followups_enabled: false,
  ios_tweet_detail_always_load_is_translatable: false,
  tweet_context_is_enabled: true,
  unified_cards_destination_url_params_enabled: true,
  grok_translations_community_note_translation_is_enabled: true,
  rito_safety_mode_features_enabled: false,
  profile_label_improvements_pcf_edit_profile_enabled: true,
  profile_label_improvements_pcf_settings_enabled: true,
  view_counts_everywhere_api_enabled: true,
  x_jetfuel_enable_frames_on_posts: true,
  unified_cards_ad_metadata_container_dynamic_card_content_query_enabled: true,
  grok_translations_community_note_auto_translation_is_enabled: true,
  continue_watching_consume_graphql: false,
  tweetypie_unmention_optimization_enabled: true,
  grok_translations_post_auto_translation_is_enabled: true,
  grok_ios_author_view_analyze_button_fetch_trends_enabled: false,
  tweet_with_visibility_results_prefer_gql_media_interstitial_enabled: true,
  ssp_ads_preroll_enabled: false,
  grok_edit_with_grok_button_under_post_include_grok_image_annotation_in_graphql: false,
  immersive_video_status_linkable_timestamps: true,
  articles_preview_enabled: true,
  articles_api_enabled: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true
};

export const ProfileTimelineQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: '3mLSzzCq-uKpJ3nqMdJBhQ',
  queryName: 'ProfileTimeline',
  requiresAccount: true,
  variables: {
    include_is_translatable: false,
    include_community_tweet_relationship: false,
    include_grok_analysis_button: true,
    include_cta: false,
    include_grok_translated_bio: false,
    include_tweet_quick_promote_eligibility: false,
    include_professional: false,
    include_conversation_context: false,
    skip_author_community_relationship: false,
    include_pill_groups_in_modules: false,
    include_is_member: false,
    autoplay_enabled: true,
    include_reply_device_follow: false,
    include_unmention_info_override: false,
    include_dm_muting: false,
    is_member_target_user_id: '0',
    // rest_id, count, cursor merged per request (cursor in variables when paginating)
    cursor: null
  },
  features: profileTimelineFeatures
};

/** Captured from x.com — ProfileWithRepliesTimeline (same flags/features as ProfileTimeline) */
export const ProfileWithRepliesTimelineQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'vG_Yd3BEZTwSVlhdImQJSQ',
  queryName: 'ProfileWithRepliesTimeline',
  requiresAccount: true,
  variables: {
    include_is_translatable: false,
    include_community_tweet_relationship: false,
    include_grok_analysis_button: true,
    include_cta: false,
    include_grok_translated_bio: false,
    include_tweet_quick_promote_eligibility: false,
    include_professional: false,
    include_conversation_context: false,
    skip_author_community_relationship: false,
    include_pill_groups_in_modules: false,
    include_is_member: false,
    autoplay_enabled: true,
    include_reply_device_follow: false,
    include_unmention_info_override: false,
    include_dm_muting: false,
    is_member_target_user_id: '0',
    cursor: null
  },
  features: profileTimelineFeatures
};

/** Captured from x.com web UserTweetsAndReplies HAR (subset of flags vs UserTweets) */
const userTweetsAndRepliesFeatures = {
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: false,
  rweb_tipjar_consumption_enabled: false,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_annotations_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  content_disclosure_indicator_enabled: true,
  content_disclosure_ai_generated_indicator_enabled: true,
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_grok_analysis_button_from_backend: true,
  post_ctas_fetch_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: false,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
  responsive_web_enhance_cards_enabled: false
};

export const UserTweetsAndRepliesQuery: GraphQLQuery = {
  httpMethod: 'GET',
  queryId: 'EJTxTKSH-byy7X46AhtKeA',
  queryName: 'UserTweetsAndReplies',
  requiresAccount: true,
  variables: {
    includePromotedContent: true,
    withCommunity: true,
    withVoice: true,
    cursor: null
  },
  features: userTweetsAndRepliesFeatures
};
