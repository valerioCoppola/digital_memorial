const { useState, useEffect, useRef, useMemo, useCallback } = React;


// ============================================================
// FEDERICO FRUSCIANTE — DIGITAL MEMORIAL
// Versione con caricamento dati reali
// ============================================================

const DATA_BASE_URL = "./data"; // Percorso ai file generati da build_index.py

const CATEGORY_META = {
  patreon:        { icon: "🎟️", color: "#c49a6c", label: "Patreon / Minirece" },
  al_cinema:      { icon: "🎬", color: "#e8a946", label: "Al Cinema" },
  consigli:       { icon: "📋", color: "#6aaa64", label: "I Consigli" },
  monografie:     { icon: "🎭", color: "#c45c4a", label: "Le Monografie" },
  classici:       { icon: "🏛️", color: "#d4a853", label: "I Classici" },
  musicali:       { icon: "🎵", color: "#8b6cc1", label: "Consigli Musicali" },
  speciali:       { icon: "🌟", color: "#e8c846", label: "Speciali" },
  saghe:          { icon: "⚔️", color: "#4a90c4", label: "Le Saghe" },
  oriente:        { icon: "🏯", color: "#e05555", label: "In Oriente" },
  letterari:      { icon: "📚", color: "#7aaa84", label: "Consigli Letterari" },
  underground:    { icon: "🕳️", color: "#8a4a4a", label: "Underground" },
  meglio_peggio:  { icon: "🏆", color: "#d4a853", label: "Meglio e Peggio" },
  imperdibili:    { icon: "💎", color: "#5bb5a2", label: "(Im)Perdibili" },
  interviste:     { icon: "🎤", color: "#c49a6c", label: "Le Interviste" },
  reboot:         { icon: "🔄", color: "#4a90c4", label: "I Reboot" },
  con_lomuscio:   { icon: "🎹", color: "#6a8cc1", label: "Con Marco Lo Muscio" },
  criticoni:      { icon: "🎪", color: "#c45c4a", label: "I Criticoni" },
  eventi:         { icon: "🎪", color: "#e05555", label: "Eventi Live" },
  quarantena:     { icon: "🏠", color: "#888", label: "Quarantena" },
  consigli_brevi: { icon: "⚡", color: "#e8a946", label: "Consigli Brevi" },
  scifi:          { icon: "🚀", color: "#5bb5a2", label: "Fantascienza" },
  recensioni:     { icon: "⭐", color: "#6aaa64", label: "Le Recensioni" },
  vlog:           { icon: "📢", color: "#888", label: "Messaggi & Vlog" },
  altro:          { icon: "📽️", color: "#555", label: "Altro" },
};

const GENRE_COLORS = {
  Horror: "#c45c4a",
  "Sci-Fi": "#5bb5a2",
  Autore: "#e8a946",
  Italiano: "#8b6cc1",
  Giallo: "#d4a853",
  Cult: "#6aaa64",
  Crime: "#8a4a4a",
  Commedia: "#e8c846",
  Fantasy: "#6a8cc1",
  Azione: "#c47a4a",
  Indie: "#7aaa84",
  Avventura: "#4a90c4",
  Surrealismo: "#c46a8a",
  "B-Movie": "#6aaa64",
  Thriller: "#c49a6c",
  Western: "#d4a853",
  Drammatico: "#8a6a8a",
  Animazione: "#5bb5a2",
  Orientale: "#e05555",
  Classico: "#d4a853",
  "Non classificato": "#555",
};

const TIMELINE = [
  { year: 1973, label: "Nasce a Pontedera (PI)", type: "life" },
  { year: 1998, label: "Apre Videodrome a Livorno, via Magenta 85", type: "career" },
  { year: 2006, label: "Primi video di critica cinematografica su YouTube", type: "youtube" },
  { year: 2014, label: "L'archivio trascrizioni inizia da qui", type: "archive" },
  { year: 2022, label: "Chiude Videodrome dopo 24 anni di presidio culturale", type: "career" },
  { year: 2025, label: "Nasce il progetto Criticoni con Alò, Marra e Ferrari", type: "career" },
  { year: 2026, label: "15 febbraio — ci lascia a 52 anni", type: "life" },
];

// ============================================================
// DATA LOADING HOOKS
// ============================================================

function useJsonData(filename) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${DATA_BASE_URL}/${filename}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [filename]);

  return { data, loading, error };
}

function LoadingIndicator({ message = "Caricamento..." }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 24px", gap: "16px",
    }}>
      <div style={{
        width: "32px", height: "32px", border: "2px solid #222",
        borderTop: "2px solid #e8a946", borderRadius: "50%",
        animation: "spin 1s linear infinite",
      }} />
      <div style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem",
        color: "#555", letterSpacing: "0.05em",
      }}>{message}</div>
    </div>
  );
}

function ErrorMessage({ message }) {
  return (
    <div style={{
      padding: "40px 24px", textAlign: "center",
      fontFamily: "'DM Sans', sans-serif", color: "#c45c4a",
      fontSize: "0.85rem",
    }}>
      <div style={{ fontSize: "2rem", marginBottom: "12px" }}>⚠️</div>
      <div>Errore nel caricamento: {message}</div>
      <div style={{ color: "#666", marginTop: "8px", fontSize: "0.8rem" }}>
        Assicurati di aver eseguito <code style={{ color: "#e8a946" }}>python build_index.py</code> e che i file siano nella cartella <code style={{ color: "#e8a946" }}>site/data/</code>
      </div>
    </div>
  );
}

// ============================================================
// FILM GRAIN
// ============================================================

