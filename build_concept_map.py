#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Generate an interactive "concept map" for the Digital Memorial GitHub Pages site.

Outputs:
  docs/concept_map/index.html
  docs/concept_map/app.js
  docs/concept_map/graph.json

Data source (default):
  docs/data/index.json

No external Python dependencies (stdlib only).
"""

from __future__ import annotations

import argparse
import ast
import json
import math
import os
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


# ----------------------------
# Helpers
# ----------------------------

STOPWORDS_IT = {
    # IT stopwords (minimal but effective)
    "il","lo","la","i","gli","le","un","uno","una","di","a","da","in","su","per","tra","fra",
    "e","ed","o","od","ma","che","del","dello","della","dei","degli","delle","al","allo","alla",
    "ai","agli","alle","nel","nello","nella","nei","negli","nelle","col","coi","con","senza",
    "come","più","meno","anche","solo","ancora","poi","qui","qua","là","oggi","ieri","domani",
    "parte","puntata","episodio","speciale","live","diretta",
    # channel/common noise
    "federico","frusciante","patreon","minirece","recensioni","recensione","consigli","monografie",
    "classici","saghe","underground","reboot","cinema","noncinema","megli","peggio",  # "megli" to catch tokenization
}

def slugify(s: str, max_len: int = 80) -> str:
    s = s.lower().strip()
    s = re.sub(r"[’']", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s[:max_len] if len(s) > max_len else s

def safe_read_text(p: Path) -> str:
    for enc in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return p.read_text(encoding=enc)
        except UnicodeDecodeError:
            continue
    return p.read_text(errors="replace")

def pretty_int(n: int) -> str:
    return f"{n:,}".replace(",", ".")

def log_size(v: int) -> float:
    # reasonable node size scaling for vis-network "value"
    if v <= 0:
        return 1.0
    return max(1.0, 2.0 * math.log10(v + 1))


# ----------------------------
# Data extraction
# ----------------------------

FILM_RE_1 = re.compile(r"[：:]\s*[＂\"«]?(.*?)[＂\"»]?\s*\((\d{4})\)", re.UNICODE)
FILM_RE_2 = re.compile(r"\b(.+?)\s*\((\d{4})\)\s*(?:di|del|della)\s+([A-Z][^\-\|]{2,60})", re.UNICODE)

def extract_film_from_title(title: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Try to extract film title + year from common Patreon patterns.
    Returns (film_title, film_year) or (None, None).
    """
    m = FILM_RE_1.search(title)
    if not m:
        return None, None

    film = m.group(1).strip()
    year = m.group(2).strip()

    # clean common prefixes
    film = re.sub(r"^(Patreon|Patreoo|Patrreon|Pareon)[：:]\s*", "", film, flags=re.IGNORECASE).strip()
    # avoid absurd captures
    if len(film) < 2 or len(film) > 90:
        return None, None
    return film, year

def tokenize_title(title: str) -> List[str]:
    s = title.lower()
    s = s.replace(":", " ").replace("：", " ")
    s = re.sub(r"[^\w\sàèéìòù]", " ", s, flags=re.UNICODE)
    s = re.sub(r"\s+", " ", s).strip()
    toks = []
    for t in s.split(" "):
        if not t or len(t) < 4:
            continue
        if t.isdigit():
            continue
        if t in STOPWORDS_IT:
            continue
        # drop tokens that are mostly numbers
        if re.fullmatch(r"\d+[a-z]+|[a-z]+\d+", t):
            continue
        toks.append(t)
    return toks


