# boalbasaur

Personal portfolio site. Static HTML/CSS/JS — no build step, no dependencies.

```
index.html    markup + project content
styles.css    all styling
main.js       scroll reveal, parallax, mascot tilt, doc panel, the console
worker.js     the one dynamic bit: /api/send, which relays to Telegram
assets/       images used by the site
design/       the Claude Design source this was built from (reference only)
```

## Cache busting

`index.html` links `styles.css?v=20` and `main.js?v=20`. **Bump both numbers when
you change either file.** With no build step there is nothing fingerprinting
these, and a browser holding an old `styles.css` will pair it with freshly
changed markup — the page comes out as unstyled content in the right shape,
which reads as broken CSS rather than a stale cache.

## Running it

Open `index.html` directly, or serve the folder:

```sh
python3 -m http.server 8000
```

Everything renders that way. The one thing that will not work is the console's
QUICK MESSAGE and SHARE IDEA, which post to `/api/send` — with no Worker
answering, they fall back to the mail app on their own. For the real thing:

```sh
npx wrangler dev      # local, with .dev.vars for the secrets
npx wrangler deploy
```

## The Telegram endpoint

`worker.js` is the only part of this site that is not a file. It claims one
path, `/api/send`, and hands every other request to the static assets.

The console's QUICK MESSAGE and SHARE IDEA post there, and it passes the text to
a Telegram bot. That indirection is the whole point: a bot token in the page is
a bot token everyone has, so the token and the chat id live as Worker secrets
and appear nowhere in this repo.

```sh
npx wrangler secret put TELEGRAM_BOT_TOKEN   # from @BotFather
npx wrangler secret put TELEGRAM_CHAT_ID     # your own chat with the bot
```

For `wrangler dev`, put the same two in `.dev.vars`, which `.gitignore` already
excludes. To find the chat id: message the bot once, then read
`https://api.telegram.org/bot<TOKEN>/getUpdates` and take `result[0].message.chat.id`.

With either secret missing the endpoint answers 503 rather than pretending, and
the page falls back to handing the message to the visitor's mail app. Same for a
network failure or a Telegram error, so nothing anyone types is ever dropped on
the floor.

What it checks before relaying: POST only, same-origin, a body that is not
empty, and caps of 2000 characters on the message and 200 on the contact. That
stops another site posting through a visitor's browser and stops the endpoint
being a place to dump megabytes into a phone. It does not stop someone with
`curl`, and nothing short of a challenge like Turnstile would — worth adding if
it ever attracts any.

Deploys to Cloudflare Workers. It would still deploy as-is to any static host,
with the two Telegram views falling back to the mail app.

## Editing content

Each project is one `<article class="card">` in `index.html`. A card holds:

- the visible bits — screenshot, title, tagline, tech pills
- `href` on `.card__half--left` — where "Visit" goes
- `.card__url` — the same address again, written out at the foot of the card
  (touch devices have no hover, so the screenshot halves reveal nothing there)
- a `.doc-source` block — the content of the slide-out doc panel

To add a project, copy a whole `<article>`, bump `--card-index` (it staggers the
reveal), and give the new `.doc-source` a unique `id` matching the `data-doc-for`
on its Doc button.

The grid sizes itself with `repeat(auto-fill, minmax(300px, 1fr))`, so a card is
the same width whether there is one project or six — new ones fill the row
instead of resizing the ones already there. Cards run newest first.

### The card as a console screen

A card is dressed as the mascot's console, using the same pieces rather than a
second retro look sitting beside the first: the `6px double` frame, the
`--retro-bg` / `--retro-ink` pair, `Press Start 2P` for the title and the screen
label, `Courier New` for the pills and the address, and the console's `▸` on the
address as it is pointed at. Corners are square, and the drop shadow is a hard
offset block with no blur.

Two things to know before changing it:

- **The title has a width budget.** `Press Start 2P` is one em per character, so
  a title is about `characters × font-size` wide. At 12px, 19 characters (about
  228px) is what fits the narrowest a card gets. Longer names wrap, which is
  survivable, or step the size down.