function FilmGrain() {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      pointerEvents: "none", zIndex: 9999, opacity: 0.035,
      background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    }} />
  );
}

// ============================================================
// NAVIGATION
// ============================================================

function Nav({ active, setActive }) {
  const items = [
    { id: "home", label: "Memoriale" },
    { id: "archivio", label: "Archivio" },
    { id: "mappa", label: "Mappa" },
    { id: "timeline", label: "Timeline" },
    { id: "info", label: "Info" },
  ];

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "linear-gradient(180deg, #0a0a0aee 0%, #0a0a0add 70%, #0a0a0a00 100%)",
      backdropFilter: "blur(12px)", padding: "16px 0 24px",
    }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto", padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "12px",
      }}>
        <div style={{
          fontFamily: "'Playfair Display', serif", fontSize: "1.1rem",
          color: "#e8a946", letterSpacing: "0.1em", fontWeight: 700,
          textTransform: "uppercase", cursor: "pointer",
        }} onClick={() => setActive("home")}>FF</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {items.map(item => (
            <button key={item.id} onClick={() => setActive(item.id)} style={{
              background: active === item.id ? "#e8a94615" : "transparent",
              border: active === item.id ? "1px solid #e8a94644" : "1px solid transparent",
              color: active === item.id ? "#e8a946" : "#888",
              padding: "6px 14px", borderRadius: "4px", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem",
              letterSpacing: "0.05em", textTransform: "uppercase",
              transition: "all 0.3s",
            }}>{item.label}</button>
          ))}
        </div>
      </div>
    </nav>
  );
}

// ============================================================
// HERO SECTION
// ============================================================

