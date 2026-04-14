import type { ProxyEnv } from './types';

/** Discord embed field values max out at 1024 chars. */
const DISCORD_FIELD_TRUNCATE = 1000;

/**
 * Truncates a string for use in a Discord embed field, appending an ellipsis when it exceeds the field length limit.
 *
 * @param s - The input string to truncate
 * @returns The original string if its length is less than or equal to 1000, otherwise the first 1000 characters followed by an ellipsis
 */
function truncateForDiscordField(s: string): string {
  if (s.length <= DISCORD_FIELD_TRUNCATE) return s;
  return s.slice(0, DISCORD_FIELD_TRUNCATE) + '…';
}

/**
 * Wraps a GraphQL variables string in a fenced code block or returns a placeholder when the input is empty.
 *
 * @param variablesDisplay - The raw variables text to format (may be empty or contain JSON/other text)
 * @returns The formatted string: a placeholder "_(no GraphQL `variables` param and empty query string)_" when the trimmed input is empty, otherwise a fenced code block containing the original `variablesDisplay`. If the trimmed input starts with `{` or `[` the code block is marked with the `json` language.
 */
function variablesCodeBlock(variablesDisplay: string): string {
  const trimmed = variablesDisplay.trim();
  if (trimmed.length === 0) {
    return '_(no GraphQL `variables` param and empty query string)_';
  }
  const lang = trimmed.startsWith('{') || trimmed.startsWith('[') ? 'json' : '';
  return '```' + lang + (lang ? '\n' : '') + variablesDisplay + '\n```';
}

/**
 * Sends a formatted alert to a Discord webhook about a failed request.
 *
 * If `env.EXCEPTION_DISCORD_WEBHOOK` is falsy, the function returns immediately and no request is sent.
 *
 * @param env - Environment object that must include `EXCEPTION_DISCORD_WEBHOOK` (the webhook URL)
 * @param username - Account identifier to display (will be obfuscated in the embed)
 * @param requestPath - Original request path used to produce the "Endpoint" embed field
 * @param errors - Error payload to include in the "Errors" embed field (serialized as JSON)
 * @param variablesDisplay - Raw GraphQL variables string to include in the "Variables" embed field (may be wrapped or replaced with a placeholder)
 */
export async function sendDiscordAlert(
  env: ProxyEnv,
  username: string,
  requestPath: string,
  errors: unknown,
  variablesDisplay: string
): Promise<void> {
  if (!env.EXCEPTION_DISCORD_WEBHOOK) return;

  console.log('Sending Discord webhook');
  const endpointDisplay = truncateForDiscordField((requestPath ?? '').replace(/^\//, '') || 'idk');
  const body = JSON.stringify({
    content: `@everyone`,
    embeds: [
      {
        title: 'Request Failed',
        color: 0xff0000,
        fields: [
          {
            name: 'Account',
            value: `||${username}||`,
            inline: true
          },
          {
            name: 'Endpoint',
            value: endpointDisplay,
            inline: true
          },
          {
            name: 'Errors',
            value: '```json\n' + JSON.stringify(errors, null, 2) + '\n```',
            inline: false
          },
          {
            name: 'Variables',
            value: variablesCodeBlock(variablesDisplay),
            inline: false
          }
        ]
      }
    ]
  });
  console.log('body', body);
  const discordResponse = await fetch(env.EXCEPTION_DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  }).catch(err => console.error('Failed to send Discord webhook:', err));
  console.log('discordResponse', await discordResponse?.text());
}