def parse_director_genres_from_build_index(build_index_path: Path) -> Dict[str, List[str]]:
    """
    Tries to parse DIRECTOR_GENRES = {...} from build_index.py (if present),
    without importing it.
    """
    if not build_index_path.exists():
        return {}

    txt = safe_read_text(build_index_path)

    anchor = "DIRECTOR_GENRES"
    i = txt.find(anchor)
    if i < 0:
        return {}

    # find first '{' after anchor
    j = txt.find("{", i)
    if j < 0:
        return {}

    # brace matching to find dict literal
    depth = 0
    end = None
    for k in range(j, len(txt)):
        ch = txt[k]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = k
                break

    if end is None:
        return {}

    literal = txt[j:end+1]
    try:
        obj = ast.literal_eval(literal)
        if isinstance(obj, dict):
            # normalize values to list[str]
            out: Dict[str, List[str]] = {}
            for dk, dv in obj.items():
                if isinstance(dk, str) and isinstance(dv, (list, tuple)):
                    out[dk] = [str(x) for x in dv if isinstance(x, str)]
            return out
    except Exception:
        return {}

    return {}


# ----------------------------
# Graph model
# ----------------------------

@dataclass
class Video:
    vid: str
    date: Optional[str]
    title: str
    cat_id: str
    cat_label: str
    year: Optional[int]
    director: Optional[str]
    wc: Optional[int]


def load_catalog(index_json: Path) -> List[Video]:
    data = json.loads(safe_read_text(index_json))
    catalog = data.get("catalog", [])
    videos: List[Video] = []
    for it in catalog:
        videos.append(Video(
            vid=str(it.get("id")),
            date=it.get("d"),
            title=str(it.get("t", "")),
            cat_id=str(it.get("c", "altro")),
            cat_label=str(it.get("cl", it.get("c", "Altro"))),
            year=int(it.get("y")) if it.get("y") is not None else None,
            director=str(it.get("dir")) if it.get("dir") else None,
            wc=int(it.get("wc")) if it.get("wc") is not None else None
        ))
    return videos


def pick_index_json(repo_root: Path, explicit: Optional[Path]) -> Path:
    if explicit:
        p = (repo_root / explicit) if not explicit.is_absolute() else explicit
        if p.exists():
            return p
        raise FileNotFoundError(f"index.json non trovato: {p}")

    candidates = [
        repo_root / "docs" / "data" / "index.json",
        repo_root / "docs" / "index.json",
        repo_root / "data" / "index.json",
    ]
    for c in candidates:
        if c.exists():
            return c

    # last resort: search
    for c in repo_root.rglob("index.json"):
        try:
            txt = safe_read_text(c)
            if '"catalog"' in txt and '"total"' in txt:
                return c
        except Exception:
            continue

    raise FileNotFoundError("Non ho trovato un index.json valido. Hai già eseguito build_index.py? (di solito crea docs/data/index.json)")


