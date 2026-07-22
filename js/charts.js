// Lightweight horizontal bar chart renderer (no external dependencies).
// Follows the studio's mark spec: rounded data-end bars, single baseline,
// legend only when >1 series, value at the tip, hover tooltip.

function fmtNum(n) {
  return new Intl.NumberFormat("es-CL").format(n);
}

function ensureTooltip() {
  let tt = document.getElementById("chart-tooltip");
  if (!tt) {
    tt = document.createElement("div");
    tt.id = "chart-tooltip";
    tt.className = "chart-tooltip";
    document.body.appendChild(tt);
  }
  return tt;
}

function attachTooltip(el, html) {
  const tt = ensureTooltip();
  el.addEventListener("mouseenter", () => { tt.innerHTML = html; tt.classList.add("show"); });
  el.addEventListener("mousemove", (e) => {
    const pad = 14;
    let x = e.clientX + pad, y = e.clientY + pad;
    tt.style.left = x + "px";
    tt.style.top = y + "px";
  });
  el.addEventListener("mouseleave", () => tt.classList.remove("show"));
}

/**
 * renderHBarChart({ el, title, subtitle, data: [{label, value, color, sub}], valueFmt, legend })
 */
function renderHBarChart(opts) {
  const { el, title, subtitle, data, valueFmt, legend } = opts;
  const max = Math.max(...data.map(d => d.value), 1);
  const rows = data.map(d => {
    const pct = Math.max((d.value / max) * 100, 2);
    return `
      <div class="hbar-row" data-row>
        <div class="hbar-label" title="${escapeHtml(d.label)}">${escapeHtml(d.label)}</div>
        <div class="hbar-track">
          <div class="hbar-fill" data-pct="${pct}" style="width:0%; background:${d.color || "var(--seq-450)"}"></div>
        </div>
        <div class="hbar-value">${valueFmt ? valueFmt(d.value) : fmtNum(d.value)}</div>
      </div>`;
  }).join("");

  el.innerHTML = `
    ${title ? `<div class="chart-title">${title}</div>` : ""}
    ${subtitle ? `<div class="chart-subtitle">${subtitle}</div>` : ""}
    <div class="hbar-list" style="margin-top:${title ? "14px" : "0"};">${rows || '<div class="text-muted" style="font-size:13px; padding:10px 0;">Sin datos para esta selección todavía.</div>'}</div>
    ${legend ? `<div class="chart-legend">${legend.map(l => `<div class="item"><span class="swatch" style="background:${l.color}"></span>${escapeHtml(l.label)}</div>`).join("")}</div>` : ""}
  `;

  const rowEls = el.querySelectorAll("[data-row]");
  rowEls.forEach((rowEl, i) => {
    const d = data[i];
    attachTooltip(rowEl, `<strong>${escapeHtml(d.label)}</strong><br>${d.sub ? d.sub + "<br>" : ""}${valueFmt ? valueFmt(d.value) : fmtNum(d.value)} pts`);
  });

  // Grow bars in on every render (initial load + every filter change), not
  // just on first scroll — re-entering the viewport later replays it too
  // (see RankingMotion.initScrollReveal, which calls animateBarsIn directly).
  if (window.RankingMotion) window.RankingMotion.animateBarsIn(el);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}
