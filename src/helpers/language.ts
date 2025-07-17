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
