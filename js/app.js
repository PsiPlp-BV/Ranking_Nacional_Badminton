// Ranking Nacional de Bádminton Chile 2026 — app logic
// No external dependencies. Renders from PLAYERS / CLUBS (data.js) and
// CATEGORIES / MODALITIES / FECHAS / ... (meta.js).

(function () {
  "use strict";

  /* ---------------------------------------------------------------- */
  /* Indices & small helpers                                          */
  /* ---------------------------------------------------------------- */
  const playersById = {};
  const playersByName = {};
  PLAYERS.forEach(p => { playersById[p.id] = p; playersByName[p.name] = p; });

  const clubsByName = {};
  CLUBS.forEach(c => { clubsByName[c.name] = c; });

  const categoryById = {};
  CATEGORIES.forEach(c => { categoryById[c.id] = c; });

  const modalityById = {};
  MODALITIES.forEach(m => { modalityById[m.id] = m; });

  function initials(name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  function clubColor(clubName) {
    return (clubsByName[clubName] && clubsByName[clubName].color) || "#898781";
  }
  function clubShort(clubName) {
    return (clubsByName[clubName] && clubsByName[clubName].short) || clubName || "Independiente";
  }

  function avatarHtml(name, color, sizeClass) {
    return `<div class="avatar ${sizeClass}" style="background:${color}">${initials(name)}</div>`;
  }

  function normText(s) {
    return (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function medalPillsHtml(gold, silver, bronze) {
    return `
      <span class="medal-pill" style="color:var(--medal-gold)"><span class="swatch" style="background:var(--medal-gold)"></span>${gold}</span>
      <span class="medal-pill" style="color:var(--medal-silver)"><span class="swatch" style="background:var(--medal-silver)"></span>${silver}</span>
      <span class="medal-pill" style="color:var(--medal-bronze)"><span class="swatch" style="background:var(--medal-bronze)"></span>${bronze}</span>
    `;
  }

  function categoryBadgeHtml(catId) {
    const c = categoryById[catId];
    if (!c) return "";
    return `<span class="badge badge-outline" style="color:${c.color}">${c.label}</span>`;
  }

  function resultLabel(position, points) {
    if (position === 1) return { text: "Campeón/a", tone: "gold" };
    if (position === 2) return { text: "Subcampeón/a", tone: "silver" };
    if (position === 3) return { text: "3er lugar", tone: "bronze" };
    if (points === 50) return { text: "4° lugar", tone: "soft" };
    if (points === 30) return { text: "Cuartos de final (5°-8°)", tone: "soft" };
    return { text: "Participación", tone: "soft" };
  }

  function resultBadgeHtml(position, points) {
    const r = resultLabel(position, points);
    const styles = {
      gold: `background:var(--medal-gold-bg); color:var(--medal-gold);`,
      silver: `background:var(--medal-silver-bg); color:var(--medal-silver);`,
      bronze: `background:var(--medal-bronze-bg); color:var(--medal-bronze);`,
      soft: `background:var(--surface-2); color:var(--text-secondary);`,
    };
    return `<span class="badge" style="${styles[r.tone]}">${r.text}</span>`;
  }

  /* ---------------------------------------------------------------- */
  /* Ranking computation                                               */
  /* ---------------------------------------------------------------- */

  const FECHA_NUMS = FECHAS.map(f => f.numero);

  function emptyMetric() { return { points: 0, gold: 0, silver: 0, bronze: 0 }; }
  function addMetric(m, r) {
    m.points += r.points;
    if (r.position === 1) m.gold++;
    else if (r.position === 2) m.silver++;
    else if (r.position === 3) m.bronze++;
  }

  /**
   * Rows carry a full per-fecha breakdown (byFecha[1..3]) plus a season total,
   * independent of which fecha the UI currently has selected — the selector
   * only changes which slice is used to sort/rank.
   */
  function buildRankingRows(category, modalityId) {
    let rows = [];

    function makeRow(key, names, ids, clubs, rel) {
      const byFecha = {};
      FECHA_NUMS.forEach(n => {
        const relF = rel.filter(r => r.fecha === n);
        byFecha[n] = relF.length ? relF.reduce((m, r) => (addMetric(m, r), m), emptyMetric()) : null;
      });
      const total = rel.reduce((m, r) => (addMetric(m, r), m), emptyMetric());
      return { key, names, ids, clubs, byFecha, total };
    }

    if (modalityId === "general") {
      PLAYERS.forEach(p => {
        const rel = p.results.filter(r => r.category === category);
        if (!rel.length) return;
        rows.push(makeRow(p.id, [p.name], [p.id], [p.club], rel));
      });
    } else {
      const mod = modalityById[modalityId];
      if (mod && mod.doubles) {
        const seen = new Set();
        PLAYERS.forEach(p => {
          p.results.filter(r => r.category === category && r.modality === modalityId).forEach(r => {
            const pairKey = [p.name, r.partner].sort().join("||");
            if (seen.has(pairKey)) return;
            seen.add(pairKey);
            const partner = r.partner ? playersByName[r.partner] : null;
            const rel = [];
            PLAYERS.forEach(pp => {
              pp.results.filter(rr => rr.category === category && rr.modality === modalityId)
                .forEach(rr => { if ([pp.name, rr.partner].sort().join("||") === pairKey) rel.push(rr); });
            });
            // de-dupe (both partners contribute the identical result rows)
            const uniqRel = [];
            const seenR = new Set();
            rel.forEach(r2 => {
              const rk = r2.fecha + "|" + r2.event;
              if (seenR.has(rk)) return;
              seenR.add(rk); uniqRel.push(r2);
            });
            rows.push(makeRow(pairKey, [p.name, r.partner], [p.id, partner ? partner.id : null],
              partner ? [p.club, partner.club] : [p.club], uniqRel));
          });
        });
      } else {
        PLAYERS.forEach(p => {
          const rel = p.results.filter(r => r.category === category && r.modality === modalityId);
          if (!rel.length) return;
          rows.push(makeRow(p.id, [p.name], [p.id], [p.club], rel));
        });
      }
    }
    return rows;
  }

  function rowMetric(row, fechaSel) {
    return fechaSel === "total" ? row.total : row.byFecha[fechaSel];
  }

  function sortRankingRows(rows, fechaSel) {
    const filtered = rows.filter(r => rowMetric(r, fechaSel));
    filtered.sort((a, b) => {
      const ma = rowMetric(a, fechaSel), mb = rowMetric(b, fechaSel);
      return mb.points - ma.points || mb.gold - ma.gold || mb.silver - ma.silver || a.names[0].localeCompare(b.names[0], "es");
    });
    let rank = 0, prevKey = null;
    filtered.forEach((row, i) => {
      const m = rowMetric(row, fechaSel);
      const tieKey = m.points + "-" + m.gold + "-" + m.silver + "-" + m.bronze;
      if (tieKey !== prevKey) rank = i + 1;
      row.rank = rank;
      prevKey = tieKey;
    });
    return filtered;
  }

  function playerRankIn(player, category, modalityId, fechaSel) {
    const rows = sortRankingRows(buildRankingRows(category, modalityId), fechaSel || "total");
    const row = rows.find(r => r.ids.includes(player.id));
    return row ? { rank: row.rank, total: rows.length, points: rowMetric(row, fechaSel || "total").points } : null;
  }

  /* ---------------------------------------------------------------- */
  /* Render: stat tiles + hero podium                                  */
  /* ---------------------------------------------------------------- */

  function renderStats() {
    document.getElementById("metaAthletes").textContent = PLAYERS.length;
    document.getElementById("metaClubs").textContent = CLUBS.length;

    const totalPts = PLAYERS.reduce((s, p) => s + p.total_points, 0);
    const nextFecha = FECHAS.find(f => f.estado === "proxima");

    const tiles = [
      { label: "Deportistas registrados", value: PLAYERS.length, sub: `en ${CLUBS.length} clubes federados`, color: "var(--series-1)", target: PLAYERS.length },
      { label: "Clubes federados", value: CLUBS.length, sub: "con puntaje en el ranking oficial", color: "var(--series-6)", target: CLUBS.length },
      { label: "Puntos distribuidos", value: totalPts.toLocaleString("es-CL"), sub: "acumulados en la temporada 2026", color: "var(--brand-red-2)", target: totalPts },
      { label: "Próxima fecha", value: nextFecha ? `${nextFecha.numero}ª Fecha` : "—", sub: nextFecha ? nextFecha.fechaTexto : "", color: "var(--series-4)" },
    ];

    document.getElementById("statGrid").innerHTML = tiles.map(t => `
      <div class="stat-tile">
        <div class="stat-icon" style="background:color-mix(in srgb, ${t.color} 16%, transparent); color:${t.color}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/></svg>
        </div>
        <div class="stat-label">${t.label}</div>
        <div class="stat-value"${t.target !== undefined ? ` data-target="${t.target}"` : ""}>${t.value}</div>
        <div class="stat-delta">${t.sub}</div>
      </div>
    `).join("");
  }

  /* ---------------------------------------------------------------- */
  /* Hero carousel: "Líderes del ranking general"                      */
  /* ---------------------------------------------------------------- */

  // Category is never mixed here: each slide is scoped to exactly one age
  // category (Sub15/Sub17/Sub19/Adulto), combining only fechas + modalities
  // within it — mixing categories would unfairly favor athletes who play up.
  function heroSlides() {
    return CATEGORIES.map(c => ({ key: "category", category: c.id, label: c.label }));
  }

  function top3ForSlide(slide) {
    const scored = PLAYERS
      .map(p => ({ p, points: p.results.filter(r => r.category === slide.category).reduce((s, r) => s + r.points, 0) }))
      .filter(s => s.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);
    return scored;
  }

  function renderHeroSlide(slide) {
    const top3 = top3ForSlide(slide);
    if (!top3 || !top3.length) {
      return `<div class="podium-empty">Aún sin resultados en esta categoría.</div>`;
    }
    return top3.map((s, i) => `
      <div class="podium-row">
        <div class="podium-rank">${i + 1}</div>
        <div>
          <div class="podium-name"><a href="#/jugador/${s.p.id}" style="color:inherit">${s.p.name}</a></div>
          <div class="podium-sub">${clubShort(s.p.club)}</div>
        </div>
        <div class="podium-pts">${s.points}</div>
      </div>
    `).join("");
  }

  /* ---------------------------------------------------------------- */
  /* Render: Ranking Nacional section                                  */
  /* ---------------------------------------------------------------- */

  function populateRankingFilters() {
    const catSel = document.getElementById("rankCategory");
    catSel.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.label}</option>`).join("");

    const modSel = document.getElementById("rankModality");
    modSel.innerHTML = `<option value="general">General (todas las modalidades)</option>` +
      MODALITIES.map(m => `<option value="${m.id}">${m.label}</option>`).join("");

    const fechaSel = document.getElementById("rankFecha");
    fechaSel.innerHTML = `<option value="total">Ranking general (3 fechas)</option>` +
      FECHAS.map(f => `<option value="${f.numero}">${f.numero}ª Fecha${f.estado === "proxima" ? " — pendiente" : ""}</option>`).join("");

    catSel.value = "Adulto";
    modSel.value = "general";
    fechaSel.value = "total";
    catSel.addEventListener("change", renderRankingTable);
    modSel.addEventListener("change", renderRankingTable);
    fechaSel.addEventListener("change", renderRankingTable);
  }

  function renderRankingTable() {
    const category = document.getElementById("rankCategory").value;
    const modalityId = document.getElementById("rankModality").value;
    const fechaSelRaw = document.getElementById("rankFecha").value;
    const fechaSel = fechaSelRaw === "total" ? "total" : Number(fechaSelRaw);
    const isDoubles = modalityId !== "general" && modalityById[modalityId]?.doubles;

    const allRows = buildRankingRows(category, modalityId);
    const rows = sortRankingRows(allRows, fechaSel);

    const scopeLabel = fechaSel === "total" ? "en las 3 fechas" : `en la ${fechaSel}ª Fecha`;
    document.getElementById("rankCount").textContent =
      `${rows.length} ${isDoubles ? "parejas" : "deportistas"} con puntaje ${scopeLabel}`;

    const colClass = n => fechaSel === n ? ' style="color:var(--brand-red-2)"' : "";
    const thead = `<tr>
      <th style="width:56px;">Pos</th>
      <th>${isDoubles ? "Pareja" : "Deportista"}</th>
      <th>Club</th>
      <th class="num"${colClass(1)}>F1</th>
      <th class="num"${colClass(2)}>F2</th>
      <th class="num"${colClass(3)}>F3</th>
      <th class="num"${colClass("total")}>Total</th>
      <th>Medallas${fechaSel === "total" ? "" : " · F" + fechaSel}</th>
    </tr>`;

    function cell(m, active) {
      if (!m) return `<td class="num pts-muted">–</td>`;
      return `<td class="num ${active ? "pts-strong" : "pts-muted"}">${m.points}</td>`;
    }

    const tbody = rows.map(row => {
      const rankClass = row.rank === 1 ? "top1" : row.rank === 2 ? "top2" : row.rank === 3 ? "top3" : "";
      const namesHtml = row.names.map((n, i) => {
        if (!n) return "";
        const id = row.ids[i];
        return id ? `<a class="player-link" href="#/jugador/${id}">${n}</a>` : n;
      }).join(' <span class="text-muted">/</span> ');
      const uniqueClubs = [...new Set(row.clubs)];
      const clubsHtml = uniqueClubs.map(c => `
        <span class="club-tag"><span class="club-dot" style="background:${clubColor(c)}"></span>${clubShort(c)}</span>
      `).join(" ");
      const activeMetric = rowMetric(row, fechaSel);
      return `
        <tr>
          <td><div class="rank-cell"><span class="rank-badge ${rankClass}">${row.rank}</span></div></td>
          <td><div class="player-cell">${avatarHtml(row.names[0], clubColor(row.clubs[0]), "avatar-sm")}<span>${namesHtml}</span></div></td>
          <td>${clubsHtml}</td>
          ${cell(row.byFecha[1], fechaSel === 1)}
          ${cell(row.byFecha[2], fechaSel === 2)}
          ${cell(row.byFecha[3], fechaSel === 3)}
          ${cell(row.total, fechaSel === "total")}
          <td>${medalPillsHtml(activeMetric.gold, activeMetric.silver, activeMetric.bronze)}</td>
        </tr>`;
    }).join("");

    const table = document.getElementById("rankTable");
    table.querySelector("thead").innerHTML = thead;
    table.querySelector("tbody").innerHTML = tbody ||
      `<tr><td colspan="8" class="text-muted" style="text-align:center; padding:30px;">${fechaSel === "total" ? "Sin resultados registrados para esta combinación todavía." : `Esta fecha aún no se ha disputado. Vuelve a revisar cuando la ${fechaSel}ª Fecha se juegue.`}</td></tr>`;
  }

  /* ---------------------------------------------------------------- */
  /* Render: Clubes                                                    */
  /* ---------------------------------------------------------------- */

  function renderClubsTable() {
    const thead = `<tr>
      <th style="width:56px;">Pos</th><th>Club</th><th class="num">Atletas</th>
      <th class="num">Oro</th><th class="num">Plata</th><th class="num">Bronce</th>
      <th class="num">Puntos F1</th><th class="num">Total</th>
    </tr>`;
    const tbody = CLUBS.map(c => {
      const rankClass = c.rank === 1 ? "top1" : c.rank === 2 ? "top2" : c.rank === 3 ? "top3" : "";
      return `
        <tr>
          <td><span class="rank-badge ${rankClass}">${c.rank}</span></td>
          <td><div class="club-tag" style="font-size:13.5px;"><span class="club-dot" style="background:${c.color}"></span><strong style="color:var(--text-primary); font-weight:700;">${c.name}</strong></div></td>
          <td class="num">${c.athletes}</td>
          <td class="num" style="color:var(--medal-gold); font-weight:700;">${c.gold}</td>
          <td class="num" style="color:var(--medal-silver); font-weight:700;">${c.silver}</td>
          <td class="num" style="color:var(--medal-bronze); font-weight:700;">${c.bronze}</td>
          <td class="num pts-strong">${c.fecha1_points}</td>
          <td class="num pts-strong">${c.fecha1_points}</td>
        </tr>`;
    }).join("");
    const table = document.getElementById("clubTable");
    table.querySelector("thead").innerHTML = thead;
    table.querySelector("tbody").innerHTML = tbody;
  }

  function renderClubChart() {
    renderHBarChart({
      el: document.getElementById("clubChart"),
      title: "Puntaje por club — Fecha 1",
      subtitle: "Base + inscritos + medallas (oro 7 / plata 5 / bronce 3)",
      data: CLUBS.map(c => ({ label: c.short, value: c.fecha1_points, color: c.color, sub: `${c.athletes} atletas` })),
    });
  }

  // No "todas las categorías" option on purpose: summing across age categories
  // would unfairly reward athletes who also play up a bracket. Every view here
  // stays inside one category, combining only fechas + modalities.
  function populateTopPlayersFilter() {
    const sel = document.getElementById("topPlayersCategory");
    sel.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.label}</option>`).join("");
    sel.value = "Adulto";
    sel.addEventListener("change", renderTopPlayersChart);
  }

  function renderTopPlayersChart() {
    const cat = document.getElementById("topPlayersCategory").value;

    const scored = PLAYERS
      .map(p => ({ player: p, points: p.results.filter(r => r.category === cat).reduce((s, r) => s + r.points, 0) }))
      .filter(s => s.points > 0);
    const top = scored.sort((a, b) => b.points - a.points).slice(0, 10);

    document.getElementById("topPlayersTitle").textContent = `Top 10 deportistas — ${categoryById[cat].label}`;
    document.getElementById("topPlayersSubtitle").textContent = `Suma de puntos en todas las modalidades y fechas de ${categoryById[cat].label}`;

    renderHBarChart({
      el: document.getElementById("topPlayersChart"),
      data: top.map(s => ({ label: s.player.name, value: s.points, color: "var(--seq-450)", sub: clubShort(s.player.club) })),
    });
  }

  /* ---------------------------------------------------------------- */
  /* Render: Jugadores (directorio)                                    */
  /* ---------------------------------------------------------------- */

  function populatePlayerFilters() {
    const catSel = document.getElementById("playerCategoryFilter");
    catSel.innerHTML = `<option value="all">Todas las categorías</option>` +
      CATEGORIES.map(c => `<option value="${c.id}">${c.label}</option>`).join("");

    const clubSel = document.getElementById("playerClubFilter");
    const sortedClubs = [...CLUBS].sort((a, b) => a.name.localeCompare(b.name, "es"));
    clubSel.innerHTML = `<option value="all">Todos los clubes</option>` +
      sortedClubs.map(c => `<option value="${c.name}">${c.name}</option>`).join("");

    ["input", "change"].forEach(evt => {
      document.getElementById("playerSearch").addEventListener(evt, renderPlayersGrid);
    });
    catSel.addEventListener("change", renderPlayersGrid);
    clubSel.addEventListener("change", renderPlayersGrid);
  }

  function renderPlayersGrid() {
    const q = normText(document.getElementById("playerSearch").value);
    const cat = document.getElementById("playerCategoryFilter").value;
    const club = document.getElementById("playerClubFilter").value;

    let list = PLAYERS.filter(p => {
      if (q && !normText(p.name).includes(q) && !normText(p.club).includes(q)) return false;
      if (cat !== "all" && !p.categories.includes(cat)) return false;
      if (club !== "all" && p.club !== club) return false;
      return true;
    });
    // Alphabetical, never by combined points — sorting a mixed-category
    // directory by total_points would implicitly rank multi-category athletes
    // above single-category ones, which is exactly the unfairness to avoid.
    list = [...list].sort((a, b) => a.name.localeCompare(b.name, "es"));

    document.getElementById("playerCount").textContent = `${list.length} de ${PLAYERS.length} deportistas`;

    document.getElementById("playersGrid").innerHTML = list.map(p => `
      <a href="#/jugador/${p.id}" class="entity-card">
        <div class="entity-top">
          ${avatarHtml(p.name, p.color, "avatar-md")}
          <div>
            <div class="entity-name">${p.name}</div>
            <div class="entity-sub">${clubShort(p.club)}</div>
          </div>
        </div>
        <div class="entity-badges">${p.categories.map(categoryBadgeHtml).join("")}</div>
        <div class="entity-stats">
          <div class="entity-stat"><div class="n">${p.categories.length}</div><div class="l">Categorías</div></div>
          <div class="entity-stat"><div class="n">${p.results.length}</div><div class="l">Cuadros</div></div>
          <div class="entity-stat"><div class="n">${p.gold + p.silver + p.bronze}</div><div class="l">Podios</div></div>
        </div>
        <div class="entity-medals">${medalPillsHtml(p.gold, p.silver, p.bronze)}</div>
      </a>
    `).join("") || `<div class="empty-state" style="grid-column:1/-1;">Ningún deportista coincide con la búsqueda.</div>`;
  }

  /* ---------------------------------------------------------------- */
  /* Render: Calendario                                                */
  /* ---------------------------------------------------------------- */

  function renderCalendar() {
    document.getElementById("fechasList").innerHTML = FECHAS.map(f => `
      <div class="card fecha-card ${f.estado}">
        <div class="fecha-num">F${f.numero}</div>
        <div class="fecha-body">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h3>${f.nombre}</h3>
            <span class="badge-status ${f.estado}"><span class="dot"></span>${f.estado === "completado" ? "Completado" : "Próxima"}</span>
          </div>
          <div class="fecha-meta">
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${f.fechaTexto}</span>
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>${f.sede}</span>
            ${f.eventos ? `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v4M16 3v4M4 11h16"/><rect x="3" y="5" width="18" height="16" rx="2"/></svg>${f.eventos} cuadros disputados</span>` : ""}
            ${f.inscritos ? `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="8.5" r="2.6"/><path d="M15.5 14.3c2.7.5 4.5 2.6 4.5 5.7"/></svg>${f.inscritos} inscritos</span>` : ""}
          </div>
          <div class="fecha-foot">
            ${f.fuenteUrl ? `<a href="${f.fuenteUrl}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">Ver resultados oficiales →</a>` : `<span class="text-muted" style="font-size:13px;">Fecha y sede se confirmarán próximamente por la Federación.</span>`}
          </div>
        </div>
      </div>
    `).join("");
  }

  /* ---------------------------------------------------------------- */
  /* Render: Reglamento + Federación (static-ish content)              */
  /* ---------------------------------------------------------------- */

  function renderRules() {
    document.querySelector("#pointsTableEl tbody").innerHTML = POINTS_TABLE.map(r => `
      <tr><td><strong>${r.pos}</strong></td><td class="text-muted">${r.label}</td><td class="num pts-strong">${r.points}</td></tr>
    `).join("");

    document.getElementById("tiebreakList").innerHTML = TIEBREAK_RULES.map((t, i) => `
      <div class="rule-item"><div class="rule-num">${i + 1}</div><div class="rule-text">${t}</div></div>
    `).join("");

    const cr = CLUB_RULES;
    const clubBullets = [
      `Base por presentarse a la fecha: <strong>${cr.base} pts</strong>`,
      `Por cada deportista inscrito en la fecha: <strong>+${cr.porAtleta} pt</strong>`,
      `Medalla de oro: <strong>+${cr.oro} pts</strong> · Plata: <strong>+${cr.plata} pts</strong> · Bronce: <strong>+${cr.bronce} pts</strong>`,
      `Más de 10 deportistas inscritos en la fecha: bono de <strong>+${cr.bonusMasDe10} pts</strong>`,
    ];
    document.getElementById("clubRulesList").innerHTML =
      clubBullets.map((t, i) => `<div class="rule-item"><div class="rule-num">${i + 1}</div><div class="rule-text">${t}</div></div>`).join("") +
      `<div class="divider"></div><div style="font-size:12.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em; margin-bottom:8px;">Desempate entre clubes</div>` +
      CLUB_TIEBREAK_RULES.map((t, i) => `<div class="rule-item"><div class="rule-num">${i + 1}</div><div class="rule-text">${t}</div></div>`).join("");
  }

  const SOCIAL_ICONS = {
    instagram: `<rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none"/>`,
    facebook: `<circle cx="12" cy="12" r="9.2"/><path d="M13.6 21v-6.6h2.2l.3-2.6h-2.5v-1.6c0-.7.2-1.2 1.3-1.2h1.3V6.6c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.1-3.2 3.3v1.8H9v2.6h1.8V21" fill="none"/>`,
  };
  function socialIconSvg(icon) {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${SOCIAL_ICONS[icon] || ""}</svg>`;
  }

  function renderFederation() {
    const f = FEDERATION;
    document.getElementById("fedContact").innerHTML =
      `${f.sede}<br>${f.direccion}<br><br>${f.email}<br>${f.web}`;
    document.getElementById("fedGerencia").innerHTML = f.gerencia.map(d => `
      <div><strong style="color:var(--text-primary)">${d.nombre}</strong><br><span class="text-muted">${d.cargo}</span></div>
    `).join('<div class="divider" style="margin:8px 0;"></div>');
    document.getElementById("fedDirectiva").innerHTML = f.directiva.map(d => `
      <div><strong style="color:var(--text-primary)">${d.nombre}</strong><br><span class="text-muted">${d.cargo}</span></div>
    `).join('<div class="divider" style="margin:8px 0;"></div>');
    document.getElementById("tsLink").href = f.tournamentSoftwareUrl;
    document.getElementById("footerTsLink").href = f.tournamentSoftwareUrl;

    const sponsorChip = s => s.url
      ? `<a href="${s.url}" target="_blank" rel="noopener" class="sponsor-chip">${s.nombre}</a>`
      : `<span class="sponsor-chip">${s.nombre}</span>`;
    document.getElementById("sponsorStrip").innerHTML = f.auspiciadores.map(sponsorChip).join("");

    if (document.getElementById("fedSocial")) {
      document.getElementById("fedSocial").innerHTML = f.redesSociales.map(s => `
        <a href="${s.url}" target="_blank" rel="noopener" class="social-icon-btn" aria-label="${s.nombre}" title="${s.nombre}">
          ${socialIconSvg(s.icon)}
        </a>
      `).join("");
    }
  }

  /* ---------------------------------------------------------------- */
  /* Profile view                                                      */
  /* ---------------------------------------------------------------- */

  function showProfile(id) {
    const p = playersById[id];
    if (!p) { location.hash = "#jugadores"; return; }

    document.getElementById("view-home").classList.add("hidden");
    document.getElementById("view-profile").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });

    document.getElementById("profileAvatar").outerHTML =
      `<div class="avatar avatar-lg" id="profileAvatar" style="background:${p.color}">${initials(p.name)}</div>`;
    document.getElementById("profileName").textContent = p.name;
    document.getElementById("profileSub").innerHTML =
      `<span class="club-tag"><span class="club-dot" style="background:${p.color}"></span>${p.club}</span> <span>· ${p.results.length} resultados registrados en Fecha 1</span>`;
    document.getElementById("profileBadges").innerHTML =
      p.categories.map(categoryBadgeHtml).join("") +
      p.modalities.map(m => `<span class="badge badge-soft">${modalityById[m] ? modalityById[m].label : m}</span>`).join("");

    // Points are shown per category, never blended — a Sub19 player who also
    // plays Adulto should not read as "worth more" than a single-category peer.
    const perCategory = p.categories.map(cat => ({
      cat, points: p.results.filter(r => r.category === cat).reduce((s, r) => s + r.points, 0),
    }));
    const perCategoryHtml = perCategory.map(pc => `
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; padding:3px 0;">
        <span style="font-weight:700; color:${categoryById[pc.cat]?.color || "inherit"}">${categoryById[pc.cat]?.label || pc.cat}</span>
        <span class="mono-num" style="font-weight:800;">${pc.points} pts</span>
      </div>`).join("");

    document.getElementById("profileStats").innerHTML = `
      <div class="stat-tile"><div class="stat-label">Puntos por categoría</div><div style="margin-top:8px;">${perCategoryHtml}</div></div>
      <div class="stat-tile"><div class="stat-label">Medallas</div><div class="stat-value" style="font-size:22px; display:flex; gap:14px; margin-top:10px;">${medalPillsHtml(p.gold, p.silver, p.bronze)}</div></div>
      <div class="stat-tile"><div class="stat-label">Categorías</div><div class="stat-value" style="font-size:20px;">${p.categories.join(" · ")}</div></div>
      <div class="stat-tile"><div class="stat-label">Cuadros disputados</div><div class="stat-value">${p.results.length}</div><div class="stat-delta">${p.modalities.length} modalidades distintas</div></div>
    `;

    document.querySelector("#profileResultsTable tbody").innerHTML = p.results.map(r => {
      const partnerHtml = r.partner
        ? (playersByName[r.partner] ? `<a class="player-link" href="#/jugador/${playersByName[r.partner].id}">${r.partner}</a>` : r.partner)
        : `<span class="text-muted">—</span>`;
      return `
        <tr>
          <td>${categoryBadgeHtml(r.category)}</td>
          <td>${modalityById[r.modality] ? modalityById[r.modality].label : r.modality}</td>
          <td>${partnerHtml}</td>
          <td>${resultBadgeHtml(r.position, r.points)}</td>
          <td class="num pts-strong">${r.points}</td>
        </tr>`;
    }).join("");

    const combos = [];
    const seenCombo = new Set();
    p.results.forEach(r => {
      const k = r.category + "|" + r.modality;
      if (seenCombo.has(k)) return;
      seenCombo.add(k);
      combos.push({ category: r.category, modality: r.modality });
    });
    document.getElementById("profileRankings").innerHTML = combos.map(c => {
      const rk = playerRankIn(p, c.category, c.modality);
      if (!rk) return "";
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--gridline);">
          <div>
            <div style="font-weight:700; font-size:13px;">${c.category} · ${modalityById[c.modality]?.label || c.modality}</div>
          </div>
          <div style="font-weight:800; font-size:14px; color:var(--brand-red-2)">#${rk.rank}<span class="text-muted" style="font-weight:600; font-size:11.5px;"> / ${rk.total}</span></div>
        </div>`;
    }).join("");

    document.title = `${p.name} — Ranking Nacional Bádminton Chile`;
  }

  function showHome() {
    document.getElementById("view-profile").classList.add("hidden");
    document.getElementById("view-home").classList.remove("hidden");
    document.title = "Ranking Nacional de Bádminton — Chile 2026";
    const hash = location.hash.replace("#", "");
    if (hash) {
      const target = document.getElementById(hash);
      if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  function route() {
    const hash = location.hash;
    if (hash.startsWith("#/jugador/")) {
      showProfile(decodeURIComponent(hash.replace("#/jugador/", "")));
    } else {
      showHome();
    }
  }

  /* ---------------------------------------------------------------- */
  /* Theme + mobile nav                                                */
  /* ---------------------------------------------------------------- */

  function initTheme() {
    const stored = localStorage.getItem("theme");
    if (stored) document.documentElement.setAttribute("data-theme", stored);
    updateThemeIcon();
    document.getElementById("themeToggle").addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      updateThemeIcon();
    });
  }
  function updateThemeIcon() {
    const current = document.documentElement.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const icon = document.getElementById("themeIconMoon");
    icon.innerHTML = current === "dark"
      ? `<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>`
      : `<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>`;
  }

  function initMobileNav() {
    document.getElementById("navBurger").addEventListener("click", () => {
      document.getElementById("siteHeader").classList.toggle("nav-open");
    });
    document.getElementById("navLinks").addEventListener("click", () => {
      document.getElementById("siteHeader").classList.remove("nav-open");
    });
  }

  /* ---------------------------------------------------------------- */
  /* Boot                                                               */
  /* ---------------------------------------------------------------- */

  function init() {
    initTheme();
    initMobileNav();

    renderStats();
    if (window.RankingMotion) RankingMotion.initHeroCarousel(heroSlides, renderHeroSlide);

    populateRankingFilters();
    renderRankingTable();

    renderClubsTable();
    renderClubChart();
    populateTopPlayersFilter();
    renderTopPlayersChart();

    populatePlayerFilters();
    renderPlayersGrid();

    renderCalendar();
    renderRules();
    renderFederation();

    if (window.RankingMotion) {
      RankingMotion.initScrollReveal();
      RankingMotion.initStatCounters();
    }

    window.addEventListener("hashchange", route);
    route();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