def build_graph(
    videos: List[Video],
    director_genres: Dict[str, List[str]],
    *,
    min_director_count: int,
    min_film_count: int,
    top_films: int,
    top_keywords_per_category: int,
    min_keyword_count: int,
    min_edge_weight: int,
    max_videos_per_node: int,
) -> Dict[str, Any]:

    # Counters
    cat_count = Counter(v.cat_id for v in videos)
    cat_label = {}
    for v in videos:
        cat_label[v.cat_id] = v.cat_label

    year_count = Counter(v.year for v in videos if v.year)
    director_count = Counter(v.director for v in videos if v.director)

    # co-occurrence
    cat_year = Counter((v.cat_id, v.year) for v in videos if v.year)
    cat_dir = Counter((v.cat_id, v.director) for v in videos if v.director)

    # Films
    film_count = Counter()
    film_year = {}
    film_cat = Counter()
    film_dir = Counter()

    for v in videos:
        film, fy = extract_film_from_title(v.title)
        if not film:
            continue
        key = f"{film} ({fy})" if fy else film
        film_count[key] += 1
        film_year[key] = fy
        film_cat[(v.cat_id, key)] += 1
        if v.director:
            film_dir[(v.director, key)] += 1

    # pick top films (by count) after threshold
    top_film_keys = [k for k, c in film_count.most_common() if c >= min_film_count][:top_films]
    top_film_set = set(top_film_keys)

    # Keywords by category
    per_cat_words: Dict[str, Counter] = defaultdict(Counter)
    for v in videos:
        for tok in tokenize_title(v.title):
            per_cat_words[v.cat_id][tok] += 1

    keyword_candidates = set()
    for cid, cnt in per_cat_words.items():
        # take top N that are above min count
        for w, c in cnt.most_common():
            if c < min_keyword_count:
                break
            keyword_candidates.add(w)
            if len([x for x in keyword_candidates if x]) > 5000:
                break  # sanity
        # limit per category afterwards
    # Rebuild per category limited set
    per_cat_topwords: Dict[str, List[Tuple[str,int]]] = {}
    for cid, cnt in per_cat_words.items():
        top = [(w,c) for (w,c) in cnt.most_common() if w in keyword_candidates and c >= min_keyword_count]
        per_cat_topwords[cid] = top[:top_keywords_per_category]

    # Node -> example videos (for sidebar)
    def add_example(store: Dict[str, List[Dict[str,str]]], node_id: str, v: Video):
        arr = store.setdefault(node_id, [])
        if len(arr) >= max_videos_per_node:
            return
        arr.append({"id": v.vid, "t": v.title, "d": v.date or ""})

    examples: Dict[str, List[Dict[str,str]]] = {}

    # --- Build nodes ---
    nodes: List[Dict[str, Any]] = []
    edges_acc: Dict[Tuple[str,str], int] = defaultdict(int)

    def add_node(node_id: str, label: str, group: str, count: int, level: int, extra: Optional[Dict[str,Any]] = None):
        n = {
            "id": node_id,
            "label": label,
            "group": group,
            "value": log_size(count),
            "count": count,
            "level": level,
        }
        if extra:
            n.update(extra)
        nodes.append(n)

    def add_edge(a: str, b: str, w: int):
        if w <= 0:
            return
        key = (a, b)
        edges_acc[key] += w

    ROOT = "root"
    add_node(ROOT, "Federico Frusciante", "root", len(videos), 0, {"title": f"{pretty_int(len(videos))} video indicizzati"})

    # categories
    for cid, c in cat_count.most_common():
        nid = f"cat:{cid}"
        add_node(nid, cat_label.get(cid, cid), "category", c, 1, {"cat_id": cid})
        add_edge(ROOT, nid, c)

    # years
    for y, c in sorted(year_count.items()):
        nid = f"year:{y}"
        add_node(nid, str(y), "year", c, 2, {"year": y})
        add_edge(ROOT, nid, c)

    # directors (filtered)
    kept_directors = {d for d, c in director_count.items() if c >= min_director_count}
    for d in sorted(kept_directors, key=lambda x: (-director_count[x], x)):
        c = director_count[d]
        nid = f"dir:{d}"
        add_node(nid, d, "director", c, 2, {"director": d})
        add_edge(ROOT, nid, c)

    # genres (from build_index.py DIRECTOR_GENRES) – optional
    genre_count = Counter()
    for d in kept_directors:
        for g in director_genres.get(d, []):
            genre_count[g] += director_count[d]

    for g, c in genre_count.most_common():
        nid = f"genre:{g}"
        add_node(nid, g, "genre", c, 3, {"genre": g})
        add_edge(ROOT, nid, c)

    # films (top)
    for fk in top_film_keys:
        c = film_count[fk]
        nid = f"film:{slugify(fk)}"
        add_node(nid, fk, "film", c, 3, {"film": fk, "film_year": film_year.get(fk)})
        add_edge(ROOT, nid, c)

    # keywords
    global_kw_count = Counter()
    for cid, words in per_cat_topwords.items():
        for w, c in words:
            global_kw_count[w] += c

    # keep only keywords that appear meaningfully overall
    kept_keywords = {w for w, c in global_kw_count.items() if c >= min_keyword_count}
    for w in sorted(kept_keywords, key=lambda x: (-global_kw_count[x], x)):
        nid = f"kw:{w}"
        add_node(nid, w, "keyword", global_kw_count[w], 3, {"kw": w})
        add_edge(ROOT, nid, global_kw_count[w])

    # --- Build edges between concepts ---
    # category <-> year
    for (cid, y), c in cat_year.items():
        if c < min_edge_weight:
            continue
        add_edge(f"cat:{cid}", f"year:{y}", c)

    # category <-> director
    for (cid, d), c in cat_dir.items():
        if not d or d not in kept_directors:
            continue
        if c < min_edge_weight:
            continue
        add_edge(f"cat:{cid}", f"dir:{d}", c)

    # director <-> genre
    for d in kept_directors:
        dn = f"dir:{d}"
        for g in director_genres.get(d, []):
            gn = f"genre:{g}"
            w = max(1, int(director_count[d] * 0.5))
            if w < min_edge_weight:
                continue
            add_edge(dn, gn, w)

    # category <-> keyword
    for cid, lst in per_cat_topwords.items():
        for w, c in lst:
            if w not in kept_keywords:
                continue
            if c < min_edge_weight:
                continue
            add_edge(f"cat:{cid}", f"kw:{w}", c)

    # category <-> film
    for (cid, fk), c in film_cat.items():
        if fk not in top_film_set:
            continue
        if c < min_edge_weight:
            continue
        add_edge(f"cat:{cid}", f"film:{slugify(fk)}", c)

    # director <-> film (when director recognized)
    for (d, fk), c in film_dir.items():
        if fk not in top_film_set:
            continue
        if d not in kept_directors:
            continue
        if c < min_edge_weight:
            continue
        add_edge(f"dir:{d}", f"film:{slugify(fk)}", c)

    # --- Examples for sidebar ---
    # We attach example videos to categories / directors / years / films.
    # (keywords/genres can still show counts only)
    for v in videos:
        add_example(examples, f"cat:{v.cat_id}", v)
        if v.year:
            add_example(examples, f"year:{v.year}", v)
        if v.director and v.director in kept_directors:
            add_example(examples, f"dir:{v.director}", v)
        film, fy = extract_film_from_title(v.title)
        if film:
            fk = f"{film} ({fy})" if fy else film
            if fk in top_film_set:
                add_example(examples, f"film:{slugify(fk)}", v)

    # attach examples into nodes
    nodes_by_id = {n["id"]: n for n in nodes}
    for nid, vids in examples.items():
        if nid in nodes_by_id:
            nodes_by_id[nid]["videos"] = vids

    # finalize edges list
    edges = []
    for (a, b), w in edges_acc.items():
        edges.append({
            "from": a,
            "to": b,
            "value": w,
            "title": f"Peso: {pretty_int(w)}"
        })

    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "videos_total": len(videos),
        "nodes_total": len(nodes),
        "edges_total": len(edges),
        "params": {
            "min_director_count": min_director_count,
            "min_film_count": min_film_count,
            "top_films": top_films,
            "top_keywords_per_category": top_keywords_per_category,
            "min_keyword_count": min_keyword_count,
            "min_edge_weight": min_edge_weight,
        },
    }

    return {"meta": meta, "nodes": nodes, "edges": edges}


