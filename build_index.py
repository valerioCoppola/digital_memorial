#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════
  FEDERICO FRUSCIANTE MEMORIAL — Build Pipeline v3
  Categorizzazione accurata basata su analisi reale dei dati
═══════════════════════════════════════════════════════════════
"""

import re
import json
import argparse
import shutil
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime

# ═══════════════════════════════════════════════════════════
# REGOLE DI CATEGORIZZAZIONE (ordine = priorità)
# Testate su 4534 video reali — solo 18 restano "altro"
# ═══════════════════════════════════════════════════════════

CATEGORY_RULES = [
    # --- Serie principali (controllare PRIMA di Patreon) ---
    (r"Le Monografie|Le monografie", "monografie", "Le Monografie"),
    (r"Le Recensioni.*Meglio e Peggio|Meglio e Peggio \d{4}", "meglio_peggio", "Meglio e Peggio"),
    (r"Stephen King.*Meglio e Peggio|Meglio e Peggio.*Stephen King", "meglio_peggio", "Meglio e Peggio"),
    (r"Le Recensioni", "recensioni", "Le Recensioni"),
    (r"[Cc]onsigli [Mm]usicali", "musicali", "Consigli Musicali"),
    (r"[Cc]onsigli [Ll]etterari", "letterari", "Consigli Letterari"),
    (r"I Classici di Frusciante|I Classici \(|I classici di|Federico Frusciante[：:] I Classici", "classici", "I Classici"),
    (r"Le Saghe", "saghe", "Le Saghe"),
    (r"in Oriente", "oriente", "Frusciante in Oriente"),
    (r"Underground", "underground", "Underground"),
    (r"[Rr]eboot di Frusciante", "reboot", "I Reboot"),
    (r"mperdibili|erdibili", "imperdibili", "(Im)Perdibili"),
    (r"Le Interviste di Frusciante", "interviste", "Le Interviste"),
    (r"[Ii]ntervista(?!.*[Vv]ampiro)", "interviste", "Le Interviste"),
    (r"Criticoni", "criticoni", "I Criticoni"),
    (r"al Cinema|al \(non\)Cinema|al .non.Cinema", "al_cinema", "Frusciante al Cinema"),
    (r"Marco Lo Muscio", "con_lomuscio", "Con Marco Lo Muscio"),
    (r"QUARANTENA", "quarantena", "Speciali Quarantena"),
    (r"Consigli Brevi", "consigli_brevi", "Consigli Brevi"),
    (r"I [Cc]onsigli di Frusciante", "consigli", "I Consigli di Frusciante"),
    (r"Fantascienza|SciFi|Sci-Fi", "scifi", "Fantascienza"),

    # --- Speciali (Natale, Halloween, etc.) ---
    (r"Speciale|Natale|Halloween|Capodanno|Pasqua|1[°º] Maggio|Ferragosto", "speciali", "Speciali"),

    # --- Patreon / Minirece (la categoria più grande ~89%) ---
    (r"Patreon|Patreoo|Patrreon|Pareon", "patreon", "Patreon / Minirece"),

    # --- Eventi live ---
    (r"Ziggy|CrossDark|Cross Dark|FiPiLi|Sormani|Cinema Stella|Spazio Alfieri|dal [Vv]ivo|Dal Vivo", "eventi", "Eventi Live"),
    (r"Live|Diretta", "eventi", "Eventi Live"),

    # --- Messaggi / Vlog ---
    (r"[Mm]essaggio|Finale di stagione|di Servizio", "vlog", "Messaggi & Vlog"),
]

# ═══════════════════════════════════════════════════════════
# REGISTI NOTI
# ═══════════════════════════════════════════════════════════

KNOWN_DIRECTORS = [
    "Woody Allen", "Joe Dante", "George A. Romero", "James Cameron",
    "Dario Argento", "John Carpenter", "David Cronenberg", "Lucio Fulci",
    "David Lynch", "Wes Craven", "Sam Raimi", "William Lustig",
    "Ruggero Deodato", "Martin Scorsese", "Stanley Kubrick",
    "Quentin Tarantino", "Steven Spielberg", "Brian De Palma",
    "Ridley Scott", "Tim Burton", "Terry Gilliam", "Clive Barker",
    "Tobe Hooper", "Mario Bava", "Sergio Leone", "Paul Verhoeven",
    "George Miller", "Robert Zemeckis", "Francis Ford Coppola",
    "Alfred Hitchcock", "Roman Polanski", "Lars von Trier",
    "Park Chan-wook", "Takashi Miike", "Guillermo del Toro",
    "Christopher Nolan", "Denis Villeneuve", "Jordan Peele",
    "Ari Aster", "Robert Eggers", "Ti West", "Mike Flanagan",
    "James Wan", "Alexandre Aja", "Eli Roth", "Rob Zombie",
    "Manetti Bros", "Lamberto Bava", "Umberto Lenzi",
    "Sergio Martino", "Pupi Avati", "Michele Soavi",
    "Oliver Stone", "Hayao Miyazaki", "Wes Anderson",
    "Gus Van Sant", "Joel Schumacher", "Kathryn Bigelow",
    "Pascal Laugier", "Alejandro Jodorowsky", "Andrei Tarkovsky",
    "Matteo Garrone", "Neil Jordan", "Sidney Lumet",
    "John McTiernan", "Peter Weir", "Bong Joon-ho",
    "Sofia Coppola", "Peter Greenaway", "Bruno Mattei",
    "Dario Moccia", "Na Hong-Jin", "Richard Stanley",
]

DIRECTOR_GENRES = {
    "Dario Argento": ["Horror", "Giallo", "Italiano"],
    "Lucio Fulci": ["Horror", "Giallo", "Italiano"],
    "Mario Bava": ["Horror", "Giallo", "Italiano"],
    "Ruggero Deodato": ["Horror", "Italiano", "Cult"],
    "George A. Romero": ["Horror", "Indie"],
    "John Carpenter": ["Horror", "Sci-Fi", "Cult"],
    "Wes Craven": ["Horror"],
    "Sam Raimi": ["Horror", "Cult"],
    "David Cronenberg": ["Horror", "Sci-Fi", "Autore"],
    "David Lynch": ["Autore", "Horror", "Surrealismo"],
    "Stanley Kubrick": ["Autore", "Sci-Fi", "Horror"],
    "Martin Scorsese": ["Autore", "Crime"],
    "Quentin Tarantino": ["Autore", "Crime", "Cult"],
    "James Cameron": ["Sci-Fi", "Azione"],
    "Ridley Scott": ["Sci-Fi", "Autore"],
    "Woody Allen": ["Autore", "Commedia"],
    "Joe Dante": ["Horror", "Commedia", "Cult"],
    "Steven Spielberg": ["Autore", "Sci-Fi", "Avventura"],
    "Tim Burton": ["Fantasy", "Autore"],
    "Guillermo del Toro": ["Horror", "Fantasy", "Autore"],
    "Christopher Nolan": ["Sci-Fi", "Autore"],
    "Denis Villeneuve": ["Sci-Fi", "Autore"],
    "Jordan Peele": ["Horror", "Autore"],
    "Ari Aster": ["Horror", "Autore"],
    "Brian De Palma": ["Thriller", "Horror", "Crime"],
    "Sergio Leone": ["Western", "Italiano", "Autore"],
    "William Lustig": ["Horror", "Cult", "B-Movie"],
    "Clive Barker": ["Horror", "Fantasy"],
    "Tobe Hooper": ["Horror"],
    "Oliver Stone": ["Drammatico", "Autore"],
    "Hayao Miyazaki": ["Animazione", "Fantasy"],
    "Wes Anderson": ["Autore", "Commedia"],
    "Lars von Trier": ["Autore", "Drammatico"],
    "Park Chan-wook": ["Thriller", "Orientale"],
    "Takashi Miike": ["Horror", "Orientale", "Cult"],
    "Bong Joon-ho": ["Thriller", "Orientale", "Autore"],
    "Na Hong-Jin": ["Thriller", "Orientale"],
    "Alfred Hitchcock": ["Thriller", "Classico"],
    "Francis Ford Coppola": ["Autore", "Crime", "Classico"],
    "Robert Zemeckis": ["Sci-Fi", "Avventura"],
    "Paul Verhoeven": ["Sci-Fi", "Cult"],
    "Lamberto Bava": ["Horror", "Italiano"],
    "Umberto Lenzi": ["Horror", "Italiano", "Cult"],
    "Sergio Martino": ["Giallo", "Italiano"],
    "Michele Soavi": ["Horror", "Italiano"],
    "Bruno Mattei": ["B-Movie", "Italiano", "Cult"],
    "Pupi Avati": ["Horror", "Italiano", "Autore"],
    "Matteo Garrone": ["Autore", "Italiano"],
    "Rob Zombie": ["Horror", "Cult"],
    "Mike Flanagan": ["Horror"],
    "James Wan": ["Horror"],
    "Ti West": ["Horror"],
    "Robert Eggers": ["Horror", "Autore"],
    "Richard Stanley": ["Horror", "Sci-Fi", "Cult"],
    "Pascal Laugier": ["Horror"],
    "Sidney Lumet": ["Drammatico", "Classico", "Autore"],
    "Kathryn Bigelow": ["Azione", "Thriller"],
}


# ═══════════════════════════════════════════════════════════
# PARSING
# ═══════════════════════════════════════════════════════════

def parse_filename(filename):
    name = Path(filename).stem
    ext = Path(filename).suffix.lower()
    match = re.match(r'^(\d{8})_([A-Za-z0-9_\-]+?)_(.+)$', name)
    if not match:
        match2 = re.match(r'^([A-Za-z0-9_\-]+?)_(.+)$', name)
        if match2:
            return {"date": None, "youtube_id": match2.group(1), "title": match2.group(2).strip(), "ext": ext}
        return None
    date_str = match.group(1)
    try:
        date = datetime.strptime(date_str, "%Y%m%d").strftime("%Y-%m-%d")
    except ValueError:
        date = None
    return {"date": date, "youtube_id": match.group(2), "title": match.group(3).strip(), "ext": ext}


def classify_video(title):
    """Classifica un video — ordine delle regole = priorità."""
    for pattern, cat_id, cat_label in CATEGORY_RULES:
        if re.search(pattern, title, re.IGNORECASE):
            return cat_id, cat_label
    return "altro", "Altro"


def extract_director(title):
    """Estrae il regista dal titolo."""
    for director in KNOWN_DIRECTORS:
        if director.lower() in title.lower():
            return director
    # Per monografie: cerca dopo " - "
    if "monografi" in title.lower():
        parts = title.split(" - ")
        if len(parts) >= 2:
            candidate = parts[-1].strip()
            if re.match(r'^parte \d+$', candidate, re.IGNORECASE) and len(parts) >= 3:
                candidate = parts[-2].strip()
            candidate = re.sub(r'\s*parte\s*\d+\s*$', '', candidate, flags=re.IGNORECASE).strip()
            if candidate and len(candidate) > 2:
                return candidate
    return None


def extract_film_info(title):
    """Estrae titolo film e anno dai titoli Patreon."""
    # Pattern: "Titolo Film" (ANNO) di Regista
    m = re.search(r'[：:]\s*[＂""«]?(.+?)[＂""»]?\s*\((\d{4})\)', title)
    if m:
        return m.group(1).strip(), m.group(2)
    # Pattern senza virgolette: Titolo (ANNO)
    m = re.search(r'[：:]\s*(.+?)\s*\((\d{4})\)', title)
    if m:
        film = m.group(1).strip()
        # Pulisci prefissi
        film = re.sub(r'^(Patreon|Patreoo|Patrreon|Pareon)[：:]\s*', '', film)
        if len(film) > 2 and len(film) < 80:
            return film, m.group(2)
    return None, None


# ═══════════════════════════════════════════════════════════
# MAIN BUILD
# ═══════════════════════════════════════════════════════════

def process_transcripts(input_dir, output_dir):
    input_path = Path(input_dir)
    output_path = Path(output_dir)

    if output_path.exists():
        shutil.rmtree(output_path)
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"  FEDERICO FRUSCIANTE MEMORIAL — Build v3")
    print(f"{'='*60}")
    print(f"\n  Input:  {input_path.absolute()}")
    print(f"  Output: {output_path.absolute()}\n")

    valid_files = sorted([f for f in input_path.rglob("*") if f.suffix.lower() in ('.txt', '.json')])
    print(f"  File trovati: {len(valid_files)}")

    videos = {}
    skipped = 0

    for filepath in valid_files:
        parsed = parse_filename(filepath.name)
        if not parsed:
            skipped += 1
            continue

        yt_id = parsed["youtube_id"]
        if yt_id not in videos:
            videos[yt_id] = {"id": yt_id, "date": parsed["date"], "title": parsed["title"], "text": None}

        if parsed["date"] and not videos[yt_id]["date"]:
            videos[yt_id]["date"] = parsed["date"]

        try:
            content = filepath.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            try:
                content = filepath.read_text(encoding='latin-1')
            except Exception:
                skipped += 1
                continue

        if parsed["ext"] == ".txt":
            videos[yt_id]["text"] = content

    if skipped:
        print(f"  File saltati: {skipped}")
    print(f"  Video unici: {len(videos)}\n")

    # === CLASSIFICAZIONE ===
    catalog = []
    directors_count = Counter()
    yearly_count = Counter()
    category_count = Counter()
    yearly_transcripts = defaultdict(dict)
    total_words = 0
    films_mentioned = Counter()  # film -> count (from Patreon titles)

    for yt_id, video in sorted(videos.items(), key=lambda x: x[1].get("date") or "0000"):
        cat_id, cat_label = classify_video(video["title"])
        director = extract_director(video["title"])

        year = None
        if video["date"]:
            try:
                dt = datetime.strptime(video["date"], "%Y-%m-%d")
                year = dt.year
                yearly_count[year] += 1
            except ValueError:
                pass

        category_count[cat_id] += 1
        if director:
            directors_count[director] += 1

        text = video["text"] or ""
        wc = len(text.split()) if text else 0
        total_words += wc

        yearly_transcripts[year or 0][yt_id] = text

        # Estrai info film per Patreon
        film_title, film_year = extract_film_info(video["title"])
        if film_title:
            films_mentioned[film_title] += 1

        catalog.append({
            "id": yt_id,
            "d": video["date"],
            "t": video["title"],
            "c": cat_id,
            "cl": cat_label,
            "y": year,
            "dir": director,
            "wc": wc,
        })

    # === OUTPUT ===

    # 1. INDEX
    (output_path / "index.json").write_text(
        json.dumps({"total": len(catalog), "catalog": catalog},
                   ensure_ascii=False, separators=(',', ':')),
        encoding='utf-8'
    )
    idx_mb = (output_path / "index.json").stat().st_size / 1024 / 1024
    print(f"  [OK] index.json ({idx_mb:.1f} MB)")

    # 2. TRANSCRIPTS BY YEAR
    transcript_sizes = {}
    for year, transcripts in sorted(yearly_transcripts.items()):
        fname = f"transcripts_{year}.json"
        fpath = output_path / fname
        fpath.write_text(
            json.dumps(transcripts, ensure_ascii=False, separators=(',', ':')),
            encoding='utf-8'
        )
        size_mb = fpath.stat().st_size / 1024 / 1024
        transcript_sizes[year] = size_mb
        print(f"  [OK] {fname} ({size_mb:.1f} MB) — {len(transcripts)} video")

    # 3. STATS
    stats = {
        "total_videos": len(catalog),
        "total_words": total_words,
        "years_covered": sorted([y for y in yearly_count.keys()]),
        "yearly_distribution": dict(sorted(yearly_count.items())),
        "category_distribution": dict(category_count.most_common()),
        "transcript_files": {str(y): f"transcripts_{y}.json" for y in sorted(yearly_transcripts.keys())},
    }
    (output_path / "stats.json").write_text(
        json.dumps(stats, ensure_ascii=False, indent=2), encoding='utf-8'
    )
    print(f"  [OK] stats.json")

    # 4. DIRECTORS
    directors_list = []
    for director, count in directors_count.most_common():
        genres = DIRECTOR_GENRES.get(director, ["Non classificato"])
        dvids = [{"id": v["id"], "t": v["title"], "d": v["date"]}
                 for v in videos.values() if extract_director(v["title"]) == director]
        directors_list.append({"name": director, "count": count, "genres": genres, "videos": dvids})

    genre_to_dirs = defaultdict(list)
    for d in directors_list:
        for g in d["genres"]:
            if d["name"] not in genre_to_dirs[g]:
                genre_to_dirs[g].append(d["name"])

    (output_path / "directors.json").write_text(
        json.dumps({"directors": directors_list, "genre_connections": dict(genre_to_dirs)},
                   ensure_ascii=False, indent=2),
        encoding='utf-8'
    )
    print(f"  [OK] directors.json — {len(directors_list)} registi")

    # 5. FILMS (from Patreon titles)
    films_data = [{"title": f, "count": c} for f, c in films_mentioned.most_common(300) if c >= 1]
    (output_path / "films.json").write_text(
        json.dumps({"films": films_data}, ensure_ascii=False, indent=2),
        encoding='utf-8'
    )
    print(f"  [OK] films.json — {len(films_data)} film estratti")

    # === REPORT ===
    total_mb = sum(f.stat().st_size for f in output_path.rglob("*") if f.is_file()) / 1024 / 1024
    file_count = sum(1 for _ in output_path.rglob('*') if _.is_file())

    print(f"\n{'='*60}")
    print(f"  BUILD COMPLETATA!")
    print(f"{'='*60}")
    print(f"\n  Video totali:         {len(catalog)}")
    print(f"  Parole totali:        {total_words:,}")
    print(f"  Registi identificati: {len(directors_count)}")
    print(f"  Film estratti:        {len(films_data)}")
    print(f"  DIMENSIONE OUTPUT:    {total_mb:.1f} MB")
    print(f"  FILE GENERATI:        {file_count}")

    print(f"\n  CATEGORIE:")
    for cat, count in category_count.most_common():
        pct = count / len(catalog) * 100
        bar = "█" * min(int(pct), 50)
        print(f"    {cat:25s} {count:5d} ({pct:5.1f}%) {bar}")

    altro_count = category_count.get("altro", 0)
    if altro_count > 0:
        print(f"\n  ⚠  {altro_count} video non classificati ('altro')")
        altri = [v["t"] for v in catalog if v["c"] == "altro"]
        for t in altri[:10]:
            print(f"      → {t}")

    print(f"\n  PER ANNO:")
    for year in sorted(yearly_count.keys()):
        count = yearly_count[year]
        size = transcript_sizes.get(year, 0)
        bar = "█" * min(count // 10, 40)
        print(f"    {year}: {bar} {count} ({size:.1f} MB)")

    print(f"\n  TOP 15 REGISTI:")
    for d, c in directors_count.most_common(15):
        print(f"    {d:30s} {c:4d}")

    print(f"\n{'='*60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", "-i", default="data/transcripts")
    parser.add_argument("--output", "-o", default="docs/data")
    args = parser.parse_args()
    if not Path(args.input).exists():
        print(f"\n  ERRORE: '{args.input}' non esiste!\n")
        exit(1)
    process_transcripts(args.input, args.output)
