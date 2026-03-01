#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════
  FEDERICO FRUSCIANTE MEMORIAL — Build Pipeline
  Processa tutte le trascrizioni e genera i dati per il sito
═══════════════════════════════════════════════════════════════

USO:
  python build_index.py --input data/transcripts --output site/data

Questo script:
  1. Scansiona tutti i file .json e .txt nella cartella trascrizioni
  2. Estrae data, YouTube ID, titolo, categoria dal nome file
  3. Legge il contenuto di ogni trascrizione
  4. Genera un indice master (index.json) per il catalogo
  5. Genera file individuali per ogni trascrizione (per caricamento lazy)
  6. Genera statistiche e mappe concettuali automatiche
  7. Genera la lista registi, film citati, e connessioni
"""

import os
import re
import json
import argparse
import hashlib
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime


# ═══════════════════════════════════════════════════════════
# CONFIGURAZIONE CATEGORIE
# ═══════════════════════════════════════════════════════════

CATEGORY_RULES = [
    # (pattern nel titolo, categoria_id, etichetta)
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

# Registi noti per il riconoscimento automatico nelle monografie
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

# Generi per le connessioni
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


# ═══════════════════════════════════════════════════════════
# PARSING DEI NOMI FILE
# ═══════════════════════════════════════════════════════════

def parse_filename(filename):
    """
    Estrae informazioni dal nome file.
    Pattern: YYYYMMDD_YouTubeID_Titolo.ext
    Esempio: 20141023_WZVnQNsfQe4_Le Monografie di Frusciante - Woody Allen - parte 1.json
    """
    name = Path(filename).stem
    ext = Path(filename).suffix.lower()

    # Pattern principale: data_id_titolo
    match = re.match(r'^(\d{8})_([A-Za-z0-9_\-]+?)_(.+)$', name)
    if not match:
        # Fallback: prova senza data
        match2 = re.match(r'^([A-Za-z0-9_\-]+?)_(.+)$', name)
        if match2:
            return {
                "date": None,
                "youtube_id": match2.group(1),
                "title": match2.group(2).strip(),
                "ext": ext,
            }
        return None

    date_str = match.group(1)
    yt_id = match.group(2)
    title = match.group(3).strip()

    # Parsa la data
    try:
        date = datetime.strptime(date_str, "%Y%m%d").strftime("%Y-%m-%d")
    except ValueError:
        date = None

    return {
        "date": date,
        "youtube_id": yt_id,
        "title": title,
        "ext": ext,
    }


def classify_video(title):
    """Classifica un video in base al titolo."""
    for pattern, cat_id, cat_label in CATEGORY_RULES:
        if re.search(pattern, title, re.IGNORECASE):
            return cat_id, cat_label
    return "altro", "Altro"


def extract_director(title):
    """Estrae il nome del regista dal titolo (per le monografie)."""
    # Cerca direttamente nei registi noti
    for director in KNOWN_DIRECTORS:
        if director.lower() in title.lower():
            return director

    # Prova a estrarre dopo " - " nelle monografie
    if "monografie" in title.lower() or "monografia" in title.lower():
        parts = title.split(" - ")
        if len(parts) >= 2:
            # L'ultima parte (o la penultima se c'è "parte X") è spesso il regista
            candidate = parts[-1].strip()
            if re.match(r'^parte \d+$', candidate, re.IGNORECASE) and len(parts) >= 3:
                candidate = parts[-2].strip()
            # Pulisci
            candidate = re.sub(r'\s*parte\s*\d+\s*$', '', candidate, flags=re.IGNORECASE).strip()
            if candidate and len(candidate) > 2:
                return candidate

    return None


def extract_films_from_text(text):
    """
    Prova ad estrarre titoli di film dal testo della trascrizione.
    Euristica: cerca pattern comuni come titoli tra virgolette o dopo parole chiave.
    """
    films = set()

    # Film tra virgolette
    quoted = re.findall(r'[""«]([^""»]{3,60})[""»]', text)
    for q in quoted:
        # Filtra cose che non sembrano titoli di film
        if not re.search(r'^(https?|www\.|@|#)', q) and len(q.split()) <= 8:
            films.add(q.strip())

    return list(films)[:50]  # Max 50 per video


# ═══════════════════════════════════════════════════════════
# PROCESSING PRINCIPALE
# ═══════════════════════════════════════════════════════════

def process_transcripts(input_dir, output_dir):
    """Processa tutte le trascrizioni e genera i file per il sito."""

    input_path = Path(input_dir)
    output_path = Path(output_dir)

    # Crea directory di output
    output_path.mkdir(parents=True, exist_ok=True)
    (output_path / "transcripts").mkdir(exist_ok=True)

    print(f"\n{'═' * 60}")
    print(f"  FEDERICO FRUSCIANTE MEMORIAL — Build Pipeline")
    print(f"{'═' * 60}")
    print(f"\n  Input:  {input_path.absolute()}")
    print(f"  Output: {output_path.absolute()}\n")

    # Raccogli tutti i file
    all_files = sorted(input_path.rglob("*"))
    txt_files = [f for f in all_files if f.suffix.lower() == '.txt']
    json_files = [f for f in all_files if f.suffix.lower() == '.json']

    print(f"  Trovati {len(txt_files)} file .txt")
    print(f"  Trovati {len(json_files)} file .json")
    print()

    # Raggruppa per YouTube ID
    videos = {}  # yt_id -> { info... }

    # Prima passa: raccogli metadati da tutti i file
    for filepath in all_files:
        if filepath.suffix.lower() not in ('.txt', '.json'):
            continue

        parsed = parse_filename(filepath.name)
        if not parsed:
            print(f"  ⚠ Non riesco a parsare: {filepath.name}")
            continue

        yt_id = parsed["youtube_id"]

        if yt_id not in videos:
            videos[yt_id] = {
                "id": yt_id,
                "date": parsed["date"],
                "title": parsed["title"],
                "category": None,
                "category_label": None,
                "director": None,
                "transcript_text": None,
                "metadata_json": None,
                "films_mentioned": [],
                "year": None,
                "month": None,
            }

        # Aggiorna info
        if parsed["date"] and not videos[yt_id]["date"]:
            videos[yt_id]["date"] = parsed["date"]

        # Leggi contenuto
        try:
            content = filepath.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            try:
                content = filepath.read_text(encoding='latin-1')
            except Exception:
                print(f"  ⚠ Errore lettura: {filepath.name}")
                continue

        if parsed["ext"] == ".txt":
            videos[yt_id]["transcript_text"] = content
        elif parsed["ext"] == ".json":
            try:
                videos[yt_id]["metadata_json"] = json.loads(content)
            except json.JSONDecodeError:
                # Potrebbe essere testo raw salvato come .json
                videos[yt_id]["metadata_json"] = {"raw": content}

    print(f"  Video unici trovati: {len(videos)}\n")

    # Seconda passa: classifica e arricchisci
    stats = defaultdict(int)
    directors_count = Counter()
    yearly_count = Counter()
    category_count = Counter()
    all_films = Counter()

    catalog = []

    for yt_id, video in sorted(videos.items(), key=lambda x: x[1].get("date") or ""):
        # Classifica
        cat_id, cat_label = classify_video(video["title"])
        video["category"] = cat_id
        video["category_label"] = cat_label
        category_count[cat_id] += 1

        # Estrai anno/mese
        if video["date"]:
            try:
                dt = datetime.strptime(video["date"], "%Y-%m-%d")
                video["year"] = dt.year
                video["month"] = dt.month
                yearly_count[dt.year] += 1
            except ValueError:
                pass

        # Estrai regista (per monografie)
        director = extract_director(video["title"])
        if director:
            video["director"] = director
            directors_count[director] += 1

        # Estrai film menzionati dal testo
        if video["transcript_text"]:
            video["films_mentioned"] = extract_films_from_text(video["transcript_text"])
            for film in video["films_mentioned"]:
                all_films[film] += 1

        # Calcola lunghezza trascrizione
        text_len = len(video["transcript_text"]) if video["transcript_text"] else 0
        word_count = len(video["transcript_text"].split()) if video["transcript_text"] else 0

        # Salva trascrizione individuale
        transcript_data = {
            "id": yt_id,
            "title": video["title"],
            "date": video["date"],
            "category": cat_id,
            "director": video["director"],
            "text": video["transcript_text"] or "",
            "metadata": video["metadata_json"],
            "films_mentioned": video["films_mentioned"],
            "word_count": word_count,
        }

        transcript_file = output_path / "transcripts" / f"{yt_id}.json"
        transcript_file.write_text(
            json.dumps(transcript_data, ensure_ascii=False, indent=None),
            encoding='utf-8'
        )

        # Entry per il catalogo (senza testo completo)
        catalog_entry = {
            "id": yt_id,
            "date": video["date"],
            "title": video["title"],
            "category": cat_id,
            "category_label": cat_label,
            "year": video["year"],
            "month": video["month"],
            "director": video["director"],
            "word_count": word_count,
            "char_count": text_len,
            "has_transcript": bool(video["transcript_text"]),
            "has_metadata": bool(video["metadata_json"]),
            "films_count": len(video["films_mentioned"]),
        }
        catalog.append(catalog_entry)

        stats["total"] += 1
        if video["transcript_text"]:
            stats["with_transcript"] += 1
        if video["metadata_json"]:
            stats["with_metadata"] += 1

    # ═══════════════════════════════════════════════════════
    # GENERA FILE DI OUTPUT
    # ═══════════════════════════════════════════════════════

    # 1. CATALOGO PRINCIPALE (index.json)
    index_data = {
        "version": "1.0",
        "generated": datetime.now().isoformat(),
        "total_videos": len(catalog),
        "catalog": catalog,
    }

    (output_path / "index.json").write_text(
        json.dumps(index_data, ensure_ascii=False, indent=2),
        encoding='utf-8'
    )
    print(f"  ✓ index.json — {len(catalog)} video indicizzati")

    # 2. STATISTICHE (stats.json)
    stats_data = {
        "total_videos": stats["total"],
        "with_transcript": stats["with_transcript"],
        "with_metadata": stats["with_metadata"],
        "years_covered": sorted(yearly_count.keys()),
        "yearly_distribution": dict(sorted(yearly_count.items())),
        "category_distribution": dict(category_count.most_common()),
        "total_words": sum(v.get("transcript_text", "") and len(v.get("transcript_text", "").split()) or 0 for v in videos.values()),
    }

    (output_path / "stats.json").write_text(
        json.dumps(stats_data, ensure_ascii=False, indent=2),
        encoding='utf-8'
    )
    print(f"  ✓ stats.json — statistiche generali")

    # 3. REGISTI & MAPPA CONCETTUALE (directors.json)
    directors_data = {
        "directors": [],
        "genre_connections": {},
    }

    for director, count in directors_count.most_common():
        genres = DIRECTOR_GENRES.get(director, ["Non classificato"])
        # Trova i video dedicati
        director_videos = [
            {"id": v["id"], "title": v["title"], "date": v["date"]}
            for v in videos.values()
            if v["director"] == director
        ]
        directors_data["directors"].append({
            "name": director,
            "video_count": count,
            "genres": genres,
            "videos": director_videos,
        })

    # Connessioni per genere
    genre_to_directors = defaultdict(list)
    for d in directors_data["directors"]:
        for g in d["genres"]:
            genre_to_directors[g].append(d["name"])
    directors_data["genre_connections"] = dict(genre_to_directors)

    (output_path / "directors.json").write_text(
        json.dumps(directors_data, ensure_ascii=False, indent=2),
        encoding='utf-8'
    )
    print(f"  ✓ directors.json — {len(directors_count)} registi mappati")

    # 4. FILM PIÙ CITATI (films.json)
    films_data = {
        "most_mentioned": [
            {"title": film, "mentions": count}
            for film, count in all_films.most_common(200)
            if count >= 2  # Solo film citati almeno 2 volte
        ]
    }

    (output_path / "films.json").write_text(
        json.dumps(films_data, ensure_ascii=False, indent=2),
        encoding='utf-8'
    )
    print(f"  ✓ films.json — {len(films_data['most_mentioned'])} film più citati")

    # 5. CATEGORIE (categories.json)
    categories_info = {
        cat_id: {
            "id": cat_id,
            "label": cat_label,
            "count": category_count[cat_id],
            "years": sorted(set(
                v["year"] for v in videos.values()
                if v["category"] == cat_id and v["year"]
            )),
        }
        for _, cat_id, cat_label in CATEGORY_RULES
        if category_count[cat_id] > 0
    }
    if category_count.get("altro", 0) > 0:
        categories_info["altro"] = {
            "id": "altro", "label": "Altro",
            "count": category_count["altro"],
            "years": sorted(set(
                v["year"] for v in videos.values()
                if v["category"] == "altro" and v["year"]
            )),
        }

    (output_path / "categories.json").write_text(
        json.dumps(categories_info, ensure_ascii=False, indent=2),
        encoding='utf-8'
    )
    print(f"  ✓ categories.json — {len(categories_info)} categorie")

    # ═══════════════════════════════════════════════════════
    # REPORT FINALE
    # ═══════════════════════════════════════════════════════

    total_words = stats_data["total_words"]

    print(f"\n{'═' * 60}")
    print(f"  BUILD COMPLETATA!")
    print(f"{'═' * 60}")
    print(f"\n  📊 RIEPILOGO:")
    print(f"     Video totali:        {stats['total']}")
    print(f"     Con trascrizione:    {stats['with_transcript']}")
    print(f"     Con metadati JSON:   {stats['with_metadata']}")
    print(f"     Parole totali:       {total_words:,}")
    print(f"     Registi identificati: {len(directors_count)}")
    print(f"     Film menzionati:     {len(all_films)}")
    print(f"\n  📁 FILE GENERATI in {output_path}:")
    print(f"     index.json           — catalogo completo")
    print(f"     stats.json           — statistiche")
    print(f"     directors.json       — mappa registi")
    print(f"     films.json           — film più citati")
    print(f"     categories.json      — categorie")
    print(f"     transcripts/         — {stats['total']} file individuali")
    print(f"\n  📂 DISTRIBUZIONE PER ANNO:")
    for year in sorted(yearly_count.keys()):
        bar = "█" * (yearly_count[year] // 10) + "░" * max(0, 40 - yearly_count[year] // 10)
        print(f"     {year}: {bar} {yearly_count[year]}")
    print(f"\n  🎬 TOP 10 CATEGORIE:")
    for cat, count in category_count.most_common(10):
        print(f"     {cat:25s} {count:4d} video")
    print(f"\n  🎭 TOP 10 REGISTI:")
    for director, count in directors_count.most_common(10):
        print(f"     {director:25s} {count:4d} video")
    print(f"\n{'═' * 60}\n")


# ═══════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Federico Frusciante Memorial — Build Pipeline"
    )
    parser.add_argument(
        "--input", "-i",
        default="data/transcripts",
        help="Cartella con i file delle trascrizioni (default: data/transcripts)"
    )
    parser.add_argument(
        "--output", "-o",
        default="site/data",
        help="Cartella di output per i dati del sito (default: site/data)"
    )
    args = parser.parse_args()

    if not Path(args.input).exists():
        print(f"\n  ❌ ERRORE: La cartella '{args.input}' non esiste!")
        print(f"     Assicurati che le trascrizioni siano nella cartella corretta.")
        print(f"     Uso: python build_index.py --input /percorso/alle/trascrizioni\n")
        exit(1)

    process_transcripts(args.input, args.output)