- **The press moves on `translate`, not `transform`.** `[data-reveal]` owns
  `transform` on these cards and transitions it over 0.7s, so a press written
  there would both fight the reveal and inherit its timing. `translate` and
  `box-shadow` are outside that transition list, so they snap with no duration,
  which is also what you want: easing is a light-and-physics idea and a sprite is
  simply in one frame or the next.

### Per-project doc themes

Every project gets its own doc design. A `.doc-source` names its skin:

```html
<div class="doc-source" id="my-project" data-doc-theme="my-project" hidden>
```

`main.js` copies that value onto the panel as `data-doc-theme` while the doc is
open (and drops it after the slide-out, so the panel never reverts to the plain
look mid-animation). The styling is one block in `styles.css` scoped to the
attribute:

```css
.doc-panel[data-doc-theme="my-project"] { … }
.doc-panel[data-doc-theme="my-project"] .doc-panel__body h4 { … }
```

Nothing is themed by default. A `.doc-source` with no `data-doc-theme` gets the
plain panel, which is the base styling under `--- Doc panel ---`.

There are a few shared primitives a doc can reach for, plain until a theme
restyles them: `.doc-lede` (the opening line), `.doc-list` (a bullet list),
`.doc-note` (the closing block), `.doc-gallery` / `.doc-shot` (screenshots with
captions, plus `.doc-shot--phone` which sets a portrait shot beside its caption),
and `.tech` (the pills, same as on the cards).
A theme is free to ignore them and style its own markup instead — the panel just
renders whatever HTML the `.doc-source` holds.

**The `boalbasaur` theme** is the reference one, and the point of it is that the
doc looks like the site it documents: the page's background wash, `Press Start
2P` headings with the console's selection caret, leaves for list bullets, the
mascot's console (`6px double`, bone, monospace) as the "What I learned" block,
and both leaf layers built from the *same* `.leaf` markup as the page, so they
inherit its shapes, tones and alternation with no rules of their own: `.doc-leaves`
scattered behind the text at low opacity, and `.doc-litter` piled at the foot.

The other two are each sampled from the app they document, and are the proof the
theming is real: same panel, same primitives, nothing in common with one another.
`junkybox` is near-black and Spotify green, with equalizer heading markers, a
live meter in the strip, vinyl bullets, and records bleeding off the edges.
`betweenus` is the map app's navy and teal, and borrows its furniture: the target
it marks the exact midpoint with for headings, its participant pins (teal, amber,
violet, in the app's own order) for bullets, the rings its search walks behind
the text, and three travel times pulling level in the strip. Both are drawn
entirely in CSS — gradients, borders and a border radius, no images.

Anything that animates needs a line in the `prefers-reduced-motion` block at the
foot of the stylesheet. Cancelling the animation is not always enough on its own:
`.doc-legs` is sized by the animation, so it has to be given its resting width
there as well, or it holds at the uneven state the animation starts from.

### Adding a screenshot

```html
<img class="shot" src="assets/my-project.png" alt="Screenshot of My Project" loading="lazy">
```

`.shot` handles `object-fit: cover` inside the 260px frame. Cards without one can
use the `<div class="shot shot--empty">` placeholder instead.

Screenshots *inside* a doc go in a `.doc-gallery` and are WebP — the Junkybox
shots came out 4-9x smaller than the same images as PNG (63KB for all three
against 462KB), which is worth having on a site that sells itself on being fast.
Always set `width` and `height` on them: the aspect ratio comes off those
attributes, so a shot holds its space from first paint instead of reflowing the
panel under whoever is reading it. `loading="lazy"` keeps them off the wire until
someone actually opens that doc.

Card shots are WebP for the same reason, and are cropped to the card frame's own
ratio (900&times;709, or 1.269) so `cover` has nothing left to throw away. A raw
capture rarely arrives at that ratio, so crop to whichever of its dimensions
fits and let the other be the constraint:

```sh
python3 -c "
from PIL import Image
im = Image.open('raw.png').convert('RGB')
w = round(im.height * 900 / 709)
im.crop((0, 0, w, im.height)).save('assets/my-project.webp', quality=88, method=6)"
```

A shot of a dark app wants `.doc-shot img` given a border and a mat in the theme,
or its edges dissolve into a dark panel. A portrait one wants `.doc-shot--phone`,
which sets it at 186px beside its caption instead of running it past the fold.

`assets/boalbasaur-platform.png` is this site's own hero, cropped to the card
frame's ratio so `cover` has nothing to throw away. To regenerate it after a
design change, serve the folder and:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --disable-gpu --hide-scrollbars --window-size=1200,1000 \
  --virtual-time-budget=5000 --screenshot=shot-raw.png http://127.0.0.1:8000/

python3 -c "
from PIL import Image
Image.open('shot-raw.png').convert('RGB').crop((0, 0, 1200, 945)) \
     .resize((900, 709), Image.LANCZOS).save('assets/boalbasaur-platform.png', optimize=True)"
```