# ----------------------------
# HTML/JS templates (static)
# ----------------------------

HTML_TEMPLATE = """<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Mappa concettuale — Digital Memorial</title>

  <!-- vis-network (CDN) -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/vis-network@9.1.9/styles/vis-network.min.css" />

  <style>
    :root {
      --bg: #0b0f14;
      --panel: #121824;
      --text: #e7eefc;
      --muted: #9fb1d1;
      --line: rgba(255,255,255,0.12);
      --accent: #7aa2ff;
    }
    html, body { height: 100%; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji","Segoe UI Emoji";
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    .wrap {
      display: grid;
      grid-template-columns: 360px 1fr 380px;
      grid-template-rows: 64px 1fr;
      height: 100%;
    }

    header {
      grid-column: 1 / 4;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      border-bottom: 1px solid var(--line);
      background: rgba(18,24,36,0.6);
      backdrop-filter: blur(8px);
    }
    header h1 { font-size: 16px; margin: 0; font-weight: 650; letter-spacing: 0.2px; }
    header .sub { color: var(--muted); font-size: 12px; }

    .panel {
      border-right: 1px solid var(--line);
      padding: 14px;
      overflow: auto;
      background: var(--panel);
    }
    .panel.right { border-right: none; border-left: 1px solid var(--line); }

    #network {
      position: relative;
      overflow: hidden;
    }

    .card {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 12px;
      margin-bottom: 12px;
      background: rgba(255,255,255,0.03);
    }
    .card h2 { font-size: 13px; margin: 0 0 10px 0; }
    label { display: flex; align-items: center; gap: 10px; font-size: 13px; margin: 6px 0; color: var(--text); }
    input[type="checkbox"] { transform: scale(1.15); }

    .row { display: grid; grid-template-columns: 1fr; gap: 10px; }
    .btnbar { display: flex; gap: 8px; flex-wrap: wrap; }
    button {
      cursor: pointer;
      border: 1px solid var(--line);
      color: var(--text);
      background: rgba(255,255,255,0.04);
      padding: 8px 10px;
      border-radius: 10px;
      font-size: 12px;
    }
    button:hover { background: rgba(255,255,255,0.07); }

    input[type="text"] {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 13px;
      background: rgba(0,0,0,0.15);
      color: var(--text);
      outline: none;
    }

    input[type="range"] { width: 100%; }

    .kv { display: grid; grid-template-columns: 120px 1fr; gap: 8px; font-size: 12px; color: var(--muted); }
    .kv div:nth-child(odd) { color: var(--muted); }
    .kv div:nth-child(even) { color: var(--text); }

    .list {
      margin-top: 10px;
      border-top: 1px solid var(--line);
      padding-top: 10px;
    }
    .list .item {
      display: grid;
      grid-template-columns: 64px 1fr;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      font-size: 12px;
    }
    .pill {
      display: inline-block;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 11px;
      color: var(--muted);
    }
    .muted { color: var(--muted); font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1>Mappa concettuale — Digital Memorial</h1>
        <div class="sub">Grafo interattivo (categorie, registi, anni, generi, film, keyword)</div>
      </div>
      <div class="sub">
        <a href="../">← Torna al memoriale</a>
      </div>
    </header>

    <aside class="panel">
      <div class="card">
        <h2>Ricerca</h2>
        <input id="search" type="text" placeholder="Cerca un nodo (es. 'Kubrick', 'Patreon', '2023', 'horror')…" />
        <div class="muted" style="margin-top:8px;">Tip: invio per focussare sul primo match.</div>
      </div>

      <div class="card">
        <h2>Filtri nodi</h2>
        <label><input type="checkbox" data-group="category" checked />Categorie</label>
        <label><input type="checkbox" data-group="director" checked />Registi</label>
        <label><input type="checkbox" data-group="year" checked />Anni</label>
        <label><input type="checkbox" data-group="genre" checked />Generi</label>
        <label><input type="checkbox" data-group="film" checked />Film</label>
        <label><input type="checkbox" data-group="keyword" checked />Keyword</label>
      </div>

      <div class="card">
        <h2>Soglia archi</h2>
        <div class="muted">Mostra solo connessioni con peso ≥ <span id="minEdgeLabel">2</span></div>
        <input id="minEdge" type="range" min="1" max="50" value="2" />
      </div>

      <div class="card">
        <h2>Controlli</h2>
        <div class="btnbar">
          <button id="togglePhysics">Pausa fisica</button>
          <button id="fit">Fit</button>
          <button id="reset">Reset</button>
        </div>
      </div>

      <div class="card">
        <h2>Legenda rapida</h2>
        <div class="muted">Clicca un nodo per vedere dettagli e video collegati.</div>
      </div>
    </aside>

    <main id="network"></main>

    <aside class="panel right">
      <div class="card">
        <h2>Dettagli</h2>
        <div id="details" class="muted">Seleziona un nodo…</div>
      </div>

      <div class="card">
        <h2>Info build</h2>
        <div id="meta" class="muted">Caricamento…</div>
      </div>
    </aside>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
  <script src="./app.js"></script>
</body>
</html>
"""

