/* boalbasaur — page behaviour
   Implementation of design/Boalbasaur.dc.html */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* --- Scroll reveal ----------------------------------------------------
     One-shot: elements fade up the first time they come within 90% of the
     viewport height, then stop being watched. */
  function initReveal() {
    var targets = document.querySelectorAll('[data-reveal]');

    Array.prototype.forEach.call(targets, function (el) {
      var delay = el.getAttribute('data-reveal-delay');
      if (delay) el.style.setProperty('--reveal-delay', delay);
    });

    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(targets, function (el) {
        el.classList.add('is-revealed');
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px' });

    Array.prototype.forEach.call(targets, function (el) {
      observer.observe(el);
    });
  }

  /* --- Scroll-driven decoration -----------------------------------------
     Blobs drift at their own rate off --scroll-y. Leaves fall toward the foot
     of the page, each over its own slice of the scroll range so they let go
     one after another instead of in lockstep, and land on top of the ones
     already resting down there. */
  function initScrollMotion() {
    if (reduceMotion.matches) return;

    var page = document.getElementById('page');
    var leaves = Array.prototype.map.call(
      document.querySelectorAll('.leaf[data-fall]'),
      function (el) {
        var rot = parseFloat(el.style.getPropertyValue('--rot')) || 0;
        var rest = parseFloat(el.getAttribute('data-rest'));
        var turns = parseFloat(el.getAttribute('data-turns')) || 0;
        return {
          el: el,
          start: parseFloat(el.getAttribute('data-start')) || 0,
          land: parseFloat(el.getAttribute('data-land')) || 0,
          drift: parseFloat(el.getAttribute('data-drift')) || 22,
          rot: rot,
          // Total turn on the way down, landed on data-rest so the leaf comes
          // to rest flat like the ones already on the ground.
          spin: (isNaN(rest) ? 150 : rest - rot) + 360 * turns,
          travel: 0
        };
      }
    );

    var frame = 0;

    // How far each leaf has to fall to reach its resting place. Depends on the
    // page height, so it is remeasured whenever that can have changed.
    function measure() {
      if (!page) return;
      var pageHeight = page.offsetHeight;
      leaves.forEach(function (leaf) {
        leaf.travel = Math.max(
          0,
          pageHeight - leaf.land - leaf.el.offsetHeight - leaf.el.offsetTop
        );
      });
    }

    function update() {
      var y = window.scrollY || window.pageYOffset || 0;
      root.style.setProperty('--scroll-y', String(y));

      var scrollable = document.documentElement.scrollHeight - window.innerHeight;
      var progress = scrollable > 0 ? Math.min(Math.max(y / scrollable, 0), 1) : 0;

      leaves.forEach(function (leaf, i) {
        var span = 1 - leaf.start;
        var t = span > 0 ? Math.min(Math.max((progress - leaf.start) / span, 0), 1) : 1;
        var eased = t * (0.55 + 0.45 * t);  // eases in, so it reads as gravity
        // Sways side to side on the way down. Damped to zero at both ends, so
        // the leaf leaves and lands on its own column instead of beside it.
        var sway = Math.sin(eased * Math.PI * (2 + (i % 3))) * leaf.drift * (1 - eased);

        leaf.el.style.transform =
          'translate(' + sway.toFixed(1) + 'px, ' + (eased * leaf.travel).toFixed(1) + 'px)' +
          ' rotate(' + (leaf.rot + eased * leaf.spin).toFixed(1) + 'deg)';
        // Settles into the same weight as the leaves already on the ground.
        leaf.el.style.opacity = (0.5 + eased * 0.12).toFixed(3);
      });
    }

    // Keyed on the frame handle rather than a boolean: a flag set before the
    // callback runs stays set forever if that frame is never delivered, and the
    // effect silently dies for the rest of the session.
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = 0;
        update();
      });
    }

    function remeasure() {
      measure();
      onScroll();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', remeasure, { passive: true });
    // Images and webfonts land after DOMContentLoaded and change the page height.
    window.addEventListener('load', remeasure);

    measure();
    update();
  }

  /* --- Mascot look-at ----------------------------------------------------
     The mascot follows the pointer: the head leans toward it, and the face
     pans inside its frame so it reads as looking that way. Both saturate
     once the pointer is REACH px away from the mascot's centre. */
  function initMascotLookAt() {
    var mascot = document.querySelector('.mascot');
    if (!mascot) return;
    if (reduceMotion.matches || !window.matchMedia('(hover: hover)').matches) return;

    var MAX_TILT = 12;  // degrees
    var MAX_SHIFT = 6;  // px — beyond this the face starts clipping on the disc
    var REACH = 340;    // px

    var pointer = null;
    var frame = 0;

    function clamp(n) { return Math.max(-1, Math.min(1, n)); }

    function apply(nx, ny) {
      root.style.setProperty('--mascot-tilt', (nx * MAX_TILT).toFixed(2));
      root.style.setProperty('--mascot-look-x', (nx * MAX_SHIFT).toFixed(2));
      root.style.setProperty('--mascot-look-y', (ny * MAX_SHIFT).toFixed(2));
    }

    function update() {
      if (!pointer) return;

      // Measured on .mascot rather than the frame: the frame's idle bounce is
      // a transform, which would make its rect wobble underneath us.
      var r = mascot.getBoundingClientRect();
      if (!r.width) return;

      apply(
        clamp((pointer.x - (r.left + r.width / 2)) / REACH),
        clamp((pointer.y - (r.top + r.height / 2)) / REACH)
      );
    }

    function schedule() {
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = 0;
        update();
      });
    }

    window.addEventListener('mousemove', function (e) {
      pointer = { x: e.clientX, y: e.clientY };
      schedule();
    }, { passive: true });

    // Scrolling moves the mascot, not the pointer, but the angle still changes.
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    // Settle back to neutral when the pointer leaves the window.
    document.addEventListener('mouseleave', function () {
      pointer = null;
      apply(0, 0);
    });
  }

  /* --- Mascot speech bubble ----------------------------------------------
     Cycles through idle lines while the console is shut, and says something
     specific the moment a control is used. Returns the handle the console
     drives it with, or null when there is no bubble on the page. */
  function initMascotNote() {
    var note = document.getElementById('mascot-note');
    var source = document.getElementById('mascot-idle-notes');
    if (!note) return null;

    var IDLE_MS = 6000;
    var SWAP_MS = 180;   // matches the .is-swapping transition

    var lines = source
      ? Array.prototype.map.call(source.content.querySelectorAll('li'), function (li) {
          return li.textContent.trim();
        })
      : [];
    var at = 0;
    var cycle = 0;
    var swap = 0;

    function set(text) {
      if (note.textContent === text) return;

      window.clearTimeout(swap);
      if (reduceMotion.matches) {
        note.textContent = text;
        return;
      }
      // Out, swap, in — so the bubble never shows two lines cross-fading and
      // never resizes while a line is still readable.
      note.classList.add('is-swapping');
      swap = window.setTimeout(function () {
        note.textContent = text;
        note.classList.remove('is-swapping');
      }, SWAP_MS);
    }

    function stop() {
      window.clearInterval(cycle);
      cycle = 0;
    }

    // Rotation only runs while the console is shut. Left running, the bubble
    // would change out from under someone part-way through reading the menu.
    function resume() {
      stop();
      if (lines.length < 2) return;
      cycle = window.setInterval(function () {
        at = (at + 1) % lines.length;
        set(lines[at]);
      }, IDLE_MS);
    }

    // The markup's own text is line 0; starting there means no jump on load.
    if (lines.length) {
      at = Math.max(0, lines.indexOf(note.textContent.trim()));
    }
    resume();

    return {
      // Says one specific line and holds it there.
      say: function (text) {
        if (!text) return;
        stop();
        set(text);
      },
      resume: function () {
        if (lines.length) set(lines[at]);
        resume();
      }
    };
  }

  /* --- Retro console -----------------------------------------------------
     Clicking the mascot shakes it, then opens a handheld-console dialogue box
     beside it. Whichever view is showing types its own text out a character at
     a time; a click or a keypress mid-crawl fills it in, the way those consoles
     always let you skip ahead. */
  function initRetroConsole(note) {
    var button = document.getElementById('mascot-button');
    var panel = document.getElementById('retro-panel');
    if (!button || !panel) return;

    // Each control carries its own line in data-note; the mascot just reads it
    // out. Nothing here needs to know what any of them say.
    function speak(el) {
      if (note && el) note.say(el.getAttribute('data-note'));
    }

    var SHAKE_MS = 420;   // the pixel-shake keyframes, plus a frame to settle
    var CHAR_MS = 18;
    var SENT_MS = 1500;

    var tilt = document.querySelector('.mascot__tilt');
    var rows = [];
    var views = {};
    var current = 'menu';
    var index = 0;
    var openTimer = 0;
    var sentTimer = 0;
    var typeTimer = 0;
    var fillIn = null;

    Array.prototype.forEach.call(panel.querySelectorAll('.retro__view'), function (el) {
      views[el.getAttribute('data-view')] = el;
    });

    // The copy lives in index.html. Read it off the markup once, so the script
    // can blank each element and replay it without owning any of the words.
    Array.prototype.forEach.call(panel.querySelectorAll('[data-type]'), function (el) {
      el.setAttribute('data-text', el.textContent.trim());
    });

    function pending(root) {
      return Array.prototype.filter.call(
        root.querySelectorAll('[data-type]'),
        function (el) { return !el.closest('[hidden]'); }
      );
    }

    // Snaps whatever is mid-crawl to its full text. Safe to call at any time.
    function settle() {
      if (typeTimer) cancelAnimationFrame(typeTimer);
      typeTimer = 0;
      if (!fillIn) return;
      fillIn();
      fillIn = null;
    }

    function type(root) {
      settle();

      var targets = pending(root);
      if (!targets.length) return;

      fillIn = function () {
        targets.forEach(function (el) {
          el.textContent = el.getAttribute('data-text');
          el.classList.remove('is-typing');
        });
      };

      if (reduceMotion.matches) {
        settle();
        return;
      }

      // Blank them all up front, so a later line never flashes at full length
      // while an earlier one is still going.
      targets.forEach(function (el) { el.textContent = ''; });

      var total = targets.reduce(function (n, el) {
        return n + el.getAttribute('data-text').length;
      }, 0);
      // null, not 0: a zero timestamp is a legitimate start and `!started`
      // would read it as "not started yet" and slip the clock by a frame.
      var started = null;

      // Driven off rAF and elapsed time, not one timeout per character. A
      // backgrounded tab clamps timeouts to one a second, which would leave the
      // crawl dribbling out a letter at a time for a minute with nobody
      // watching, then finishing at the wrong speed on return. rAF stops dead
      // instead, and seeking by elapsed time resumes exactly where it should.
      function frame(now) {
        if (started === null) started = now;

        var want = Math.floor((now - started) / CHAR_MS);
        var used = 0;
        var frontier = -1;

        targets.forEach(function (el, i) {
          var text = el.getAttribute('data-text');
          var take = Math.max(0, Math.min(text.length, want - used));
          el.textContent = text.slice(0, take);
          if (frontier === -1 && take < text.length) frontier = i;
          used += text.length;
        });

        // The cursor belongs on the first line that is not finished yet.
        targets.forEach(function (el, i) {
          el.classList.toggle('is-typing', i === frontier);
        });

        if (want >= total) {
          typeTimer = 0;
          fillIn = null;
          return;
        }
        typeTimer = requestAnimationFrame(frame);
      }

      typeTimer = requestAnimationFrame(frame);
    }

    function paint() {
      rows.forEach(function (row, i) {
        row.classList.toggle('is-selected', i === index);
      });
    }

    // State first, focus second. Driving the caret off the focus event alone
    // leaves it stuck whenever focus cannot move — a background window, or a
    // browser that declines the request — and the menu stops responding to the
    // arrow keys with no way to tell why.
    function move(to) {
      if (!rows.length) return;
      index = (to + rows.length) % rows.length;
      paint();
      rows[index].focus();
    }

    function show(name) {
      var view = views[name];
      if (!view) return;

      window.clearTimeout(sentTimer);
      current = name;

      Object.keys(views).forEach(function (key) {
        views[key].hidden = key !== name;

        // Reset the send state, so re-entering a view starts on its form.
        var form = views[key].querySelector('[data-form]');
        var sent = views[key].querySelector('[data-sent]');
        if (form && sent) {
          form.hidden = false;
          sent.hidden = true;
        }
      });

      if (name === 'menu') {
        index = 0;
        paint();
      }
      type(view);
    }

    function open() {
      window.clearTimeout(openTimer);
      // Greets on the click, not when the panel lands — the shake is the
      // mascot reacting, and it should be talking through it.
      speak(button);
      if (tilt && !reduceMotion.matches) tilt.classList.add('is-shaking');

      openTimer = window.setTimeout(function () {
        if (tilt) tilt.classList.remove('is-shaking');
        panel.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        show('menu');
        panel.focus();
      }, reduceMotion.matches ? 0 : SHAKE_MS);
    }

    function close() {
      window.clearTimeout(openTimer);
      window.clearTimeout(sentTimer);
      settle();
      if (tilt) tilt.classList.remove('is-shaking');
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      if (note) note.resume();   // back to idle chatter
    }

    // A view's boxes are addressed by data-field. Both are .retro__input, so
    // asking for the class would hand back whichever sits first in the markup.
    function value(view, name) {
      var field = view.querySelector('[data-field="' + name + '"]');
      return field ? field.value.trim() : '';
    }

    function clear(view) {
      Array.prototype.forEach.call(view.querySelectorAll('[data-field]'), function (field) {
        field.value = '';
      });
    }

    // Shows one of a view's outcome lines and types it. The words are all in
    // index.html; this only picks which of them is on screen.
    function status(view, name) {
      var sent = view.querySelector('[data-sent]');
      if (!sent) return;

      var lines = sent.querySelectorAll('[data-status]');
      if (!lines.length) {
        type(sent);
        return;
      }

      Array.prototype.forEach.call(lines, function (line) {
        line.hidden = line.getAttribute('data-status') !== name;
      });
      // pending() skips anything inside a [hidden], so the crawl only ever sees
      // the line that was just chosen.
      type(sent);
    }

    // The mail app route: everything the visitor typed, handed to their own
    // client with nothing sent on their behalf. The alternative, for a site
    // with no server behind it, was a button claiming delivery while dropping
    // the message on the floor.
    function toMail(view, trigger) {
      var to = panel.getAttribute('data-mail');
      if (!to) return;

      var body = value(view, 'body');
      var header = value(view, 'header');
      var contact = value(view, 'contact');
      // The typed subject wins; the trigger's is the fallback, so a mail app
      // never opens with a blank subject line.
      var subject = value(view, 'subject') ||
        (trigger ? trigger.getAttribute('data-mail-subject') || '' : '');

      // A mailto carries a subject and a body and nothing else, so the header
      // opens the body. The contact goes at its foot instead: Reply-To exists
      // in the spec and mail clients drop it, and putting it up top would push
      // what they came to say below the fold.
      if (header) body = header + '\n\n' + body;
      if (contact) body += '\n\n' + 'Reply to: ' + contact;

      window.location.href = 'mailto:' + to +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
    }

    function finish(view) {
      sentTimer = window.setTimeout(function () {
        clear(view);
        show('menu');
      }, SENT_MS);
    }

    function send(view, trigger) {
      var form = view.querySelector('[data-form]');
      var sent = view.querySelector('[data-sent]');
      if (!form || !sent) return;

      var mode = trigger ? trigger.getAttribute('data-send') : 'mail';
      var body = value(view, 'body');

      // Nothing to send is not a failure, it is a message that is not written
      // yet. Put the cursor back in the box rather than opening a blank email.
      if (!body) {
        var field = view.querySelector('[data-field="body"]');
        if (field) field.focus();
        return;
      }

      form.hidden = true;
      sent.hidden = false;

      if (mode !== 'post') {
        toMail(view, trigger);
        status(view, 'mail');
        finish(view);
        return;
      }

      // POST route: the site's own endpoint, which passes it to Telegram. The
      // credentials for that live as Worker secrets and never reach this file.
      status(view, 'sending');

      post({
        kind: trigger ? trigger.getAttribute('data-mail-subject') || '' : '',
        body: body,
        contact: value(view, 'contact')
      }).then(function (ok) {
        if (ok) {
          status(view, 'ok');
        } else {
          // The endpoint is down, or was never configured. Rather than lose
          // what they wrote, hand it to the mail app and say so.
          toMail(view, trigger);
          status(view, 'mail');
        }
        finish(view);
      });
    }

    // Resolves true or false and never rejects, so one failing send cannot
    // leave the panel stuck on SENDING with no way forward.
    function post(payload) {
      if (typeof window.fetch !== 'function') return Promise.resolve(false);

      return window.fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.ok;
      }).catch(function () {
        return false;
      });
    }

    rows = Array.prototype.slice.call(views.menu.querySelectorAll('.retro__row'));
    rows.forEach(function (row, i) {
      // Keeps the caret on whichever row the keyboard is actually on, whether
      // it got there by arrow key or by Tab.
      row.addEventListener('focus', function () {
        index = i;
        paint();
      });
    });

    button.addEventListener('click', function () {
      if (panel.hidden) open(); else close();
    });

    panel.addEventListener('click', function (e) {
      // Skip the crawl, then still do what was clicked — swallowing the click
      // outright would read as the menu ignoring you.
      if (typeTimer) settle();

      var goto = e.target.closest('[data-goto]');
      if (goto) {
        speak(goto);
        show(goto.getAttribute('data-goto'));
        return;
      }

      var sender = e.target.closest('[data-send]');
      if (sender) {
        speak(sender);
        send(views[current], sender);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (panel.hidden) return;

      var inField = !!(e.target.closest && e.target.closest('textarea, input'));

      if (e.key === 'Escape') {
        e.preventDefault();
        settle();
        if (current === 'menu') {
          close();
          button.focus();
        } else {
          // Escape out of a view is the same move as BACK, so it borrows that
          // view's line rather than leaving the bubble on the old one.
          speak(views[current].querySelector('[data-goto="menu"]'));
          show('menu');
        }
        return;
      }

      if (inField) return;
      if (typeTimer && !e.metaKey && !e.ctrlKey && !e.altKey) settle();
      if (current !== 'menu' || !rows.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        move(index + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        move(index - 1);
      } else if (e.key === 'Enter') {
        // A focused row fires its own click; only stand in when focus is
        // elsewhere, or the row would be activated twice.
        if (rows.indexOf(e.target) !== -1) return;
        e.preventDefault();
        rows[index].click();
      }
    });
  }

  /* --- In-page anchors ---------------------------------------------------
     Eases to the target instead of snapping, and leaves the URL clean: with
     #projects stuck in the address bar, a reload drops you back at the projects
     section rather than the top of the page. */
  function initAnchorScroll() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link || link.getAttribute('href') === '#') return;

      var target = document.getElementById(link.getAttribute('href').slice(1));
      if (!target) return;

      e.preventDefault();

      // scrollTo, not target.scrollIntoView: scrollIntoView walks up and scrolls
      // every scrollable ancestor, which is how an anchor jump used to leave the
      // page wrapper itself scrolled with no way to scroll it back. This can
      // only ever move the document.
      var margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      var furthest = document.documentElement.scrollHeight - window.innerHeight;
      var top = target.getBoundingClientRect().top + window.scrollY - margin;

      window.scrollTo({
        top: Math.max(0, Math.min(top, furthest)),
        behavior: reduceMotion.matches ? 'auto' : 'smooth'
      });
      history.replaceState(null, '', location.pathname + location.search);
    });
  }

  /* --- Scroll lock -------------------------------------------------------
     Shared by everything that covers the page. Pads the body by the width of
     the scrollbar it is about to remove, so the layout underneath does not
     jump sideways as the overlay comes up. */
  function lockScroll(locked) {
    if (locked) {
      var barWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = barWidth > 0 ? barWidth + 'px' : '';
      document.body.classList.add('is-locked');
    } else {
      document.body.classList.remove('is-locked');
      document.body.style.paddingRight = '';
    }
  }

  /* --- "You already there" ------------------------------------------------
     The one card whose website is this website. Its links do not go anywhere:
     they bring up a full-screen console message instead, which types itself
     out and waits to be dismissed. The href stays real, so with no script the
     link still just works. */
  function initArcade() {
    var screen = document.getElementById('arcade');
    var line = document.getElementById('arcade-line');
    var page = document.getElementById('page');
    if (!screen || !line || !page) return;

    var CHAR_MS = 62;
    // The copy lives in index.html, same as the console's. Read once, then the
    // element is free to be blanked and replayed.
    var text = line.textContent.trim();
    var lastFocused = null;
    var frame = 0;

    function settle() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      line.textContent = text;
      line.classList.remove('is-typing');
    }

    // Driven off elapsed time rather than one timeout per character, for the
    // same reason as the console: a backgrounded tab clamps timeouts and the
    // crawl would finish at the wrong speed.
    function type() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;

      if (reduceMotion.matches) {
        settle();
        return;
      }

      line.textContent = '';
      line.classList.add('is-typing');

      var started = null;
      frame = requestAnimationFrame(function step(now) {
        if (started === null) started = now;
        var take = Math.floor((now - started) / CHAR_MS);
        line.textContent = text.slice(0, Math.min(take, text.length));
        if (take >= text.length) {
          frame = 0;
          line.classList.remove('is-typing');
          return;
        }
        frame = requestAnimationFrame(step);
      });
    }

    function open(trigger) {
      lastFocused = trigger;
      screen.hidden = false;
      page.setAttribute('inert', '');
      lockScroll(true);
      screen.focus();
      type();
    }

    function close() {
      if (screen.hidden) return;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      screen.hidden = true;
      page.removeAttribute('inert');
      lockScroll(false);
      if (lastFocused) {
        lastFocused.focus();
        lastFocused = null;
      }
    }

    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-already-here]');
      if (!trigger) return;
      e.preventDefault();
      open(trigger);
    });

    // Bound to the screen rather than the document: on the document, the very
    // click that opened it would bubble up and close it in the same tick.
    screen.addEventListener('click', function () {
      // Mid-crawl, the first click fills the line in rather than dismissing —
      // the way those consoles always let you skip ahead.
      if (frame) settle(); else close();
    });

    document.addEventListener('keydown', function (e) {
      if (screen.hidden) return;
      e.preventDefault();
      if (frame) settle(); else close();
    });
  }

  /* --- Project doc panel ------------------------------------------------- */
  function initDocPanel() {
    var overlay = document.getElementById('doc-overlay');
    var panel = document.getElementById('doc-panel');
    var page = document.getElementById('page');
    var titleEl = document.getElementById('doc-panel-title');
    var bodyEl = document.getElementById('doc-panel-body');
    var closeButton = document.getElementById('doc-close');
    if (!overlay || !panel || !page) return;

    var CLOSE_MS = 320;
    var lastFocused = null;
    var closeTimer = null;

    function open(trigger) {
      var card = trigger.closest('.card');
      var source = document.getElementById(trigger.getAttribute('data-doc-for'));
      var title = card && card.querySelector('.card__title');
      if (!source) return;

      window.clearTimeout(closeTimer);
      lastFocused = trigger;

      titleEl.textContent = title ? title.textContent : '';
      bodyEl.innerHTML = source.innerHTML;

      // Each project can dress the panel in its own design. The doc source
      // names a skin in data-doc-theme; the stylesheet has the rules under
      // .doc-panel[data-doc-theme="..."]. No theme falls back to the plain one.
      var theme = source.getAttribute('data-doc-theme');
      if (theme) panel.setAttribute('data-doc-theme', theme);
      else panel.removeAttribute('data-doc-theme');

      overlay.hidden = false;
      panel.hidden = false;
      page.setAttribute('inert', '');
      lockScroll(true);

      // Two frames so the browser paints the closed state before animating.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          overlay.classList.add('is-open');
          panel.classList.add('is-open');
          closeButton.focus();
        });
      });
    }

    function close() {
      if (panel.hidden) return;

      overlay.classList.remove('is-open');
      panel.classList.remove('is-open');
      page.removeAttribute('inert');
      lockScroll(false);

      if (lastFocused) {
        lastFocused.focus();
        lastFocused = null;
      }

      // Theme included: dropped on the way out with everything else, so the
      // panel keeps its skin for the whole slide rather than reverting to the
      // plain one part-way through it.
      closeTimer = window.setTimeout(function () {
        overlay.hidden = true;
        panel.hidden = true;
        bodyEl.innerHTML = '';
        titleEl.textContent = '';
        panel.removeAttribute('data-doc-theme');
      }, reduceMotion.matches ? 0 : CLOSE_MS);
    }

    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-doc-for]');
      if (trigger) {
        e.preventDefault();
        open(trigger);
      }
    });

    overlay.addEventListener('click', close);
    closeButton.addEventListener('click', close);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) close();
    });

    // Keep focus inside the panel while it is open.
    panel.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var focusable = panel.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  initReveal();
  initScrollMotion();
  initMascotLookAt();
  initRetroConsole(initMascotNote());
  initAnchorScroll();
  initDocPanel();
  initArcade();
})();