## How the interactions work

- **Screenshot halves.** Left half is an `<a>` that opens the live site; right
  half is a `<button>` that opens the doc panel. The scrim and label are pure CSS
  `:hover` / `:focus-visible`, so they work by keyboard too. On touch devices
  (`@media (hover: none)`) both labels stay visible, since there is no hover.
- **Scroll reveal.** `IntersectionObserver` adds `.is-revealed` once per element.
- **In-page anchors.** "See projects" eases to the section instead of snapping,
  via native `window.scrollTo({ behavior: 'smooth' })` — native rather than a JS
  animation so user input cancels it, and `scrollTo` rather than `scrollIntoView`
  so it can only ever move the document (see the note on `overflow` below). It
  then clears the fragment from the URL: leaving `#projects` in the address bar
  means a reload drops you back at the projects section instead of the top.

### `overflow: clip`, not `overflow: hidden`

`.page`, `.mascot__frame` and `.card__shot` all clip decorative content that
overflows them, and all use `overflow: hidden; overflow: clip;` — the `hidden`
line is only a fallback for Safari below 16.

This matters. `overflow: hidden` still makes an element a **scroll container**:
the scrollbar is hidden, but the box can be scrolled programmatically. Anything
that scrolls an element into view — an anchor jump, focusing a control —
scrolls *every* scrollable ancestor. `.page` overflows by ~300px, so clicking
"See projects" left `.page` itself scrolled down by 294px. The document could
scroll back to the top, but `.page`'s own scroll had no scrollbar and no gesture
that reached it, so the header and the top of the headline were permanently
unreachable for the rest of the session.

`overflow: clip` clips identically without creating a scroll port. The invariant
worth keeping: **no element on the page should have both an `overflow` that
scrolls and content that overflows it.** A quick check in the console —

```js
[...document.querySelectorAll('*')].filter(el => {
  const o = getComputedStyle(el);
  return /(auto|scroll|hidden)/.test(o.overflowY + o.overflowX)
      && el.scrollHeight > el.clientHeight + 1;
});   // should be empty
```
- **Parallax.** `main.js` writes `--scroll-y` on `:root`; the blobs read it.
- **Falling leaves.** `.leaves` is a page-wide layer behind the content. Eight
  leaves start on the ground; the six marked `data-fall` drift down to join them
  as you scroll, tumbling and swaying on the way. Each covers its own slice of
  the scroll range, so they let go one after another. Per-leaf attributes:
  `data-start` where in the scroll range it lets go, `data-land` how far above
  the page's bottom edge it comes to rest (negative lands past it — `.page`
  clips the overflow), `data-rest` the angle it settles at, `data-turns` extra
  tumbles on the way, `data-drift` how far it sways.

  Three things together make the pile read as lying on the ground rather than
  hovering low in the background, and it needs all three:

  1. `.ground`, a soft band at the foot of the page — a surface to lie on.
  2. A tight landing band, everything within ~30px of the bottom edge and lying
     near horizontal (`data-rest` ≈ ±90°), overlapping, with several running
     past the edge so the layer reads as continuing out of frame.
  3. Landed leaves sit at opacity 0.62 against 0.5 in the air, so they read as
     nearer. `main.js` eases the falling ones into that as they come down.

  The sway is damped to zero at both ends so each leaf lands on its own column.
  Fall distances are measured from the page height, and remeasured on resize and
  on `load` (images and webfonts change it).