JS_TEMPLATE = r"""/* global vis */
(async function () {
  const res = await fetch("./graph.json", { cache: "no-store" });
  const graph = await res.json();

  const metaEl = document.getElementById("meta");
  metaEl.innerHTML = `
    <div class="kv">
      <div>Generato</div><div>${new Date(graph.meta.generated_at).toUTCString()}</div>
      <div>Video</div><div>${graph.meta.videos_total.toLocaleString("it-IT")}</div>
      <div>Nodi</div><div>${graph.meta.nodes_total.toLocaleString("it-IT")}</div>
      <div>Archi</div><div>${graph.meta.edges_total.toLocaleString("it-IT")}</div>
    </div>
  `;

  const nodesIndex = new Map(graph.nodes.map(n => [n.id, n]));
  const edgesAll = graph.edges;

  const nodesDS = new vis.DataSet([]);
  const edgesDS = new vis.DataSet([]);

  const container = document.getElementById("network");

  const options = {
    nodes: {
      shape: "dot",
      font: { color: "#e7eefc" },
      borderWidth: 1,
    },
    edges: {
      smooth: { type: "dynamic" },
      color: { color: "rgba(255,255,255,0.25)", highlight: "rgba(122,162,255,0.9)" },
    },
    groups: {
      root:     { shape: "star",  size: 22 },
      category: { size: 14 },
      director: { size: 13 },
      year:     { size: 12 },
      genre:    { size: 12 },
      film:     { size: 12 },
      keyword:  { size: 11 },
    },
    physics: {
      enabled: true,
      solver: "forceAtlas2Based",
      stabilization: { iterations: 800, updateInterval: 40 },
      forceAtlas2Based: {
        gravitationalConstant: -40,
        centralGravity: 0.01,
        springLength: 110,
        springConstant: 0.10,
        damping: 0.35,
        avoidOverlap: 0.6
      }
    },
    interaction: {
      hover: true,
      tooltipDelay: 120,
      navigationButtons: true,
      keyboard: true
    }
  };

  const network = new vis.Network(container, { nodes: nodesDS, edges: edgesDS }, options);

  // --- filtering ---
  const groupChecks = Array.from(document.querySelectorAll('input[type="checkbox"][data-group]'));
  const minEdge = document.getElementById("minEdge");
  const minEdgeLabel = document.getElementById("minEdgeLabel");
  const search = document.getElementById("search");

  function getAllowedGroups() {
    const allowed = new Set(["root"]);
    for (const c of groupChecks) {
      if (c.checked) allowed.add(c.dataset.group);
    }
    return allowed;
  }

  function applyFilters() {
    const allowedGroups = getAllowedGroups();
    const minW = Number(minEdge.value || 1);
    minEdgeLabel.textContent = String(minW);

    const filteredNodes = graph.nodes.filter(n => allowedGroups.has(n.group));
    const allowedIds = new Set(filteredNodes.map(n => n.id));

    const filteredEdges = edgesAll.filter(e =>
      e.value >= minW && allowedIds.has(e.from) && allowedIds.has(e.to)
    );

    nodesDS.clear();
    edgesDS.clear();
    nodesDS.add(filteredNodes);
    edgesDS.add(filteredEdges);
  }

  groupChecks.forEach(c => c.addEventListener("change", applyFilters));
  minEdge.addEventListener("input", applyFilters);

  applyFilters();

  // --- details sidebar ---
  const details = document.getElementById("details");

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
  }

  function renderNodeDetails(node) {
    if (!node) {
      details.textContent = "Seleziona un nodo…";
      return;
    }

    const header = `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <div>
        <div style="font-size:14px;font-weight:650;">${escapeHtml(node.label)}</div>
        <div class="muted">Tipo: <span class="pill">${escapeHtml(node.group)}</span> · Conteggio: <b>${(node.count || 0).toLocaleString("it-IT")}</b></div>
      </div>
    </div>`;

    let extra = "";
    if (node.group === "film" && node.film_year) extra += `<div class="muted" style="margin-top:8px;">Anno film: <b>${escapeHtml(node.film_year)}</b></div>`;
    if (node.group === "category" && node.cat_id) extra += `<div class="muted" style="margin-top:8px;">ID categoria: <b>${escapeHtml(node.cat_id)}</b></div>`;
    if (node.group === "year" && node.year) extra += `<div class="muted" style="margin-top:8px;">Anno: <b>${escapeHtml(node.year)}</b></div>`;
    if (node.group === "director" && node.director) extra += `<div class="muted" style="margin-top:8px;">Regista: <b>${escapeHtml(node.director)}</b></div>`;

    let list = "";
    const vids = node.videos || [];
    if (vids.length) {
      list += `<div class="list">
        <div class="muted" style="margin-bottom:6px;">Video collegati (campione):</div>
        ${vids.slice(0, 30).map(v => {
          const url = `https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}`;
          const d = v.d ? escapeHtml(v.d) : "";
          return `<div class="item">
            <div class="muted">${d || ""}</div>
            <div>
              <a href="${url}" target="_blank" rel="noreferrer">${escapeHtml(v.t || v.id)}</a>
              <div class="muted">${escapeHtml(v.id)}</div>
            </div>
          </div>`;
        }).join("")}
      </div>`;
    } else {
      list += `<div class="muted" style="margin-top:10px;">Nessun elenco video disponibile per questo tipo nodo.</div>`;
    }

    details.innerHTML = header + extra + list;
  }

  network.on("click", (params) => {
    if (params.nodes && params.nodes.length) {
      const id = params.nodes[0];
      renderNodeDetails(nodesIndex.get(id));
    }
  });

  // --- search ---
  function findMatch(q) {
    q = (q || "").trim().toLowerCase();
    if (!q) return null;
    for (const n of graph.nodes) {
      if ((n.label || "").toLowerCase().includes(q)) return n;
    }
    return null;
  }

  function focusNodeByQuery(q) {
    const n = findMatch(q);
    if (!n) return;
    // ensure node is present after filters (if not, enable its group)
    const groupCheck = groupChecks.find(c => c.dataset.group === n.group);
    if (groupCheck && !groupCheck.checked) {
      groupCheck.checked = true;
      applyFilters();
    }

    // select + focus
    network.selectNodes([n.id]);
    network.focus(n.id, { scale: 1.2, animation: { duration: 450, easingFunction: "easeInOutQuad" } });
    renderNodeDetails(nodesIndex.get(n.id));
  }

  search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      focusNodeByQuery(search.value);
    }
  });

  // --- controls ---
  const btnPhysics = document.getElementById("togglePhysics");
  const btnFit = document.getElementById("fit");
  const btnReset = document.getElementById("reset");

  let physicsOn = true;
  btnPhysics.addEventListener("click", () => {
    physicsOn = !physicsOn;
    network.setOptions({ physics: { enabled: physicsOn } });
    btnPhysics.textContent = physicsOn ? "Pausa fisica" : "Riprendi fisica";
  });

  btnFit.addEventListener("click", () => network.fit({ animation: { duration: 450 } }));

  btnReset.addEventListener("click", () => {
    // reset filters
    groupChecks.forEach(c => c.checked = true);
    minEdge.value = 2;
    applyFilters();
    network.fit({ animation: { duration: 450 } });
    details.textContent = "Seleziona un nodo…";
    search.value = "";
    physicsOn = true;
    network.setOptions({ physics: { enabled: true } });
    btnPhysics.textContent = "Pausa fisica";
  });

})();
"""


