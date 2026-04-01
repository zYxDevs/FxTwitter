/** GraphQL `x-twitter-client-language` for inline Grok translations when a target lang is requested. */
export const buildLanguageHeaders = (
  language: string | undefined
): Record<string, string> | undefined => {
  if (typeof language !== 'string' || language.length === 0) {
    return undefined;
  }
  return { 'x-twitter-client-language': normalizeLanguage(language) };
};

export const normalizeLanguage = (language: string) => {
  switch (language) {
    case 'zh':
    case 'cn':
      language = 'zh-cn';
      break;
    case 'tw':
      language = 'zh-tw';
      break;
    case 'jp':
      language = 'ja';
      break;
    case 'kr':
      language = 'ko';
      break;
    case 'ua':
      language = 'uk';
      break;
    default:
      break;
  }
  return language;
};
