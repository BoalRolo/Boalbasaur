# boalbasaur

Personal portfolio site. Static HTML/CSS/JS — no build step, no dependencies.

```
index.html    markup + project content
styles.css    all styling
main.js       scroll reveal, parallax, mascot tilt, doc panel
assets/       images used by the site
design/       the Claude Design source this was built from (reference only)
```

## Running it

Open `index.html` directly, or serve the folder:

```sh
python3 -m http.server 8000
```

Deploys as-is to GitHub Pages, Netlify, Vercel, or any static host.

## Editing content

Each project is one `<article class="card">` in `index.html`. A card holds:

- the visible bits — title, tagline, tech pills
- `href` on `.card__half--left` — where "Check website" goes
- a `.doc-source` block — the five sections shown in the slide-out doc panel

To add a project, copy a whole `<article>`, bump `--card-index` (it staggers the
reveal), and give the new `.doc-source` a unique `id` matching the `data-doc-for`
on its Doc button.

### Adding a screenshot

Cards ship with a placeholder. Replace the `<div class="shot shot--empty">…</div>`
with:

```html
<img class="shot" src="assets/pixel-pantry.png" alt="Screenshot of Pixel Pantry" loading="lazy">
```

The `.shot` class already handles `object-fit: cover` inside the 260px frame.

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
- **Doc panel.** Content is read from the card's hidden `.doc-source`. Traps focus,
  closes on Escape / overlay click, restores focus to the button that opened it.

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

`design/build-logo.py`, from `design/uploads/logo-source.png`:

- `assets/logo.png` — the header mark, keyed off its white background.
- `assets/favicon.png` — the same mark padded into a 128×128 square for the tab.

The artwork is flat green on opaque white. The script solves the blend it was
drawn with (`alpha = (255 - pixel) / (255 - green)`) rather than keying the white
out on a threshold, which would leave a pale halo on every anti-aliased edge. The
gaps between the petals come out transparent, so the page shows through them.
