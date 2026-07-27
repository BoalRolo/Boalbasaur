/* The one piece of this site that is not static.

   QUICK MESSAGE and SHARE IDEA post here, and this hands the text to Telegram.
   It exists for one reason: the Telegram bot token and the chat id cannot go in
   the page. Anything the browser can read, everyone can read, and a leaked bot
   token lets a stranger post as the bot and read whatever it can see. They live
   as Worker secrets instead, set with `wrangler secret put` and never written
   down in this repo. See the README.

   Everything else on the site is still a file: any request this does not
   recognise is handed straight to the static assets. */

const TELEGRAM_API = 'https://api.telegram.org';

// Long enough for anything worth reading, short enough that the endpoint is not
// a place to dump megabytes into someone's phone.
const MAX_BODY = 2000;
const MAX_CONTACT = 200;
const MAX_KIND = 40;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/send') {
      return handleSend(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // The browser is not meant to keep an answer to this.
      'cache-control': 'no-store',
    },
  });
}

async function handleSend(request, env) {
  if (request.method !== 'POST') {
    return json(405, { ok: false, error: 'method' });
  }

  // Same-origin only. This does not stop anyone with curl — nothing short of a
  // challenge does — but it does stop another site from quietly posting through
  // a visitor's browser, which is the abuse that costs nothing to run.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json(403, { ok: false, error: 'origin' });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return json(400, { ok: false, error: 'json' });
  }

  const body = text(payload.body, MAX_BODY);
  const contact = text(payload.contact, MAX_CONTACT);
  const kind = text(payload.kind, MAX_KIND) || 'Message';

  if (!body) {
    return json(400, { ok: false, error: 'empty' });
  }

  // Missing config is a server problem, and the page's answer to it is to fall
  // back to the mail app. Say so plainly rather than pretending it sent.
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return json(503, { ok: false, error: 'unconfigured' });
  }

  const lines = [
    'boalbasaur.com — ' + kind,
    '',
    body,
    '',
    'From: ' + (contact || 'no contact given'),
  ];

  const response = await fetch(
    TELEGRAM_API + '/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        // No parse_mode. The text is whatever a stranger typed, and in Markdown
        // or HTML mode a stray bracket is enough for Telegram to reject the
        // whole message as malformed.
        text: lines.join('\n'),
        disable_web_page_preview: true,
      }),
    }
  );

  if (!response.ok) {
    // Telegram's own reason stays here, in the logs. The page is told the send
    // failed and nothing else: it cannot act on the difference, and the reply
    // is one a stranger can read.
    console.error('telegram sendMessage failed', response.status, await response.text());
    return json(502, { ok: false, error: 'upstream' });
  }

  return json(200, { ok: true });
}

// Anything that is not a string becomes one, and nothing arrives longer than it
// should. Trimmed, because a box holding only spaces is an empty box.
function text(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}
