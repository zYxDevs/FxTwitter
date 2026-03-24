import { Context } from 'hono';

export const linkHitRequest = async (c: Context) => {
  const userAgent = c.req.header('User-Agent') || '';

  if (userAgent.includes('TelegramBot')) {
    return c.text('', 403);
  }
  if (typeof c.req.query('url') === 'string') {
    const url = new URL(c.req.query('url') as string);
    return c.redirect(url.href, 302);
  }
  return new Response(null, { status: 204 });
};

export const linkGoRequest = async (c: Context) => {
  if (typeof c.req.query('url') === 'string') {
    const url = new URL(c.req.query('url') as string);
    return c.redirect(url.href, 302);
  }
  return new Response(null, { status: 204 });
};
