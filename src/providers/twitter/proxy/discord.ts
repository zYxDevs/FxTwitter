import type { ProxyEnv } from './types';

/** Discord embed field values max out at 1024 chars. */
const DISCORD_FIELD_TRUNCATE = 1000;

function truncateForDiscordField(s: string): string {
  if (s.length <= DISCORD_FIELD_TRUNCATE) return s;
  return s.slice(0, DISCORD_FIELD_TRUNCATE) + '…';
}

function variablesCodeBlock(variablesDisplay: string): string {
  const trimmed = variablesDisplay.trim();
  if (trimmed.length === 0) {
    return '_(no GraphQL `variables` param and empty query string)_';
  }
  const lang = trimmed.startsWith('{') || trimmed.startsWith('[') ? 'json' : '';
  return '```' + lang + (lang ? '\n' : '') + variablesDisplay + '\n```';
}

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
