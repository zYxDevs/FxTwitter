// Grok translation by default streams if it hasn't cached it before. So we need to join the token chunks together
// Exmmple:
// {"result":{"content_type":"POST","text":"There"}}
// {"result":{"content_type":"POST","text":" are"}}
// {"result":{"content_type":"POST","text":" many"}}
// {"result":{"content_type":"POST","text":" things"}}
// {"result":{"content_type":"POST","text":" that"}}
// {"result":{"content_type":"POST","text":" people"}}
// {"result":{"content_type":"POST","text":" have"}}
// {"result":{"content_type":"POST","text":" to"}}
// {"result":{"content_type":"POST","text":" take"}}
// {"result":{"content_type":"POST","text":" into"}}
// {"result":{"content_type":"POST","text":" account"}}
// {"result":{"content_type":"POST","text":"."}}

// Detokenized result:
// {"result":{"content_type":"POST","text":"There are many things that people have to take into account."}}

export const detokenize = (text: string): unknown => {
  console.log('Detokenizing LLM response', text);
  const lines = text.split('\n');
  const base = JSON.parse(lines[0]);
  lines.forEach((line, index) => {
    // We already have the first token in our base object, so we can skip it
    if (index === 0) {
      return;
    }
    try {
      const json = JSON.parse(line);
      base.result.text += json.result.text;
    } catch (e) {
      console.error('Failed to detokenize chunk', e);
    }
  });

  return base;
};
