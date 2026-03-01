# 🎬 Federico Frusciante — Digital Memorial

> *"Amavi solo la tua Eleonora più del cinema."* — Davide Marra

Archivio completo delle trascrizioni di oltre 4000 video di Federico Frusciante (2014–2026).  
Critico cinematografico, musicista post-punk, custode di Videodrome, voce libera del cinema italiano.

---

## 🚀 Guida Rapida (3 passaggi)

### 1. Prepara la struttura

```
frusciante-memorial/
├── data/
│   └── transcripts/          ← I tuoi 4000+ file .json e .txt
├── site/
│   ├── index.html            ← La pagina web
│   ├── index.jsx             ← Il codice React del sito
│   └── data/                 ← Verrà generata automaticamente
├── build_index.py            ← Lo script di elaborazione
└── README.md
```

Copia i tuoi file di trascrizione nella cartella `data/transcripts/`.

### 2. Esegui il build

```bash
# Assicurati di avere Python 3.7+
python build_index.py --input data/transcripts --output site/data
```

Lo script:
- Legge tutti i file `.json` e `.txt`
- Estrae data, YouTube ID, titolo, categoria dal nome file
- Classifica automaticamente ogni video (Consigli, Monografie, Recensioni, ecc.)
- Identifica i registi nelle monografie
- Estrae i film citati nelle trascrizioni
- Genera l'indice completo e le mappe concettuali

Vedrai un report dettagliato alla fine:

```
═══════════════════════════════════════════════════════════
  BUILD COMPLETATA!
═══════════════════════════════════════════════════════════

  📊 RIEPILOGO:
     Video totali:        4127
     Con trascrizione:    4098
     Registi identificati: 47
     Film menzionati:     1832
```

### 3. Pubblica GRATIS su GitHub Pages

```bash
# Inizializza il repository
cd frusciante-memorial
git init
git add .
git commit -m "Federico vive 🎬"

# Crea il repository su GitHub (github.com/new)
# Poi collegalo:
git remote add origin https://github.com/TUO-USERNAME/frusciante-memorial.git
git push -u origin main

# Vai su GitHub → Settings → Pages → Source: main → /site
# Il sito sarà online su: https://TUO-USERNAME.github.io/frusciante-memorial/
```

---

## 📁 Formato dei file di trascrizione

Lo script si aspetta file con questo formato di nome:

```
YYYYMMDD_YouTubeID_Titolo del video.txt
YYYYMMDD_YouTubeID_Titolo del video.json
```

**Esempio:**
```
20141023_WZVnQNsfQe4_Le Monografie di Frusciante - Woody Allen - parte 1.json
20141023_WZVnQNsfQe4_Le Monografie di Frusciante - Woody Allen - parte 1.txt
```

- **YYYYMMDD**: Data di pubblicazione (es. 20141023 = 23 ottobre 2014)
- **YouTubeID**: ID del video YouTube (es. WZVnQNsfQe4)
- **Titolo**: Titolo completo del video
- **.txt**: Trascrizione in testo puro
- **.json**: Metadati strutturati

---

## 🎭 Categorie riconosciute automaticamente

| Pattern nel titolo | Categoria |
|---|---|
| "I consigli di Frusciante" | Consigli mensili |
| "Le Monografie" | Monografie registi |
| "Le Recensioni" / "Meglio e Peggio" | Recensioni annuali |
| "Consigli musicali" | Consigli musicali |
| "Reboot di Frusciante" | Analisi remake/reboot |
| "Worst" / "Peggio" | I Peggiori |
| "SciFi" / "Fantascienza" | Cinema di genere |
| "Speciale" / "Natale" / etc. | Speciali tematici |
| "Criticoni" | I Criticoni |
| "Top X" | Classifiche |
| "Intervista" | Interviste |

Puoi aggiungere nuove regole nel dizionario `CATEGORY_RULES` in `build_index.py`.

---

## 🌐 Opzioni di hosting GRATUITO

### GitHub Pages (consigliato)
- **Gratis** per repository pubblici
- Deploy automatico da push
- URL: `tuonome.github.io/frusciante-memorial`

### Netlify
- Trascina la cartella `site/` su [netlify.com/drop](https://app.netlify.com/drop)
- URL personalizzabile gratuito

### Cloudflare Pages
- Collega il repository GitHub
- Build automatico e CDN globale

### Vercel
- Import da GitHub, zero configurazione
- Ottimo per React

---

## 🔧 Sviluppo locale

Per testare il sito in locale:

```bash
# Opzione 1: Python
cd site
python -m http.server 8000
# Apri http://localhost:8000

# Opzione 2: Node.js
npx serve site
```

---

## 📊 File generati

| File | Contenuto |
|---|---|
| `site/data/index.json` | Catalogo completo di tutti i video |
| `site/data/stats.json` | Statistiche generali |
| `site/data/directors.json` | Mappa registi e connessioni generi |
| `site/data/films.json` | Film più citati nelle trascrizioni |
| `site/data/categories.json` | Dettaglio categorie |
| `site/data/transcripts/*.json` | Trascrizione individuale per ogni video |

---

## 💛 Crediti

- **Federico Frusciante** (1973–2026) — per tutto quello che ci ha insegnato
- **I Criticoni** — Francesco Alò, Davide Marra, Mattia Ferrari
- **La community** — per aver tenuto vivo il ricordo

> *"Ha fatto appassionare più gente al cinema con i suoi modi e la sua competenza che interi corsi universitari e volumi pubblicati."*

---

**Federico vive** 🎬
