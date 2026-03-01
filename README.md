# 🎬 Federico Frusciante — Digital Memorial

> *"Amavi solo la tua Eleonora più del cinema."* — Davide Marra

Archivio completo di oltre 4000 trascrizioni video di Federico Frusciante (2014–2026).  
Critico cinematografico, musicista post-punk, custode di Videodrome, voce libera del cinema italiano.

---

## Come funziona

1. Le trascrizioni grezze (`data/transcripts/`) vengono processate da `build_index.py`
2. Lo script genera file JSON ottimizzati in `site/data/`
3. La cartella `site/` viene pubblicata come sito statico su GitHub Pages

## Rieseguire il build

```powershell
python build_index.py --input data/transcripts --output site/data
```

## Testare in locale

```powershell
cd site
python -m http.server 8000
# Apri http://localhost:8000
```

---

**Federico vive** 🎬
