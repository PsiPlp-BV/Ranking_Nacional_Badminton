# -*- coding: utf-8 -*-
"""
Data pipeline for the Ranking Nacional de Badminton Chile 2026.

Turns raw per-fecha tournament results (position + points per draw, read by
hand off the official Tournamentsoftware.com brackets) into js/data.js —
the file the site actually loads.

    python scripts/build_data.py

Run the tests first if you're touching the scoring logic:

    python -m unittest discover scripts

See README.md -> "Agregar una fecha nueva" for the step-by-step of adding
Fecha 2 / Fecha 3 once they're played. Short version: add a `fecha=2` block
of add_event(...) calls below (same shape as the Fecha 1 block), re-run this
script, commit the new js/data.js.
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

POINTS = {1: 100, 2: 80, 3: 60, 4: 50, 5: 30, "participation": 10}


def points_for(position):
    """Position -> points per the official table (5th-8th / quarterfinal
    losers all share one tier, so anything >= 5 maps to that tier)."""
    return POINTS.get(position, POINTS[5])


# ---------------------------------------------------------------------------
# Event model — pure data, no filesystem/network access
# ---------------------------------------------------------------------------

def make_event(fecha, category, modality, code, draw_type, size, placements, participation=None):
    """
    placements: {position: [entry, ...]}, entry = tuple of 1 (singles) or
      2 (doubles) player names. position 1/2/3/4 map directly; any other key
      (e.g. 5) is treated as the "5th-8th / quarterfinalist" tier.
    participation: entries that played but did not place — elimination draws
      only (round-of-16/32 losers who never reached the quarterfinal).
    """
    return dict(
        fecha=fecha, category=category, modality=modality, code=code, type=draw_type, size=size,
        placements=placements, participation=participation or [],
    )


def compute_results(events, club_of):
    """
    events -> dict[name] -> player record (name, club, results[], totals).

    This is intentionally the one function under direct test in
    test_build_data.py: it is the actual "raw results -> points" logic that
    decides where every athlete lands, so a synthetic 2-3 event fixture
    should be enough to catch a broken points table or a medal-counting bug
    before it ships.
    """
    players = {}

    def get_player(name):
        name = re.sub(r"\s+", " ", name.strip())
        if name not in players:
            players[name] = dict(
                name=name, club=club_of(name),
                results=[], total_points=0, gold=0, silver=0, bronze=0,
                categories=set(), modalities=set(),
            )
        return players[name]

    for ev in events:
        for pos, entries in ev["placements"].items():
            pts = points_for(pos if pos in (1, 2, 3, 4) else 5)
            for entry in entries:
                for pname in entry:
                    p = get_player(pname)
                    partner = entry[1] if len(entry) == 2 and entry[0] == pname else (entry[0] if len(entry) == 2 else None)
                    p["results"].append(dict(fecha=ev["fecha"], event=ev["code"], category=ev["category"],
                                              modality=ev["modality"], position=pos, points=pts, partner=partner))
                    p["total_points"] += pts
                    p["categories"].add(ev["category"])
                    p["modalities"].add(ev["modality"])
                    if pos == 1: p["gold"] += 1
                    elif pos == 2: p["silver"] += 1
                    elif pos == 3: p["bronze"] += 1
        for entry in ev["participation"]:
            for pname in entry:
                p = get_player(pname)
                partner = entry[1] if len(entry) == 2 and entry[0] == pname else (entry[0] if len(entry) == 2 else None)
                p["results"].append(dict(fecha=ev["fecha"], event=ev["code"], category=ev["category"],
                                          modality=ev["modality"], position=None, points=POINTS["participation"],
                                          partner=partner))
                p["total_points"] += POINTS["participation"]
                p["categories"].add(ev["category"])
                p["modalities"].add(ev["modality"])

    return players


def players_for_fecha(players, fecha, club_of):
    """
    Recorta `players` a UNA fecha: solo quienes tienen resultados en ella, con
    sus medallas recontadas sobre esos resultados y el club con el que
    compitieron *esa* fecha (un deportista puede cambiar de club entre fechas).

    Es el paso previo obligatorio a compute_club_scores, porque el puntaje de
    clubes del reglamento se evalúa fecha a fecha: la base de 50, el conteo de
    inscritos y el bono por más de 10 deportistas se pagan una vez por fecha,
    no una vez por circuito.
    """
    scoped = {}
    for name, p in players.items():
        rel = [r for r in p["results"] if r["fecha"] == fecha]
        if not rel:
            continue
        scoped[name] = dict(
            name=name, club=club_of(name), results=rel,
            total_points=sum(r["points"] for r in rel),
            gold=sum(1 for r in rel if r["position"] == 1),
            silver=sum(1 for r in rel if r["position"] == 2),
            bronze=sum(1 for r in rel if r["position"] == 3),
            categories=set(), modalities=set(),
        )
    return scoped


def compute_club_scores(players, club_short_map, club_rules, exclude_clubs=("Independiente",)):
    """
    players -> per-club totals for ONE fecha's worth of events (base +
    1/athlete + medals + >10-athletes bonus), per the official club rules.

    If `players` mixes multiple fechas' results, the medal/athlete counts
    will (correctly, per the rules being evaluated per-fecha) end up scoped
    to whatever's in `players` — callers that need a single fecha's club
    score should filter results to that fecha first with players_for_fecha().
    """
    clubs = {}

    def get_club(name):
        if name not in clubs:
            clubs[name] = dict(name=name, athletes=set(), gold=0, silver=0, bronze=0)
        return clubs[name]

    for pname, p in players.items():
        c = get_club(p["club"])
        c["athletes"].add(pname)
        c["gold"] += p["gold"]
        c["silver"] += p["silver"]
        c["bronze"] += p["bronze"]

    scores = []
    for name, c in clubs.items():
        if name in exclude_clubs:
            continue
        n = len(c["athletes"])
        bonus = club_rules["bonusMasDe10"] if n > 10 else 0
        pts = (club_rules["base"] + n * club_rules["porAtleta"]
               + c["gold"] * club_rules["oro"] + c["silver"] * club_rules["plata"] + c["bronze"] * club_rules["bronce"]
               + bonus)
        scores.append(dict(name=name, short=club_short_map.get(name, name), athletes=n,
                            gold=c["gold"], silver=c["silver"], bronze=c["bronze"], points=pts))
    scores.sort(key=lambda x: -x["points"])
    for i, c in enumerate(scores, 1):
        c["rank"] = i
    return scores


def build_club_table(players, fecha_nums, club_of_by_fecha, club_short_map, club_color_map,
                      club_rules=None):
    """
    Tabla anual de clubes: el puntaje de cada fecha se calcula por separado y
    después se suman. Un club que no viaja a una fecha simplemente suma 0 esa
    fecha (no arrastra su base de 50).

    Devuelve filas con `by_fecha` {n: puntos}, `total_points`, y los acumulados
    de plantel y medallas de todo el circuito.
    """
    club_rules = club_rules or CLUB_RULES
    per_fecha = {}
    for n in fecha_nums:
        scoped = players_for_fecha(players, n, club_of_by_fecha[n])
        per_fecha[n] = {c["name"]: c for c in compute_club_scores(scoped, club_short_map, club_rules)}

    rows = {}
    for n in fecha_nums:
        for name, c in per_fecha[n].items():
            row = rows.setdefault(name, dict(
                name=name, short=club_short_map.get(name, name),
                color=club_color_map.get(name, "#898781"),
                athletes=0, gold=0, silver=0, bronze=0,
                by_fecha={m: 0 for m in fecha_nums}, total_points=0,
            ))
            row["by_fecha"][n] = c["points"]
            row["total_points"] += c["points"]
            row["gold"] += c["gold"]
            row["silver"] += c["silver"]
            row["bronze"] += c["bronze"]

    # Plantel = deportistas distintos del club en todo el circuito, no la suma
    # de inscritos por fecha (que contaría dos veces a quien compite en ambas).
    for name, row in rows.items():
        row["athletes"] = len({
            pname for pname, p in players.items()
            if any(club_of_by_fecha[r["fecha"]](pname) == name for r in p["results"])
        })

    out = sorted(rows.values(), key=lambda x: (-x["total_points"], -x["gold"], -x["silver"], x["name"]))
    for i, c in enumerate(out, 1):
        c["rank"] = i
    return out


CLUB_RULES = dict(base=50, porAtleta=1, oro=7, plata=5, bronce=3, bonusMasDe10=20)


# ---------------------------------------------------------------------------
# js/data.js generation
# ---------------------------------------------------------------------------

def slugify(name):
    s = unicodedata.normalize("NFD", name)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s.lower()).strip("-")
    return s


def to_data_js(players, club_short_map, club_color_map, out_path):
    plist = []
    seen_slugs = {}
    for name in sorted(players.keys()):
        p = players[name]
        base = slugify(p["name"])
        slug, i = base, 2
        while slug in seen_slugs:
            slug = f"{base}-{i}"; i += 1
        seen_slugs[slug] = True
        plist.append(dict(
            name=p["name"], club=p["club"], club_short=club_short_map.get(p["club"], p["club"]),
            total_points=p["total_points"], gold=p["gold"], silver=p["silver"], bronze=p["bronze"],
            categories=sorted(p["categories"]), modalities=sorted(p["modalities"]),
            results=p["results"], id=slug,
            color=club_color_map.get(p["club"], "#898781"),
        ))
    plist.sort(key=lambda x: -x["total_points"])

    out_path.write_text(
        "// Datos oficiales del Ranking Nacional de Badminton Chile 2026\n"
        "// Generado por scripts/build_data.py — no editar a mano, re-ejecutar el script.\n"
        "const PLAYERS = " + json.dumps(plist, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )


def write_players_and_clubs_js(players, fecha_nums, club_of_by_fecha, club_short_map,
                                club_color_map, data_js_path):
    to_data_js(players, club_short_map, club_color_map, data_js_path)
    scores = build_club_table(players, fecha_nums, club_of_by_fecha, club_short_map, club_color_map)
    with data_js_path.open("a", encoding="utf-8") as f:
        f.write("\nconst CLUBS = " + json.dumps(scores, ensure_ascii=False, indent=2) + ";\n")
    return scores


if __name__ == "__main__":
    from clubs import CLUB_MAP, CLUB_SHORT, CLUB_COLOR
    import fecha1_results, fecha2_results

    # Cada fecha aporta sus cuadros y su plantel. El orden importa: para el club
    # "actual" de un deportista gana la fecha más reciente en la que compitió.
    FECHAS = [fecha1_results, fecha2_results]
    FECHA_NUMS = [1, 2]

    EVENTS = [ev for mod in FECHAS for ev in mod.EVENTS]

    NAME_CLUB_BY_FECHA = {n: mod.NAME_CLUB for n, mod in zip(FECHA_NUMS, FECHAS)}
    NAME_CLUB_CURRENT = {}
    for n in FECHA_NUMS:
        NAME_CLUB_CURRENT.update(NAME_CLUB_BY_FECHA[n])

    def _resolver(name_club, where):
        def club_of(name):
            code = name_club.get(name.strip())
            if code is None:
                raise KeyError(f"No club mapping for {name!r} — agrégalo a NAME_CLUB en {where}")
            return CLUB_MAP[code]
        return club_of

    club_of = _resolver(NAME_CLUB_CURRENT, "el fechaN_results.py correspondiente")
    club_of_by_fecha = {
        n: _resolver(NAME_CLUB_BY_FECHA[n], f"scripts/fecha{n}_results.py")
        for n in FECHA_NUMS
    }

    players = compute_results(EVENTS, club_of)
    print(f"Cuadros: {len(EVENTS)}  |  Deportistas con resultados: {len(players)}")

    cambios = [
        (n, NAME_CLUB_BY_FECHA[1][n], NAME_CLUB_BY_FECHA[2][n])
        for n in NAME_CLUB_BY_FECHA[1]
        if n in NAME_CLUB_BY_FECHA[2] and NAME_CLUB_BY_FECHA[1][n] != NAME_CLUB_BY_FECHA[2][n]
    ]
    if cambios:
        print()
        print("=== CAMBIOS DE CLUB ENTRE FECHAS ===")
        for name, a, b in cambios:
            print(f"  {name}: {CLUB_MAP[a]} -> {CLUB_MAP[b]}")

    out = ROOT / "js" / "data.js"
    scores = write_players_and_clubs_js(players, FECHA_NUMS, club_of_by_fecha,
                                        CLUB_SHORT, CLUB_COLOR, out)

    print()
    print(f"Escrito {out}")
    print()
    print("=== RANKING DE CLUBES ===")
    cols = "  ".join(f"F{n}" for n in FECHA_NUMS)
    print(f"{'':3s}{'club':38s} {cols:>10s}   total   (plantel/medallas del circuito)")
    for c in scores:
        por_fecha = "  ".join(f"{c['by_fecha'][n]:3d}" for n in FECHA_NUMS)
        print(f"{c['rank']}. {c['name']:38s} {por_fecha}   {c['total_points']:5d}   "
              f"(atletas={c['athletes']} oro={c['gold']} plata={c['silver']} bronce={c['bronze']})")
