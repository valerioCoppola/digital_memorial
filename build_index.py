#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════
  FEDERICO FRUSCIANTE MEMORIAL — Build Pipeline v2 (Ottimizzato)
  Genera file compatti raggruppati per anno
═══════════════════════════════════════════════════════════════
"""

import os
import re
import json
import argparse
import shutil
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime

CATEGORY_RULES = [
    (r"Le Monografie", "monografie", "Le Monografie"),
    (r"Le Recensioni.*Meglio e Peggio", "recensioni_annuali", "Meglio e Peggio"),
    (r"Le Recensioni", "recensioni", "Le Recensioni"),
    (r"Consigli [Mm]usicali", "musicali", "Consigli Musicali"),
    (r"Reboot di Frusciante", "reboot", "Reboot di Frusciante"),
    (r"[Ww]orst|[Pp]eggio", "worst", "I Peggiori"),
    (r"SciFi|Sci-Fi|Fantascienza", "scifi", "SciFi & Generi"),
    (r"Speciale|Natale|Capodanno|Pasqua|1[°º] Maggio|Ferragosto|Halloween", "speciali", "Speciali"),
    (r"I [Cc]onsigli di Frusciante", "consigli", "I Consigli di Frusciante"),
    (r"Top\s?\d+", "classifiche", "Classifiche"),
    (r"[Ii]ntervista", "interviste", "Interviste"),
    (r"Criticoni", "criticoni", "I Criticoni"),
    (r"Live|Diretta", "live", "Live & Dirette"),
]

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
]

DIRECTOR_GENRES = {
    "Dario Argento": ["Horror", "Giallo", "Italian"],
    "Lucio Fulci": ["Horror", "Giallo", "Italian"],
    "Mario Bava": ["Horror", "Giallo", "Italian"],
    "Ruggero Deodato": ["Horror", "Italian", "Cult"],
    "George A. Romero": ["Horror", "Indie"],
    "John Carpenter": ["Horror", "Sci-Fi", "Cult"],
    "Wes Craven": ["Horror"],
    "Sam Raimi": ["Horror", "Cult", "Comedy"],
    "David Cronenberg": ["Horror", "Sci-Fi", "Auteur"],
    "David Lynch": ["Auteur", "Horror", "Surrealism"],
    "Stanley Kubrick": ["Auteur", "Sci-Fi", "Horror"],
    "Martin Scorsese": ["Auteur", "Crime"],
    "Quentin Tarantino": ["Auteur", "Crime", "Cult"],
    "James Cameron": ["Sci-Fi", "Action"],
    "Ridley Scott": ["Sci-Fi", "Auteur"],
    "Woody Allen": ["Auteur", "Comedy"],
    "Joe Dante": ["Horror", "Comedy", "Cult"],
    "Steven Spielberg": ["Auteur", "Sci-Fi", "Adventure"],
    "Tim Burton": ["Fantasy", "Auteur"],
    "Guillermo del Toro": ["Horror", "Fantasy", "Auteur"],
    "Christopher Nolan": ["Sci-Fi", "Auteur"],
    "Denis Villeneuve": ["Sci-Fi", "Auteur"],
    "Jordan Peele": ["Horror", "Auteur"],
    "Ari Aster": ["Horror", "Auteur"],
}


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
    for pattern, cat_id, cat_label in CATEGORY_RULES:
        if re.search(pattern, title, re.IGNORECASE):
            return cat_id, cat_label
    return "altro", "Altro"


def extract_director(title):
    for director in KNOWN_DIRECTORS:
        if director.lower() in title.lower():
            return director
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


def process_transcripts(input_dir, output_dir):
    input_path = Path(input_dir)
    output_path = Path(output_dir)

    if output_path.exists():
        shutil.rmtree(output_path)
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"  FEDERICO FRUSCIANTE MEMORIAL — Build v2")
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

    catalog = []
    directors_count = Counter()
    yearly_count = Counter()
    category_count = Counter()
    yearly_transcripts = defaultdict(dict)
    total_words = 0

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

    # 1. INDEX (lightweight catalog, no text)
    (output_path / "index.json").write_text(
        json.dumps({"total": len(catalog), "catalog": catalog},
                   ensure_ascii=False, separators=(',', ':')),
        encoding='utf-8'
    )
    idx_mb = (output_path / "index.json").stat().st_size / 1024 / 1024
    print(f"  [OK] index.json ({idx_mb:.1f} MB)")

    # 2. TRANSCRIPTS BY YEAR (one file per year)
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

    # === REPORT ===
    total_mb = sum(f.stat().st_size for f in output_path.rglob("*") if f.is_file()) / 1024 / 1024
    file_count = sum(1 for _ in output_path.rglob('*') if _.is_file())

    print(f"\n{'='*60}")
    print(f"  BUILD COMPLETATA!")
    print(f"{'='*60}")
    print(f"\n  Video totali:         {len(catalog)}")
    print(f"  Parole totali:        {total_words:,}")
    print(f"  Registi identificati: {len(directors_count)}")
    print(f"  Categorie:            {len(category_count)}")
    print(f"\n  DIMENSIONE OUTPUT:    {total_mb:.1f} MB")
    print(f"  FILE GENERATI:        {file_count}")
    print(f"\n  Per anno:")
    for year in sorted(yearly_count.keys()):
        count = yearly_count[year]
        size = transcript_sizes.get(year, 0)
        bar = "█" * min(count // 8, 40)
        print(f"    {year}: {bar} {count} video ({size:.1f} MB)")
    print(f"\n  Top categorie:")
    for cat, count in category_count.most_common(10):
        print(f"    {cat:25s} {count:4d}")
    print(f"\n  Top registi:")
    for d, c in directors_count.most_common(10):
        print(f"    {d:25s} {c:4d}")
    print(f"\n{'='*60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", "-i", default="data/transcripts")
    parser.add_argument("--output", "-o", default="site/data")
    args = parser.parse_args()
    if not Path(args.input).exists():
        print(f"\n  ERRORE: '{args.input}' non esiste!\n")
        exit(1)
    process_transcripts(args.input, args.output)