- **Mascot look-at.** The mascot follows the pointer in both axes: the head leans
  toward it (`--mascot-tilt`, ±12°) and the face pans inside its circular frame
  (`--mascot-look-x/y`, ±6px) so it reads as looking that way. Both saturate at
  340px from the mascot's centre and settle back to neutral when the pointer
  leaves the window. The 6px cap is what keeps the face off the edge of the disc
  — push it further and the mouth starts clipping at full diagonal pan.
- **Doc panel.** Content is read from the card's hidden `.doc-source`, and its
  design from that block's `data-doc-theme` (see above). Traps focus, closes on
  Escape / overlay click, restores focus to the button that opened it.
- **The mascot's console.** Every screen is a `.retro__view` in `index.html` and
  the script shows one at a time, typing its text out. All of the words live in
  the markup: the script reads each `[data-type]` element's own text once on
  load and replays it, so it owns none of them.

  A screen's boxes are addressed by `data-field` (`subject`, `header`, `body`,
  `contact`), never by the `.retro__input` class they share — a `querySelector`
  on the class returns whichever comes first, which is how a contact address
  ends up sent as the message body.

  `data-send` on a SEND button picks where it goes. `"mail"` composes a `mailto:`
  and hands it to the visitor's own client, with the typed subject winning over
  the button's `data-mail-subject` fallback, the header opening the body and the
  contact at its foot. `"post"` sends it to `/api/send` (see above), showing one
  of the `[data-status]` lines in that view's `[data-sent]` block as it goes:
  `sending`, then `ok`, or `mail` when the endpoint could not take it and the
  message went to the mail app instead.

Everything animated is disabled under `prefers-reduced-motion: reduce`.

## `design/`

The imported source from the Claude Design project *Boalbasaur Portfolio Website*
(`Boalbasaur.dc.html` plus its `image-slot.js` / `support.js` runtime). Kept for
reference when re-syncing the design — it is not loaded by the site.

<https://claude.ai/design/p/507b533c-d259-4280-95fe-f6103c51ae19>

Assets are generated from the uploads, not hand-edited. Rerun the scripts if the
source art changes; both are idempotent.

`design/build-mascot.py`, from `design/uploads/pasted-1785025054855-0.png`:

- `assets/mascot-hero.png` — a square canvas with the face centred inside a mint
  margin, so the hero disc shows the whole face with room around it while the
  image still over-covers the frame. `FACE_FRACTION` sets how big the face reads.
- `assets/mascot.png` — the original with a 3px black fringe cropped off its
  right edge (an artifact of the screenshot it came from). Nothing on the page
  references it since the header moved to the logo; it is kept as the cleaned
  base art.

`design/build-logo.py`, from `design/uploads/logo2.png`:

- `assets/logo.png` — the header mark, keyed off its white background.
- `assets/favicon.png` — the same mark padded into a 128×128 square for the tab.

The artwork is flat green on opaque white. The script solves the blend it was
drawn with (`alpha = (255 - pixel) / (255 - green)`) rather than keying the white
out on a threshold, which would leave a pale halo on every anti-aliased edge. The
gaps between the petals come out transparent, so the page shows through them.

Two wrinkles specific to this source. Its white is 253–254 rather than 255, so
the margin solves to alpha 2–4 instead of 0 — invisible, but enough to defeat the
trim, hence the 3% noise floor. And its own green (`#82AB3C`) is only 2.47:1 on
the page background, light for a brand mark, so `FILL` repaints it in the deeper
green the mark has always used; set `FILL = None` to keep the source's own.
