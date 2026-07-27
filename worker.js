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

  // The heading names which of the two screens it came from, the message sits
  // in a quote block so it is obvious where a stranger's words start and stop,
  // and the contact is <code> because Telegram makes that tap-to-copy, which is
  // the one thing you actually do with it.
  const lines = [
    '<b>' + esc(kind) + '</b>  ·  boalbasaur.com',
    '',
    '<blockquote>' + esc(body) + '</blockquote>',
    '',
    contact ? '\u{1F464} <code>' + esc(contact) + '</code>' : '\u{1F464} <i>no contact given</i>',
  ];

  const response = await fetch(
    TELEGRAM_API + '/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        // HTML rather than Markdown, and every interpolated value goes through
        // esc() first. That ordering is the whole safety argument: in Markdown
        // an unpaired asterisk is enough for Telegram to reject the message,
        // and unescaped HTML lets whatever a stranger types decide how the rest
        // of it renders. Escaped, the only tags Telegram sees are the ones on
        // this side of the wire.
        parse_mode: 'HTML',
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

// The three characters Telegram's HTML mode reads as markup. Everything that
// came off the wire goes through here before it is put in the message, kind
// included — that field is as much a stranger's input as the message is.
function esc(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