function HeroSection({ stats }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setTimeout(() => setLoaded(true), 100); }, []);

  const totalVideos = stats?.total_videos || "4000+";
  const yearsRange = stats?.years_covered
    ? `${stats.years_covered[0]}–${stats.years_covered[stats.years_covered.length - 1]}`
    : "2014–2026";
  const totalWords = stats?.total_words
    ? `${Math.round(stats.total_words / 1000000 * 10) / 10}M`
    : "—";

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "60px 24px", position: "relative",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        background: "radial-gradient(ellipse at 50% 30%, #1a150d 0%, #0a0a0a 60%)",
      }} />
      <div style={{
        position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)",
        width: "600px", height: "600px", borderRadius: "50%",
        background: "radial-gradient(circle, #e8a94608 0%, transparent 70%)",
        filter: "blur(60px)",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(30px)",
        transition: "all 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }}>
        <div style={{
          width: "60px", height: "1px", background: "#e8a94666",
          margin: "0 auto 32px",
        }} />
        <div style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: "0.7rem",
          letterSpacing: "0.35em", textTransform: "uppercase",
          color: "#e8a94688", marginBottom: "24px",
        }}>Pontedera, 1973 — Livorno, 2026</div>

        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
          fontWeight: 400, color: "#f0e6d2", lineHeight: 1.05,
          margin: "0 0 20px", textShadow: "0 0 40px #e8a94622",
        }}>
          Federico<br />
          <span style={{ fontStyle: "italic", color: "#e8a946" }}>Frusciante</span>
        </h1>

        <div style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem",
          color: "#999", maxWidth: "500px", margin: "0 auto", lineHeight: 1.8,
        }}>
          Critico cinematografico, musicista post-punk,<br />
          custode di Videodrome, voce libera del cinema italiano.
        </div>

        <div style={{
          width: "40px", height: "1px", background: "#e8a94644",
          margin: "40px auto",
        }} />

        <blockquote style={{
          fontFamily: "'Playfair Display', serif", fontStyle: "italic",
          fontSize: "1.1rem", color: "#e8a94699", maxWidth: "460px",
          margin: "0 auto", lineHeight: 1.7,
        }}>
          "Amavi solo la tua Eleonora più del cinema."
          <div style={{
            fontSize: "0.7rem", fontStyle: "normal", color: "#666",
            marginTop: "12px", fontFamily: "'DM Sans', sans-serif",
            letterSpacing: "0.1em", textTransform: "uppercase",
          }}>— Davide Marra</div>
        </blockquote>

        <div style={{
          display: "flex", justifyContent: "center", gap: "48px",
          marginTop: "60px", flexWrap: "wrap",
        }}>
          {[
            { n: totalVideos.toLocaleString?.() || totalVideos, l: "Video trascritti" },
            { n: yearsRange, l: "Anni di archivio" },
            { n: totalWords, l: "Parole totali" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{
                fontFamily: "'Playfair Display', serif", fontSize: "1.8rem",
                color: "#e8a946", fontWeight: 700,
              }}>{s.n}</div>
              <div style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: "0.7rem",
                color: "#666", letterSpacing: "0.1em", textTransform: "uppercase",
                marginTop: "4px",
              }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// VIDEODROME TRIBUTE
// ============================================================

function VideodromeTribute({ stats, onNavigate }) {
  const categories = stats?.category_distribution
    ? Object.entries(stats.category_distribution)
    : [];

  return (
    <div style={{
      padding: "80px 24px", maxWidth: 900, margin: "0 auto",
      borderTop: "1px solid #1a1a1a",
    }}>
      <div style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: "0.65rem",
        letterSpacing: "0.3em", textTransform: "uppercase",
        color: "#e8a94666", marginBottom: "16px",
      }}>Via Magenta 85, Livorno • 1998–2022</div>

      <h2 style={{
        fontFamily: "'Playfair Display', serif", fontSize: "2.2rem",
        color: "#f0e6d2", fontWeight: 400, margin: "0 0 24px", lineHeight: 1.2,
      }}>
        Da <span style={{ fontStyle: "italic", color: "#e8a946" }}>Videodrome</span> al mondo
      </h2>

      <div style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem",
        color: "#999", lineHeight: 1.9,
      }}>
        <p style={{ margin: "0 0 16px" }}>
          Per ventiquattro anni, Videodrome non è stata solo una videoteca. È stata un presidio culturale,
          un luogo dove il cinema di genere, l'horror, l'indipendente e le opere dimenticate trovavano
          qualcuno che le difendeva con passione incrollabile.
        </p>
        <p style={{ margin: "0 0 16px" }}>
          Federico aveva la capacità rara di far amare ciò di cui parlava. Ha fatto appassionare
          più persone al cinema lui con i suoi modi genuini che interi corsi universitari.
        </p>
        <p style={{ margin: 0 }}>
          Questo archivio raccoglie le trascrizioni complete di tutti i suoi video.
          Ogni parola, ogni consiglio, ogni stroncatura memorabile.
          Perché la voce di Federico continui a guidare chi cerca cinema vero.
        </p>
      </div>

      {/* Category overview cards */}
      {categories.length > 0 && (
        <div style={{
          marginTop: "48px",
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "8px",
        }}>
          {categories.slice(0, 8).map(([catId, count]) => {
            const meta = CATEGORY_META[catId] || CATEGORY_META.altro;
            return (
              <div key={catId} onClick={() => onNavigate("archivio")} style={{
                background: "#0d0d0d", border: "1px solid #1a1a1a",
                borderLeft: `3px solid ${meta.color}`, borderRadius: "4px",
                padding: "14px 16px", cursor: "pointer", transition: "all 0.3s",
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem",
                    color: "#ccc",
                  }}>{meta.icon} {meta.label || catId}</span>
                  <span style={{
                    fontFamily: "'DM Mono', monospace", fontSize: "0.7rem",
                    color: meta.color,
                  }}>{count}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ARCHIVE BROWSER (data-driven)
// ============================================================

function ArchiveSection() {
  const { data: indexData, loading, error } = useJsonData("index.json");
  const [selectedCat, setSelectedCat] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedVideo, setExpandedVideo] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const catalog = indexData?.catalog || [];

  const categories = useMemo(() => {
    const cats = {};
    catalog.forEach(v => {
      if (!cats[v.c]) cats[v.c] = { count: 0, label: v.cl };
      cats[v.c].count++;
    });
    return Object.entries(cats).sort((a, b) => b[1].count - a[1].count);
  }, [catalog]);

  const years = useMemo(() =>
    [...new Set(catalog.map(v => v.y).filter(Boolean))].sort(),
    [catalog]
  );

  const filtered = useMemo(() => {
    return catalog.filter(v => {
      if (selectedCat !== "all" && v.c !== selectedCat) return false;
      if (selectedYear !== "all" && v.y !== parseInt(selectedYear)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return v.t.toLowerCase().includes(q) ||
          (v.dir && v.dir.toLowerCase().includes(q));
      }
      return true;
    });
  }, [catalog, selectedCat, selectedYear, searchQuery]);

  const paged = filtered.slice(0, (page + 1) * PAGE_SIZE);
  const hasMore = paged.length < filtered.length;

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [selectedCat, selectedYear, searchQuery]);

  // Cache dei file annuali già scaricati
  const yearCacheRef = useRef({});

  const loadTranscript = useCallback(async (ytId) => {
    if (expandedVideo === ytId) {
      setExpandedVideo(null);
      setTranscript(null);
      return;
    }
    setExpandedVideo(ytId);
    setLoadingTranscript(true);

    // Trova l'anno del video dal catalogo
    const video = catalog.find(v => v.id === ytId);
    const year = video?.y || 0;

    try {
      // Controlla cache
      if (!yearCacheRef.current[year]) {
        const r = await fetch(`${DATA_BASE_URL}/transcripts_${year}.json`);
        if (r.ok) {
          yearCacheRef.current[year] = await r.json();
        } else {
          yearCacheRef.current[year] = {};
        }
      }
      const text = yearCacheRef.current[year]?.[ytId] || "";
      setTranscript({ text });
    } catch {
      setTranscript({ text: "[Errore nel caricamento]" });
    }
    setLoadingTranscript(false);
  }, [expandedVideo, catalog]);

  if (loading) return <LoadingIndicator message="Caricamento archivio..." />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div style={{ padding: "60px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: "0.65rem",
          letterSpacing: "0.3em", textTransform: "uppercase",
          color: "#e8a94666", marginBottom: "12px",
        }}>Archivio Completo</div>
        <h2 style={{
          fontFamily: "'Playfair Display', serif", fontSize: "2.5rem",
          color: "#f0e6d2", fontWeight: 400, margin: 0,
        }}>
          {catalog.length.toLocaleString()} <span style={{ fontStyle: "italic", color: "#e8a946" }}>Trascrizioni</span>
        </h2>
      </div>

      {/* Category filters */}
      <div style={{
        display: "flex", gap: "6px", flexWrap: "wrap",
        justifyContent: "center", marginBottom: "20px",
      }}>
        <button onClick={() => setSelectedCat("all")} style={{
          background: selectedCat === "all" ? "#e8a94620" : "#111",
          border: `1px solid ${selectedCat === "all" ? "#e8a94644" : "#222"}`,
          color: selectedCat === "all" ? "#e8a946" : "#666",
          padding: "6px 14px", borderRadius: "20px", cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif", fontSize: "0.73rem",
        }}>Tutti ({catalog.length})</button>
        {categories.map(([catId, { count, label }]) => {
          const meta = CATEGORY_META[catId] || CATEGORY_META.altro;
          return (
            <button key={catId} onClick={() => setSelectedCat(catId)} style={{
              background: selectedCat === catId ? `${meta.color}15` : "#111",
              border: `1px solid ${selectedCat === catId ? `${meta.color}44` : "#222"}`,
              color: selectedCat === catId ? meta.color : "#666",
              padding: "6px 14px", borderRadius: "20px", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: "0.73rem",
            }}>{meta.icon} {meta.label || label} ({count})</button>
          );
        })}
      </div>

      {/* Search + year filter */}
      <div style={{
        display: "flex", gap: "12px", justifyContent: "center",
        marginBottom: "40px", flexWrap: "wrap", alignItems: "center",
      }}>
        <input type="text" placeholder="Cerca per titolo, regista..."
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          style={{
            background: "#111", border: "1px solid #222", color: "#ccc",
            padding: "10px 16px", borderRadius: "4px", width: "300px",
            fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", outline: "none",
          }}
        />
        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={{
          background: "#111", border: "1px solid #222", color: "#888",
          padding: "10px 16px", borderRadius: "4px", cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem",
        }}>
          <option value="all">Tutti gli anni</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem", color: "#555",
        }}>{filtered.length} risultati</span>
      </div>

      {/* Video list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        {paged.map(video => {
          const meta = CATEGORY_META[video.c] || CATEGORY_META.altro;
          const isExpanded = expandedVideo === video.id;

          return (
            <div key={video.id}
              onClick={() => loadTranscript(video.id)}
              style={{
                background: isExpanded ? "#141210" : "#0d0d0d",
                border: `1px solid ${isExpanded ? "#2a221888" : "#151515"}`,
                borderRadius: "4px", padding: "14px 18px",
                cursor: "pointer", transition: "all 0.2s",
              }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
              }}>
                <span style={{
                  fontFamily: "'DM Mono', monospace", fontSize: "0.68rem",
                  color: "#444", minWidth: "76px",
                }}>{video.d || "—"}</span>
                <span style={{
                  fontSize: "0.68rem", padding: "2px 8px", borderRadius: "3px",
                  background: `${meta.color}12`, color: meta.color,
                  fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
                }}>{meta.icon} {video.cl}</span>
                <span style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem",
                  color: "#ccc", flex: 1,
                }}>{video.t}</span>
                {video.dir && (
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: "0.7rem",
                    color: "#e8a94688", background: "#e8a94610",
                    padding: "2px 8px", borderRadius: "3px",
                  }}>🎭 {video.dir}</span>
                )}
                <span style={{
                  fontFamily: "'DM Mono', monospace", fontSize: "0.6rem",
                  color: "#333",
                }}>{video.wc ? `${(video.wc / 1000).toFixed(1)}k parole` : ""}</span>
              </div>

              {/* Expanded: transcript content */}
              {isExpanded && (
                <div onClick={e => e.stopPropagation()} style={{
                  marginTop: "16px", paddingTop: "16px",
                  borderTop: "1px solid #1a1a1a",
                }}>
                  {loadingTranscript ? (
                    <div style={{ color: "#555", fontSize: "0.8rem", fontFamily: "'DM Sans'" }}>
                      Caricamento trascrizione...
                    </div>
                  ) : transcript ? (
                    <>
                      {/* Transcript text */}
                      <div style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem",
                        color: "#aaa", lineHeight: 1.85,
                        maxHeight: "400px", overflowY: "auto",
                        padding: "16px", background: "#0a0a0a",
                        borderRadius: "4px", border: "1px solid #1a1a1a",
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {transcript.text || "[Nessun testo disponibile]"}
                      </div>

                      {/* Actions */}
                      <div style={{
                        display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap",
                      }}>
                        <a href={`https://youtube.com/watch?v=${video.id}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{
                            background: "#1a1511", border: "1px solid #2a2218",
                            color: "#e8a946", padding: "8px 16px", borderRadius: "4px",
                            fontFamily: "'DM Sans'", fontSize: "0.75rem",
                            textDecoration: "none",
                          }}>▶ YouTube</a>
                        <button onClick={() => {
                          navigator.clipboard?.writeText(transcript.text || "");
                        }} style={{
                          background: "#111", border: "1px solid #222",
                          color: "#888", padding: "8px 16px", borderRadius: "4px",
                          fontFamily: "'DM Sans'", fontSize: "0.75rem", cursor: "pointer",
                        }}>📋 Copia testo</button>
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <div style={{ textAlign: "center", padding: "24px" }}>
          <button onClick={() => setPage(p => p + 1)} style={{
            background: "#111", border: "1px solid #222", color: "#888",
            padding: "12px 32px", borderRadius: "4px", cursor: "pointer",
            fontFamily: "'DM Sans'", fontSize: "0.85rem",
          }}>
            Mostra altri {Math.min(PAGE_SIZE, filtered.length - paged.length)} video
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CONCEPT MAP (data-driven)
// ============================================================

function ConceptMap() {
  const { data: directorsData, loading, error } = useJsonData("directors.json");
  const { data: statsData } = useJsonData("stats.json");
  const [selectedView, setSelectedView] = useState("directors");
  const [selectedDirector, setSelectedDirector] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState(null);

  const directors = directorsData?.directors || [];
  const genreConnections = directorsData?.genre_connections || {};

  const yearlyDist = statsData?.yearly_distribution || {};
  const catDist = statsData?.category_distribution || {};

  if (loading) return React.createElement(LoadingIndicator, { message: "Caricamento mappa..." });
  if (error) return React.createElement(ErrorMessage, { message: error });

  // Get selected director's details
  const selDir = selectedDirector ? directors.find(d => d.name === selectedDirector) : null;
  // Get directors in selected genre
  const genreDirs = selectedGenre ? (genreConnections[selectedGenre] || []) : [];

  return (
    React.createElement("div", { style: { padding: "60px 24px", maxWidth: 1100, margin: "0 auto" } },
      React.createElement("div", { style: { textAlign: "center", marginBottom: "48px" } },
        React.createElement("div", { style: {
          fontFamily: "'DM Sans'", fontSize: "0.65rem",
          letterSpacing: "0.3em", textTransform: "uppercase",
          color: "#e8a94666", marginBottom: "12px",
        } }, "Visualizzazioni"),
        React.createElement("h2", { style: {
          fontFamily: "'Playfair Display', serif", fontSize: "2.5rem",
          color: "#f0e6d2", fontWeight: 400, margin: "0 0 24px",
        } }, "Mappa ", React.createElement("span", { style: { fontStyle: "italic", color: "#e8a946" } }, "Concettuale")),

        React.createElement("div", { style: { display: "flex", gap: "6px", justifyContent: "center", flexWrap: "wrap" } },
          [
            { id: "directors", label: "🎬 Registi" },
            { id: "genres", label: "🎭 Generi" },
            { id: "years", label: "📅 Per Anno" },
            { id: "categories", label: "📊 Categorie" },
          ].map(function(v) {
            return React.createElement("button", {
              key: v.id, onClick: function() { setSelectedView(v.id); setSelectedDirector(null); setSelectedGenre(null); },
              style: {
                background: selectedView === v.id ? "#e8a94615" : "#111",
                border: "1px solid " + (selectedView === v.id ? "#e8a94644" : "#222"),
                color: selectedView === v.id ? "#e8a946" : "#666",
                padding: "8px 16px", borderRadius: "4px", cursor: "pointer",
                fontFamily: "'DM Sans'", fontSize: "0.8rem",
              }
            }, v.label);
          })
        )
      ),

      // === DIRECTORS — Interactive Grid ===
      selectedView === "directors" && React.createElement("div", {
        style: { background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "30px" }
      },
        // Director grid
        React.createElement("div", {
          style: { display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginBottom: "24px" }
        },
          directors.slice(0, 40).map(function(d) {
            var isSelected = selectedDirector === d.name;
            var isHighlighted = selectedGenre && genreDirs.includes(d.name);
            var isFaded = selectedGenre && !genreDirs.includes(d.name);
            return React.createElement("div", {
              key: d.name,
              onClick: function() { setSelectedDirector(isSelected ? null : d.name); setSelectedGenre(null); },
              style: {
                background: isSelected ? "#1a1511" : isFaded ? "#0a0a0a" : "#0f0f0f",
                border: "1px solid " + (isSelected ? "#e8a94666" : isHighlighted ? "#e8a94633" : "#1a1a1a"),
                borderRadius: "6px", padding: "12px 16px", cursor: "pointer",
                transition: "all 0.2s", opacity: isFaded ? 0.3 : 1,
                minWidth: "140px", textAlign: "center",
                boxShadow: isSelected ? "0 0 20px #e8a94622" : "none",
              }
            },
              React.createElement("div", { style: {
                fontFamily: "'DM Sans'", fontSize: "0.85rem",
                color: isSelected ? "#e8a946" : isHighlighted ? "#e8a946" : "#ccc",
                fontWeight: isSelected ? 600 : 400,
              } }, d.name),
              React.createElement("div", { style: {
                fontFamily: "'DM Mono'", fontSize: "0.65rem",
                color: isSelected ? "#e8a94688" : "#444", marginTop: "4px",
              } }, d.count + " video"),
              React.createElement("div", { style: {
                display: "flex", gap: "3px", justifyContent: "center", marginTop: "6px", flexWrap: "wrap",
              } },
                (d.genres || []).map(function(g) {
                  return React.createElement("span", {
                    key: g,
                    onClick: function(e) { e.stopPropagation(); setSelectedGenre(selectedGenre === g ? null : g); setSelectedDirector(null); },
                    style: {
                      fontSize: "0.6rem", padding: "1px 6px", borderRadius: "8px",
                      background: (GENRE_COLORS[g] || "#555") + "18",
                      color: (selectedGenre === g ? "#fff" : (GENRE_COLORS[g] || "#555")),
                      border: "1px solid " + (selectedGenre === g ? (GENRE_COLORS[g] || "#555") : "transparent"),
                      cursor: "pointer", fontFamily: "'DM Sans'",
                    }
                  }, g);
                })
              )
            );
          })
        ),

        // Selected director detail panel
        selDir && React.createElement("div", {
          style: {
            background: "#0d0b08", border: "1px solid #2a2218", borderRadius: "6px",
            padding: "24px", marginTop: "8px",
          }
        },
          React.createElement("div", { style: {
            fontFamily: "'Playfair Display', serif", fontSize: "1.4rem",
            color: "#e8a946", marginBottom: "8px",
          } }, "🎬 " + selDir.name),
          React.createElement("div", { style: {
            fontFamily: "'DM Sans'", fontSize: "0.8rem", color: "#888", marginBottom: "16px",
          } }, selDir.count + " video dedicati · Generi: " + (selDir.genres || []).join(", ")),
          React.createElement("div", { style: {
            fontFamily: "'DM Sans'", fontSize: "0.75rem", color: "#555",
            marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.1em",
          } }, "Video dedicati:"),
          React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "4px" } },
            (selDir.videos || []).map(function(v) {
              return React.createElement("a", {
                key: v.id,
                href: "https://youtube.com/watch?v=" + v.id,
                target: "_blank", rel: "noopener noreferrer",
                style: {
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", background: "#0a0a0a", borderRadius: "4px",
                  border: "1px solid #1a1a1a", textDecoration: "none",
                }
              },
                React.createElement("span", { style: { color: "#ccc", fontSize: "0.82rem", fontFamily: "'DM Sans'" } }, v.t),
                React.createElement("span", { style: { color: "#444", fontSize: "0.7rem", fontFamily: "'DM Mono'" } }, v.d || "")
              );
            })
          )
        ),

        // Selected genre highlight info
        selectedGenre && React.createElement("div", {
          style: {
            textAlign: "center", padding: "16px", marginTop: "8px",
            background: "#0d0b08", border: "1px solid #1a150d", borderRadius: "6px",
          }
        },
          React.createElement("span", { style: {
            fontFamily: "'DM Sans'", fontSize: "0.85rem",
            color: GENRE_COLORS[selectedGenre] || "#888",
          } }, "Filtro attivo: " + selectedGenre + " (" + genreDirs.length + " registi)"),
          React.createElement("span", {
            onClick: function() { setSelectedGenre(null); },
            style: { color: "#555", cursor: "pointer", marginLeft: "12px", fontSize: "0.8rem" }
          }, "✕ rimuovi filtro")
        ),

        // Legend
        !selectedDirector && !selectedGenre && React.createElement("div", {
          style: {
            textAlign: "center", padding: "12px",
            fontFamily: "'DM Sans'", fontSize: "0.75rem", color: "#444",
          }
        }, "Clicca su un regista per vedere i suoi video · Clicca su un genere per filtrare")
      ),

      // === GENRE CONNECTIONS ===
      selectedView === "genres" && React.createElement("div", {
        style: { background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "40px" }
      },
        Object.entries(genreConnections).sort(function(a, b) { return b[1].length - a[1].length; }).map(function(entry) {
          var genre = entry[0], dirs = entry[1];
          return React.createElement("div", {
            key: genre,
            style: {
              borderLeft: "3px solid " + (GENRE_COLORS[genre] || "#555"),
              paddingLeft: "20px", marginBottom: "24px",
            }
          },
            React.createElement("div", { style: {
              fontFamily: "'Playfair Display', serif", fontSize: "1.2rem",
              color: GENRE_COLORS[genre] || "#888", marginBottom: "10px",
            } }, genre + " ", React.createElement("span", { style: { fontSize: "0.7rem", color: "#555" } }, "(" + dirs.length + " registi)")),
            React.createElement("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
              dirs.map(function(d) {
                var dir = directors.find(function(dd) { return dd.name === d; });
                var otherGenres = dir ? dir.genres.filter(function(g) { return g !== genre; }) : [];
                return React.createElement("div", {
                  key: d,
                  style: {
                    background: (GENRE_COLORS[genre] || "#555") + "08",
                    border: "1px solid " + (GENRE_COLORS[genre] || "#555") + "22",
                    borderRadius: "4px", padding: "8px 12px",
                  }
                },
                  React.createElement("div", { style: { fontFamily: "'DM Sans'", fontSize: "0.82rem", color: "#ccc" } }, d),
                  dir && React.createElement("div", { style: {
                    fontFamily: "'DM Mono'", fontSize: "0.65rem", color: "#555", marginTop: "2px",
                  } }, dir.count + " video" + (otherGenres.length > 0 ? " · anche: " + otherGenres.join(", ") : ""))
                );
              })
            )
          );
        })
      ),

      // === YEARLY DISTRIBUTION ===
      selectedView === "years" && React.createElement("div", {
        style: { background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "40px" }
      },
        React.createElement("div", { style: { maxWidth: 700, margin: "0 auto" } },
          Object.entries(yearlyDist).sort().map(function(entry) {
            var year = entry[0], count = entry[1];
            var maxCount = Math.max.apply(null, Object.values(yearlyDist));
            var pct = (count / maxCount) * 100;
            return React.createElement("div", {
              key: year,
              style: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }
            },
              React.createElement("span", { style: { fontFamily: "'DM Mono'", fontSize: "0.8rem", color: "#e8a946", minWidth: "40px" } }, year),
              React.createElement("div", { style: { flex: 1, height: "22px", background: "#111", borderRadius: "3px", overflow: "hidden" } },
                React.createElement("div", { style: {
                  width: pct + "%", height: "100%",
                  background: "linear-gradient(90deg, #e8a946, #c45c4a)",
                  borderRadius: "3px", display: "flex", alignItems: "center",
                  justifyContent: "flex-end", paddingRight: "8px",
                  transition: "width 0.8s ease",
                } },
                  pct > 15 && React.createElement("span", { style: {
                    fontFamily: "'DM Mono'", fontSize: "0.65rem", color: "#0a0a0a", fontWeight: 700,
                  } }, count)
                )
              ),
              pct <= 15 && React.createElement("span", { style: { fontFamily: "'DM Mono'", fontSize: "0.7rem", color: "#555" } }, count)
            );
          })
        )
      ),

      // === CATEGORY DISTRIBUTION ===
      selectedView === "categories" && React.createElement("div", {
        style: { background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "40px" }
      },
        React.createElement("div", { style: { maxWidth: 600, margin: "0 auto" } },
          Object.entries(catDist).sort(function(a, b) { return b[1] - a[1]; }).map(function(entry) {
            var catId = entry[0], count = entry[1];
            var meta = CATEGORY_META[catId] || CATEGORY_META.altro;
            var total = Object.values(catDist).reduce(function(s, c) { return s + c; }, 0);
            var pct = (count / total) * 100;
            return React.createElement("div", { key: catId, style: { marginBottom: "14px" } },
              React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "5px" } },
                React.createElement("span", { style: { fontFamily: "'DM Sans'", fontSize: "0.85rem", color: "#ccc" } },
                  (meta.icon || "📽️") + " " + (meta.label || catId)),
                React.createElement("span", { style: { fontFamily: "'DM Mono'", fontSize: "0.75rem", color: "#666" } },
                  count + " · " + pct.toFixed(1) + "%")
              ),
              React.createElement("div", { style: { height: "6px", background: "#111", borderRadius: "3px", overflow: "hidden" } },
                React.createElement("div", { style: {
                  width: pct + "%", height: "100%", background: meta.color,
                  borderRadius: "3px", transition: "width 0.8s ease",
                } })
              )
            );
          })
        )
      )
    )
  );
}

// ============================================================
// TIMELINE
// ============================================================

function TimelineSection() {
  return (
    <div style={{ padding: "60px 24px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div style={{
          fontFamily: "'DM Sans'", fontSize: "0.65rem",
          letterSpacing: "0.3em", textTransform: "uppercase",
          color: "#e8a94666", marginBottom: "12px",
        }}>Cronologia</div>
        <h2 style={{
          fontFamily: "'Playfair Display', serif", fontSize: "2.5rem",
          color: "#f0e6d2", fontWeight: 400, margin: 0,
        }}>Una vita per il <span style={{ fontStyle: "italic", color: "#e8a946" }}>Cinema</span></h2>
      </div>

      <div style={{ position: "relative", paddingLeft: "40px" }}>
        <div style={{
          position: "absolute", left: "15px", top: 0, bottom: 0,
          width: "1px", background: "linear-gradient(180deg, #e8a94644, #e8a94611)",
        }} />
        {TIMELINE.map((event, i) => (
          <div key={i} style={{
            marginBottom: i === TIMELINE.length - 1 ? 0 : "36px",
            position: "relative",
          }}>
            <div style={{
              position: "absolute", left: "-32px", top: "4px",
              width: "10px", height: "10px", borderRadius: "50%",
              background: event.year === 2026 ? "#c45c4a" : "#e8a946",
              border: `2px solid ${event.year === 2026 ? "#c45c4a44" : "#e8a94644"}`,
              boxShadow: `0 0 12px ${event.year === 2026 ? "#c45c4a33" : "#e8a94622"}`,
            }} />
            <div style={{
              fontFamily: "'DM Mono'", fontSize: "0.75rem",
              color: event.year === 2026 ? "#c45c4a" : "#e8a946",
              marginBottom: "4px",
            }}>{event.year}</div>
            <div style={{
              fontFamily: "'DM Sans'", fontSize: "1rem",
              color: event.year === 2026 ? "#c45c4a99" : "#ccc",
              fontStyle: event.year === 2026 ? "italic" : "normal",
            }}>{event.label}</div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: "60px", textAlign: "center", padding: "40px",
        background: "#0d0b08", border: "1px solid #1a150d", borderRadius: "4px",
      }}>
        <div style={{
          fontFamily: "'Playfair Display', serif", fontSize: "1.8rem",
          color: "#e8a946", fontStyle: "italic", marginBottom: "8px",
        }}>"Federico vive"</div>
        <div style={{
          fontFamily: "'DM Sans'", fontSize: "0.8rem", color: "#555",
        }}>Murale in via Magenta, Livorno — di fronte all'ex Videodrome</div>
      </div>
    </div>
  );
}

// ============================================================
// PROJECT INFO
// ============================================================

function ProjectInfo() {
  return (
    <div style={{ padding: "60px 24px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div style={{
          fontFamily: "'DM Sans'", fontSize: "0.65rem",
          letterSpacing: "0.3em", textTransform: "uppercase",
          color: "#e8a94666", marginBottom: "12px",
        }}>Informazioni</div>
        <h2 style={{
          fontFamily: "'Playfair Display', serif", fontSize: "2.5rem",
          color: "#f0e6d2", fontWeight: 400, margin: 0,
        }}>Il <span style={{ fontStyle: "italic", color: "#e8a946" }}>Progetto</span></h2>
      </div>

      <div style={{
        fontFamily: "'DM Sans'", fontSize: "0.9rem", color: "#999", lineHeight: 1.9,
      }}>
        <p style={{ marginBottom: "20px" }}>
          Questo archivio digitale nasce dal desiderio di preservare e rendere accessibile
          a tutti l'enorme patrimonio culturale lasciato da Federico Frusciante.
          Oltre 4000 video, dal 2014 al 2026, sono stati trascritti integralmente.
        </p>

        <div style={{
          background: "#0d0b08", border: "1px solid #1a150d",
          borderRadius: "4px", padding: "24px", marginBottom: "24px",
        }}>
          <div style={{
            fontFamily: "'Playfair Display', serif", fontSize: "1.1rem",
            color: "#e8a946", marginBottom: "16px",
          }}>Come funziona il sistema</div>
          <div style={{
            fontFamily: "'DM Mono'", fontSize: "0.78rem", color: "#888",
            lineHeight: 2, background: "#0a0a0a", padding: "16px",
            borderRadius: "3px", border: "1px solid #1a1a1a",
          }}>
            <div style={{ color: "#555" }}># 1. I tuoi file originali</div>
            <div>data/transcripts/</div>
            <div style={{ color: "#666", paddingLeft: "16px" }}>├── <span style={{ color: "#e8a946" }}>20141023</span>_<span style={{ color: "#5bb5a2" }}>WZVnQNsfQe4</span>_<span style={{ color: "#c45c4a" }}>Titolo</span>.json</div>
            <div style={{ color: "#666", paddingLeft: "16px" }}>└── <span style={{ color: "#e8a946" }}>20141023</span>_<span style={{ color: "#5bb5a2" }}>WZVnQNsfQe4</span>_<span style={{ color: "#c45c4a" }}>Titolo</span>.txt</div>
            <br />
            <div style={{ color: "#555" }}># 2. Esegui il build</div>
            <div>python build_index.py --input data/transcripts --output site/data</div>
            <br />
            <div style={{ color: "#555" }}># 3. Viene generato:</div>
            <div>site/data/</div>
            <div style={{ color: "#666", paddingLeft: "16px" }}>├── index.json          <span style={{ color: "#555" }}>← catalogo completo</span></div>
            <div style={{ color: "#666", paddingLeft: "16px" }}>├── stats.json          <span style={{ color: "#555" }}>← statistiche</span></div>
            <div style={{ color: "#666", paddingLeft: "16px" }}>├── directors.json      <span style={{ color: "#555" }}>← mappa registi</span></div>
            <div style={{ color: "#666", paddingLeft: "16px" }}>├── films.json          <span style={{ color: "#555" }}>← film citati</span></div>
            <div style={{ color: "#666", paddingLeft: "16px" }}>├── categories.json     <span style={{ color: "#555" }}>← categorie</span></div>
            <div style={{ color: "#666", paddingLeft: "16px" }}>└── transcripts/        <span style={{ color: "#555" }}>← 4000+ file singoli</span></div>
            <br />
            <div style={{ color: "#555" }}># 4. Pubblica gratis su GitHub Pages</div>
            <div>git push → il sito è online!</div>
          </div>
        </div>

        <p style={{ marginBottom: "20px" }}>
          L'archivio è organizzato in categorie derivate automaticamente dai titoli dei video,
          e arricchito con mappe concettuali che collegano registi, generi, e temi ricorrenti
          nell'universo cinematografico di Federico.
        </p>

        <div style={{
          background: "#0d0b08", border: "1px solid #1a150d",
          borderRadius: "4px", padding: "24px",
        }}>
          <div style={{
            fontFamily: "'Playfair Display', serif", fontSize: "1.1rem",
            color: "#e8a946", marginBottom: "12px",
          }}>Contribuire</div>
          <p style={{ margin: 0 }}>
            Questo è un progetto aperto e gratuito, creato dalla community per la community.
            Se vuoi contribuire — correzioni, trascrizioni mancanti, suggerimenti —
            il codice è su GitHub. Il sogno di Federico era una Casa del Cinema a Livorno.
            Questo archivio è un primo passo.
          </p>
        </div>
      </div>

      <div style={{
        marginTop: "40px", textAlign: "center", padding: "32px",
        borderTop: "1px solid #1a1a1a",
      }}>
        <div style={{
          fontFamily: "'DM Sans'", fontSize: "0.65rem",
          letterSpacing: "0.2em", textTransform: "uppercase",
          color: "#444", marginBottom: "16px",
        }}>I Criticoni</div>
        <div style={{
          fontFamily: "'DM Sans'", fontSize: "0.85rem", color: "#888",
        }}>Federico Frusciante • Francesco Alò • Davide Marra • Mattia Ferrari</div>
      </div>
    </div>
  );
}

// ============================================================
// FOOTER
// ============================================================

function Footer() {
  return (
    <footer style={{
      padding: "60px 24px", textAlign: "center", borderTop: "1px solid #111",
    }}>
      <div style={{
        fontFamily: "'Playfair Display', serif", fontSize: "1.5rem",
        color: "#e8a94644", marginBottom: "16px", fontStyle: "italic",
      }}>Federico vive</div>
      <div style={{
        fontFamily: "'DM Sans'", fontSize: "0.7rem",
        color: "#333", letterSpacing: "0.1em", lineHeight: 1.8,
      }}>
        28 agosto 1973 — 15 febbraio 2026<br />
        Un archivio di passione, cultura e cinema indipendente.<br />
        Progetto open source • Libero accesso per tutti
      </div>
    </footer>
  );
}

// ============================================================
// MAIN APP
// ============================================================

window.FruscianteMemorial = function FruscianteMemorial() {
  const [activeSection, setActiveSection] = useState("home");
  const { data: statsData } = useJsonData("stats.json");

  return (
    <div style={{
      background: "#0a0a0a", color: "#f0e6d2", minHeight: "100vh",
      fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: #e8a94644; color: #f0e6d2; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a0a; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 3px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        input::placeholder { color: #444; }
        select option { background: #111; color: #ccc; }
        a { transition: opacity 0.2s; }
        a:hover { opacity: 0.85; }
      `}</style>

      <FilmGrain />
      <Nav active={activeSection} setActive={setActiveSection} />

      {activeSection === "home" && (
        <>
          <HeroSection stats={statsData} />
          <VideodromeTribute stats={statsData} onNavigate={setActiveSection} />
        </>
      )}
      {activeSection === "archivio" && <ArchiveSection />}
      {activeSection === "mappa" && <ConceptMap />}
      {activeSection === "timeline" && <TimelineSection />}
      {activeSection === "info" && <ProjectInfo />}

      <Footer />
    </div>
  );
}
