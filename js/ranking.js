// Ranking engine — pure functions, no DOM, no globals.
//
// This is the one piece of the site that actually decides where a real
// athlete lands in an official ranking, so it is kept dependency-free on
// purpose: every input is an explicit argument, nothing is read off
// `window`, so it can run identically in the browser (via a <script> tag,
// exposed as window.RankingEngine) and in Node under tests/ranking.test.js
// (via module.exports). See tests/ranking.test.js for the behaviours this
// is expected to guarantee (points table, doubles pairing, tie-breaks,
// per-fecha filtering, etc).

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.RankingEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function emptyMetric() {
    return { points: 0, gold: 0, silver: 0, bronze: 0 };
  }

  function addMetric(m, r) {
    m.points += r.points;
    if (r.position === 1) m.gold++;
    else if (r.position === 2) m.silver++;
    else if (r.position === 3) m.bronze++;
  }

  /**
   * Builds ranking rows for one (category, modalityId) pair.
   *
   * - modalityId === "general" combines every modality *within that one
   *   category* — categories are never mixed (see app.js heroSlides comment
   *   for why: an athlete who plays two age brackets must not out-rank a
   *   single-bracket peer just for having more results to add up).
   * - a doubles modalityId collapses both partners' identical result rows
   *   into a single pair-row (each result already carries the same points
   *   for both partners, so we de-dupe by fecha+event).
   *
   * Each row carries a per-fecha breakdown (`byFecha[n]`, null if the pair/
   * player has no result that fecha) plus a `total` across every fecha
   * passed in `fechaNums` — the caller decides which slice to sort by.
   *
   * @param {Array} players - PLAYERS array (each with .id/.name/.club/.results)
   * @param {string} category - one of CATEGORIES ids (e.g. "Adulto")
   * @param {string} modalityId - "general" or one of MODALITIES ids
   * @param {Object} modalityById - map of modalityId -> {doubles: bool, ...}
   * @param {number[]} fechaNums - e.g. [1,2,3]
   */
  function buildRankingRows(players, category, modalityId, modalityById, fechaNums) {
    const playersByName = {};
    players.forEach(p => { playersByName[p.name] = p; });

    const rows = [];

    function makeRow(key, names, ids, clubs, rel) {
      const byFecha = {};
      fechaNums.forEach(n => {
        const relF = rel.filter(r => r.fecha === n);
        byFecha[n] = relF.length ? relF.reduce((m, r) => (addMetric(m, r), m), emptyMetric()) : null;
      });
      const total = rel.reduce((m, r) => (addMetric(m, r), m), emptyMetric());
      return { key, names, ids, clubs, byFecha, total };
    }

    if (modalityId === "general") {
      players.forEach(p => {
        const rel = p.results.filter(r => r.category === category);
        if (!rel.length) return;
        rows.push(makeRow(p.id, [p.name], [p.id], [p.club], rel));
      });
      return rows;
    }

    const mod = modalityById[modalityId];
    if (mod && mod.doubles) {
      const seen = new Set();
      players.forEach(p => {
        p.results.filter(r => r.category === category && r.modality === modalityId).forEach(r => {
          const pairKey = [p.name, r.partner].sort().join("||");
          if (seen.has(pairKey)) return;
          seen.add(pairKey);
          const partner = r.partner ? playersByName[r.partner] : null;

          const rel = [];
          players.forEach(pp => {
            pp.results.filter(rr => rr.category === category && rr.modality === modalityId)
              .forEach(rr => { if ([pp.name, rr.partner].sort().join("||") === pairKey) rel.push(rr); });
          });
          // de-dupe: both partners contribute the identical result row per fecha/event
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
      players.forEach(p => {
        const rel = p.results.filter(r => r.category === category && r.modality === modalityId);
        if (!rel.length) return;
        rows.push(makeRow(p.id, [p.name], [p.id], [p.club], rel));
      });
    }
    return rows;
  }

  /** Returns the {points,gold,silver,bronze} slice for "total" or a fecha number. */
  function rowMetric(row, fechaSel) {
    return fechaSel === "total" ? row.total : row.byFecha[fechaSel];
  }

  /**
   * Sorts + ranks rows for a given fecha scope, dropping rows with no data
   * in that scope (e.g. a fecha nobody has played yet). Tied rows (identical
   * points/gold/silver/bronze) share the same rank number.
   */
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

  /** Convenience: where does `player` land in (category, modalityId, fechaSel)? */
  function playerRankIn(players, player, category, modalityId, modalityById, fechaNums, fechaSel) {
    const scope = fechaSel || "total";
    const rows = sortRankingRows(buildRankingRows(players, category, modalityId, modalityById, fechaNums), scope);
    const row = rows.find(r => r.ids.includes(player.id));
    return row ? { rank: row.rank, total: rows.length, points: rowMetric(row, scope).points } : null;
  }

  return { emptyMetric, addMetric, buildRankingRows, rowMetric, sortRankingRows, playerRankIn };
});
