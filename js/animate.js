// Motion layer: scroll-reveal for cards/sections, animated stat counters,
// animated bar-chart growth, and the auto-rotating category podium carousel.
// Everything here is additive — it never changes what data is shown, only how it enters.
//
// Reveal/counters/bars all REPLAY every time their element crosses into view,
// in either scroll direction — not just once on first load.

(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- */
  /* Bar-chart growth (used by charts.js + replayed on re-entry)       */
  /* ---------------------------------------------------------------- */

  function animateBarsIn(container) {
    const bars = container.querySelectorAll(".hbar-fill[data-pct]");
    if (!bars.length) return;
    const runToken = String(Date.now()) + Math.random();
    bars.forEach(b => { b.dataset.runToken = runToken; b.style.transition = "none"; b.style.width = "0%"; });
    // force reflow so the width:0 actually paints before we transition away from it
    void container.offsetWidth;

    function grow() {
      bars.forEach((b, i) => {
        if (b.dataset.runToken !== runToken) return;
        b.style.transition = `width 900ms cubic-bezier(.16,.8,.24,1) ${Math.min(i * 45, 500)}ms`;
        b.style.width = b.dataset.pct + "%";
      });
    }
    requestAnimationFrame(grow);
    // Safety net: if rAF is stalled (backgrounded tab, etc.) the bars must
    // still reach their target width — same rationale as the reveal system.
    window.setTimeout(grow, 260);
  }

  /* ---------------------------------------------------------------- */
  /* Scroll reveal — replays every time an element enters/leaves view  */
  /* ---------------------------------------------------------------- */

  function initScrollReveal() {
    const selector = [
      ".section-head", ".toolbar", ".table-wrap", ".chart-card",
      ".stat-tile", ".fecha-card", ".entity-card", ".rule-item",
      ".penalty-box", "#federacion .card", "#reglamento .card",
    ].join(", ");

    const els = document.querySelectorAll(selector);
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      els.forEach(el => el.classList.add("reveal", "in-view"));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const el = entry.target;
        if (entry.isIntersecting) {
          const wasIn = el.classList.contains("in-view");
          el.classList.add("in-view");
          if (!wasIn && el.querySelector(".hbar-fill[data-pct]")) animateBarsIn(el);
        } else {
          el.classList.remove("in-view");
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    els.forEach(el => { el.classList.add("reveal"); io.observe(el); });

    // Safety net: an environment that stalls IntersectionObserver callbacks
    // (backgrounded tab, etc.) must never leave content stuck invisible.
    window.setTimeout(() => {
      document.querySelectorAll(".reveal:not(.in-view)").forEach(el => el.classList.add("in-view"));
    }, 2500);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        document.querySelectorAll(".reveal:not(.in-view)").forEach(el => el.classList.add("in-view"));
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* Stat tile counters — replay every time the tile re-enters view    */
  /* ---------------------------------------------------------------- */

  function animateCount(el, target, formatter, token) {
    if (prefersReducedMotion) { el.textContent = formatter(target); return; }
    const duration = 900;
    const start = performance.now();
    function tick(now) {
      if (el.dataset.animToken !== token) return; // superseded by a newer run
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatter(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function initStatCounters() {
    const tiles = document.querySelectorAll(".stat-tile .stat-value[data-target]");
    if (!tiles.length) return;
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      tiles.forEach(el => {
        const fmt = el.dataset.suffix ? (n) => n.toLocaleString("es-CL") + el.dataset.suffix : (n) => n.toLocaleString("es-CL");
        el.textContent = fmt(Number(el.dataset.target));
      });
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = Number(el.dataset.target);
        const fmt = el.dataset.suffix
          ? (n) => n.toLocaleString("es-CL") + el.dataset.suffix
          : (n) => n.toLocaleString("es-CL");
        const token = String(Date.now()) + Math.random();
        el.dataset.animToken = token;
        animateCount(el, target, fmt, token);
      });
    }, { threshold: 0.4 });
    tiles.forEach(el => io.observe(el));

    // Safety net, same rationale as initScrollReveal.
    window.setTimeout(() => {
      tiles.forEach(el => {
        if (el.dataset.animToken) return;
        const fmt = el.dataset.suffix ? (n) => n.toLocaleString("es-CL") + el.dataset.suffix : (n) => n.toLocaleString("es-CL");
        el.textContent = fmt(Number(el.dataset.target));
      });
    }, 2500);
  }

  /* ---------------------------------------------------------------- */
  /* Hero podium carousel (category-only — see app.js heroSlides)      */
  /* ---------------------------------------------------------------- */

  function initHeroCarousel(getSlides, renderSlide) {
    const podiumEl = document.getElementById("heroPodium");
    const labelEl = document.getElementById("heroPodiumLabel");
    const dotsEl = document.getElementById("heroCarouselDots");
    const cardEl = document.querySelector(".hero-card");
    if (!podiumEl || !labelEl || !dotsEl) return;

    const slides = getSlides();
    if (!slides.length) return;

    dotsEl.innerHTML = slides.map((s, i) =>
      `<button class="carousel-dot ${i === 0 ? "active" : ""}" data-i="${i}" aria-label="${s.label}"></button>`
    ).join("");

    let idx = 0;
    let timer = null;
    const INTERVAL = 4200;

    function paint(i) {
      idx = i;
      labelEl.textContent = slides[i].label;
      podiumEl.innerHTML = renderSlide(slides[i]);
      dotsEl.querySelectorAll(".carousel-dot").forEach((d, di) => d.classList.toggle("active", di === i));
    }

    function goTo(i) {
      if (prefersReducedMotion) { paint(i); return; }
      podiumEl.classList.add("switching");
      window.setTimeout(() => {
        paint(i);
        podiumEl.classList.remove("switching");
      }, 220);
    }

    function next() { goTo((idx + 1) % slides.length); }

    function start() {
      if (prefersReducedMotion || slides.length < 2) return;
      stop();
      timer = window.setInterval(next, INTERVAL);
    }
    function stop() { if (timer) { window.clearInterval(timer); timer = null; } }

    paint(0);
    start();

    if (cardEl) {
      cardEl.addEventListener("mouseenter", stop);
      cardEl.addEventListener("mouseleave", start);
    }
    dotsEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".carousel-dot");
      if (!btn) return;
      stop();
      goTo(Number(btn.dataset.i));
      start();
    });
  }

  window.RankingMotion = { initScrollReveal, initStatCounters, initHeroCarousel, animateBarsIn };
})();
