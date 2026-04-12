import type { ProxyEnv } from './types';

export async function sendDiscordAlert(
  env: ProxyEnv,
  username: string,
  requestPath: string,
  errors: unknown,
  variablesDisplay: string
): Promise<void> {
  if (!env.EXCEPTION_DISCORD_WEBHOOK) return;

  console.log('Sending Discord webhook');
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
            value: (requestPath ?? '').match(/\w+$/g)?.[0] ?? 'idk',
            inline: true
          },
          {
            name: 'Errors',
            value: '```json\n' + JSON.stringify(errors, null, 2) + '\n```',
            inline: false
          },
          {
            name: 'Variables',
            value: '```json\n' + variablesDisplay + '\n```',
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
