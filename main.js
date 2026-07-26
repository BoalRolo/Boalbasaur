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

    function open(trigger) {
      var card = trigger.closest('.card');
      var source = document.getElementById(trigger.getAttribute('data-doc-for'));
      var title = card && card.querySelector('.card__title');
      if (!source) return;

      window.clearTimeout(closeTimer);
      lastFocused = trigger;

      titleEl.textContent = title ? title.textContent : '';
      bodyEl.innerHTML = source.innerHTML;

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

      closeTimer = window.setTimeout(function () {
        overlay.hidden = true;
        panel.hidden = true;
        bodyEl.innerHTML = '';
        titleEl.textContent = '';
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
  initAnchorScroll();
  initDocPanel();
})();