# ----------------------------
# Home patching
# ----------------------------

def patch_home(home_path: Path, link_rel: str = "concept_map/") -> bool:
    if not home_path.exists():
        return False

    txt = safe_read_text(home_path)

    # avoid duplicates
    if link_rel in txt or "Mappa concettuale" in txt:
        return False

    # if it looks like HTML
    if "<html" in txt.lower() or "<body" in txt.lower():
        insert = f'\n<p>➡️ <a href="{link_rel}">Mappa concettuale</a></p>\n'
        if "</body>" in txt.lower():
            # insert before closing body (case-insensitive)
            m = re.search(r"</body\s*>", txt, flags=re.IGNORECASE)
            if m:
                txt = txt[:m.start()] + insert + txt[m.start():]
            else:
                txt += insert
        else:
            txt += insert
    else:
        # treat as markdown/plain
        txt = txt.rstrip() + f"\n\n➡️ [Mappa concettuale]({link_rel})\n"

    home_path.write_text(txt, encoding="utf-8")
    return True


# ----------------------------
# Main
# ----------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description="Build an interactive concept map under docs/concept_map/")
    ap.add_argument("--repo", default=".", help="Repo root (default: .)")
    ap.add_argument("--index", default=None, help="Path to index.json (default: auto-detect, usually docs/data/index.json)")
    ap.add_argument("--out", default="docs/concept_map", help="Output folder (default: docs/concept_map)")
    ap.add_argument("--build-index-py", default="build_index.py", help="Path to build_index.py (for director->genres parsing)")

    ap.add_argument("--min-director-count", type=int, default=3, help="Keep directors with at least this many videos (default: 3)")
    ap.add_argument("--min-film-count", type=int, default=3, help="Keep films mentioned at least this many times (default: 3)")
    ap.add_argument("--top-films", type=int, default=250, help="Max number of film nodes (default: 250)")
    ap.add_argument("--top-keywords-per-category", type=int, default=12, help="Keywords per category (default: 12)")
    ap.add_argument("--min-keyword-count", type=int, default=5, help="Minimum keyword frequency (default: 5)")
    ap.add_argument("--min-edge-weight", type=int, default=2, help="Minimum edge weight to include in graph.json (default: 2)")
    ap.add_argument("--max-videos-per-node", type=int, default=30, help="Max example videos stored per node (default: 30)")

    ap.add_argument("--patch-home", action="store_true", help="Patch docs/index.html to add a link to concept map")
    args = ap.parse_args()

    repo_root = Path(args.repo).resolve()

    index_path = pick_index_json(repo_root, Path(args.index) if args.index else None)
    print(f"[OK] index.json: {index_path}")

    videos = load_catalog(index_path)
    if not videos:
        print("[ERR] Catalog vuoto: index.json non contiene elementi utili.")
        return 2

    build_index_path = repo_root / args.build_index_py
    director_genres = parse_director_genres_from_build_index(build_index_path)

    graph = build_graph(
        videos,
        director_genres,
        min_director_count=args.min_director_count,
        min_film_count=args.min_film_count,
        top_films=args.top_films,
        top_keywords_per_category=args.top_keywords_per_category,
        min_keyword_count=args.min_keyword_count,
        min_edge_weight=args.min_edge_weight,
        max_videos_per_node=args.max_videos_per_node,
    )

    out_dir = (repo_root / args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    (out_dir / "index.html").write_text(HTML_TEMPLATE, encoding="utf-8")
    (out_dir / "app.js").write_text(JS_TEMPLATE, encoding="utf-8")
    (out_dir / "graph.json").write_text(json.dumps(graph, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[OK] Wrote: {out_dir / 'index.html'}")
    print(f"[OK] Wrote: {out_dir / 'app.js'}")
    print(f"[OK] Wrote: {out_dir / 'graph.json'}")

    if args.patch_home:
        home = repo_root / "docs" / "index.html"
        changed = patch_home(home, link_rel="concept_map/")
        if changed:
            print(f"[OK] Patched home: {home}")
        else:
            print(f"[SKIP] Home not patched (already contains link or missing): {home}")

    print("\n--- Preview locale ---")
    print("1) cd docs")
    print("2) python -m http.server 8000")
    print("3) apri: http://localhost:8000/concept_map/")

    print("\n--- Pubblicazione ---")
    print("git add docs/concept_map" + (" docs/index.html" if args.patch_home else ""))
    print('git commit -m "Add interactive concept map"')
    print("git push")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())