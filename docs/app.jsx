const { useState, useEffect, useRef, useMemo, useCallback } = React;


// ============================================================
// FEDERICO FRUSCIANTE — DIGITAL MEMORIAL
// Versione con caricamento dati reali
// ============================================================

const DATA_BASE_URL = "./data"; // Percorso ai file generati da build_index.py

// Palette "site-like" (oro → ruggine → verdi/blu/viola)
const PALETTE = [
  "#e8a946", // gold
  "#c45c4a", // rust
  "#6aaa64", // green
  "#4a90c4", // blue
  "#8b6cc1", // purple
  "#5bb5a2", // teal
  "#8a4a4a", // dark red
  "#d4a853", // warm gold
  "#c49a6c", // sand
];

function hashColor(key) {
  const s = String(key || "");
  let h = 2166136261; // FNV-ish
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

const CATEGORY_META = {
  patreon: { icon: "💛", color: "#e8a946" },
  al_cinema: { icon: "🎟️", color: "#4a90c4" },
  consigli: { icon: "🎬", color: "#e8a946" },
  consigli_brevi: { icon: "🎬", color: "#e8a946" },
  monografie: { icon: "🎭", color: "#c45c4a" },
  classici: { icon: "📼", color: "#d4a853" },
  musicali: { icon: "🎵", color: "#8b6cc1" },
  saghe: { icon: "🧩", color: "#6aaa64" },
  oriente: { icon: "🀄", color: "#5bb5a2" },
  letterari: { icon: "📚", color: "#d4a853" },
  meglio_peggio: { icon: "🏆", color: "#d4a853" },
  imperdibili: { icon: "✅", color: "#6aaa64" },
  underground: { icon: "🕳️", color: "#8a4a4a" },
  eventi: { icon: "📍", color: "#4a90c4" },
  reboot: { icon: "🔄", color: "#4a90c4" },
  con_lomuscio: { icon: "🤝", color: "#c49a6c" },
  interviste: { icon: "🎤", color: "#c49a6c" },
  vlog: { icon: "📹", color: "#888" },
  quarantena: { icon: "🏠", color: "#888" },
  scifi: { icon: "🚀", color: "#5bb5a2" },
  speciali: { icon: "🌟", color: "#d4a853" },
  altro: { icon: "📽️", color: "#888" },
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
                  }}>{meta.icon} {catId}</span>
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
            }}>{meta.icon} {label} ({count})</button>
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
  const { data: directorsData, loading: l1, error: e1 } = useJsonData("directors.json");
  const { data: statsData, loading: l2, error: e2 } = useJsonData("stats.json");
  const { data: filmsData, loading: l3, error: e3 } = useJsonData("films.json");
  const { data: indexData, loading: l4, error: e4 } = useJsonData("index.json");

  const loading = l1 || l2 || l3 || l4;
  const error = e1 || e2 || e3 || e4;

  const [selectedView, setSelectedView] = useState("directors");

  // Directors view controls
  const [topN, setTopN] = useState(36);
  const [genreFilter, setGenreFilter] = useState("all");
  const [q, setQ] = useState("");
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedDirector, setSelectedDirector] = useState(null);

  // Films view controls
  const [filmQuery, setFilmQuery] = useState("");
  const [selectedFilm, setSelectedFilm] = useState(null);

  // Normalize raw directors schema (count vs video_count)
  const directors = useMemo(() => {
    const raw = directorsData?.directors || [];
    return raw
      .map(d => ({
        name: d.name,
        video_count: (d.video_count ?? d.count ?? 0) * 1,
        genres: Array.isArray(d.genres) ? d.genres : [],
        videos: Array.isArray(d.videos) ? d.videos : [],
      }))
      .sort((a, b) => (b.video_count || 0) - (a.video_count || 0));
  }, [directorsData]);

  const genreConnections = directorsData?.genre_connections || {};

  const genres = useMemo(() => {
    const keys = Object.keys(genreConnections || {});
    if (keys.length) {
      return keys
        .map(g => ({ genre: g, directors: genreConnections[g] || [] }))
        .sort((a, b) => (b.directors.length - a.directors.length) || a.genre.localeCompare(b.genre));
    }
    const cnt = {};
    directors.forEach(d => (d.genres || []).forEach(g => { cnt[g] = (cnt[g] || 0) + 1; }));
    return Object.entries(cnt)
      .map(([genre, c]) => ({ genre, directors: [], count: c }))
      .sort((a, b) => (b.count - a.count) || a.genre.localeCompare(b.genre));
  }, [directors, genreConnections]);

  const genreColor = useCallback((genre) => hashColor(`genre:${genre}`), []);

  // Filtered directors list
  const shownDirectors = useMemo(() => {
    let list = directors;

    if (genreFilter !== "all") list = list.filter(d => (d.genres || []).includes(genreFilter));

    const qq = (q || "").trim().toLowerCase();
    if (qq) list = list.filter(d => String(d.name || "").toLowerCase().includes(qq));

    return list.slice(0, Math.max(12, Math.min(topN, 90)));
  }, [directors, topN, genreFilter, q]);

  // Position nodes in rings; cluster by genre (first genre)
  const directorNodes = useMemo(() => {
    const cx = 400, cy = 300;
    const perRing = 18;
    const ringStep = 70;

    const sorted = [...shownDirectors].sort((a, b) => {
      const ga = (a.genres && a.genres[0]) ? a.genres[0] : "—";
      const gb = (b.genres && b.genres[0]) ? b.genres[0] : "—";
      const gcmp = ga.localeCompare(gb);
      if (gcmp) return gcmp;
      const ccmp = (b.video_count || 0) - (a.video_count || 0);
      if (ccmp) return ccmp;
      return String(a.name).localeCompare(String(b.name));
    });

    return sorted.map((d, i) => {
      const ring = Math.floor(i / perRing);
      const idx = i % perRing;
      const angle = (idx / perRing) * Math.PI * 2 - Math.PI / 2;
      const radius = 160 + ring * ringStep;

      const base = 16;
      const r = base + Math.min((d.video_count || 0), 20) * 1.8;

      return {
        ...d,
        id: `dir:${d.name}`,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        r,
        primaryGenre: (d.genres && d.genres[0]) ? d.genres[0] : null,
      };
    });
  }, [shownDirectors]);

  // Shared-genre links for hover (only among displayed nodes)
  const sharedLinks = useMemo(() => {
    const nodes = directorNodes;
    const byGenre = {};
    nodes.forEach(n => (n.genres || []).forEach(g => {
      if (!byGenre[g]) byGenre[g] = [];
      byGenre[g].push(n);
    }));

    const neigh = {};
    nodes.forEach(a => { neigh[a.id] = {}; });

    for (const g of Object.keys(byGenre)) {
      const arr = byGenre[g];
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i].id, b = arr[j].id;
          neigh[a][b] = (neigh[a][b] || 0) + 1;
          neigh[b][a] = (neigh[b][a] || 0) + 1;
        }
      }
    }
    return neigh;
  }, [directorNodes]);

  const yearlyDist = statsData?.yearly_distribution || {};
  const catDist = statsData?.category_distribution || {};
  const films = filmsData?.films || [];
  const catalog = indexData?.catalog || [];

  // ---- Helpers: film extraction & catalog search ----
  const extractFilmKey = useCallback((title) => {
    if (!title) return null;
    const m = String(title).match(/[：:]\s*[＂"«“]?(.+?)[＂"»”]?\s*\((\d{4})\)/);
    if (!m) return null;
    const film = String(m[1] || "").trim();
    const year = String(m[2] || "").trim();
    if (!film || film.length < 2 || film.length > 90) return null;
    return `${film} (${year})`;
  }, []);

  const topFilmsForDirector = useCallback((dir) => {
    if (!dir || !Array.isArray(dir.videos)) return [];
    const cnt = {};
    dir.videos.forEach(v => {
      const fk = extractFilmKey(v.t);
      if (!fk) return;
      cnt[fk] = (cnt[fk] || 0) + 1;
    });
    return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [extractFilmKey]);

  const findVideosByFilmTitle = useCallback((filmTitle, limit = 40) => {
    const q = String(filmTitle || "").trim().toLowerCase();
    if (!q) return [];
    const out = [];
    for (let i = 0; i < catalog.length; i++) {
      const v = catalog[i];
      const t = String(v.t || "").toLowerCase();
      if (t.includes(q)) out.push(v);
      if (out.length >= limit) break;
    }
    out.sort((a, b) => String(b.d || "").localeCompare(String(a.d || "")));
    return out;
  }, [catalog]);

  const filmsShown = useMemo(() => {
    const qq = (filmQuery || "").trim().toLowerCase();
    const list = qq ? films.filter(f => String(f.title || "").toLowerCase().includes(qq)) : films;
    return list.slice(0, 140);
  }, [films, filmQuery]);

  useEffect(() => {
    setHoveredId(null);
    if (selectedView !== "directors") setSelectedDirector(null);
    if (selectedView !== "films") setSelectedFilm(null);
  }, [selectedView]);

  if (loading) return <LoadingIndicator message="Caricamento mappa..." />;
  if (error) return <ErrorMessage message={error} />;

  const maxYearCount = Math.max(1, ...Object.values(yearlyDist));
  const totalCat = Object.values(catDist).reduce((s, c) => s + c, 0) || 1;

  return (
    <div style={{ padding: "60px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div style={{
          fontFamily: "'DM Sans'", fontSize: "0.65rem",
          letterSpacing: "0.3em", textTransform: "uppercase",
          color: "#e8a94666", marginBottom: "12px",
        }}>Visualizzazioni</div>

        <h2 style={{
          fontFamily: "'Playfair Display', serif", fontSize: "2.5rem",
          color: "#f0e6d2", fontWeight: 400, margin: "0 0 24px",
        }}>
          Mappa <span style={{ fontStyle: "italic", color: "#e8a946" }}>Concettuale</span>
        </h2>

        <div style={{ display: "flex", gap: "6px", justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { id: "directors", label: "🎬 Registi" },
            { id: "genres", label: "🎭 Generi" },
            { id: "films", label: "🎞️ Film" },
            { id: "years", label: "📅 Per Anno" },
            { id: "categories", label: "📊 Categorie" },
          ].map(v => (
            <button key={v.id} onClick={() => setSelectedView(v.id)} style={{
              background: selectedView === v.id ? "#e8a94615" : "#111",
              border: `1px solid ${selectedView === v.id ? "#e8a94644" : "#222"}`,
              color: selectedView === v.id ? "#e8a946" : "#666",
              padding: "8px 16px", borderRadius: "4px", cursor: "pointer",
              fontFamily: "'DM Sans'", fontSize: "0.8rem",
            }}>{v.label}</button>
          ))}
        </div>
      </div>

      {/* DIRECTORS */}
      {selectedView === "directors" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: "12px", marginBottom: "14px" }}>
            <div style={{
              background: "#0a0a0a", border: "1px solid #1a1a1a",
              borderRadius: "8px", padding: "12px",
              display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center",
            }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca regista…"
                style={{
                  flex: "1 1 260px", background: "#0f0f0f",
                  border: "1px solid #222", color: "#ccc",
                  padding: "10px 12px", borderRadius: "4px",
                  fontFamily: "'DM Sans'", fontSize: "0.85rem",
                }} />

              <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}
                style={{
                  background: "#0f0f0f", border: "1px solid #222", color: "#ccc",
                  padding: "10px 12px", borderRadius: "4px",
                  fontFamily: "'DM Sans'", fontSize: "0.82rem",
                }}>
                <option value="all">Tutti i generi</option>
                {genres.map(g => <option key={g.genre} value={g.genre}>{g.genre}</option>)}
              </select>

              <div style={{ color: "#555", fontFamily: "'DM Mono'", fontSize: "0.7rem" }}>
                Top: <span style={{ color: "#e8a946" }}>{Math.max(12, Math.min(topN, 90))}</span>
              </div>

              <input type="range" min="12" max="90" step="6" value={topN}
                onChange={(e) => setTopN(parseInt(e.target.value, 10))}
                style={{ width: "160px" }} />
            </div>

            <div style={{
              background: "#0a0a0a", border: "1px solid #1a1a1a",
              borderRadius: "8px", padding: "12px",
              fontFamily: "'DM Mono'", fontSize: "0.72rem", color: "#555",
              display: "flex", alignItems: "center", justifyContent: "center",
              textAlign: "center",
            }}>
              Hover = connessioni per genere • Click = dettagli
            </div>
          </div>

          <div style={{
            background: "#0a0a0a", border: "1px solid #1a1a1a",
            borderRadius: "8px", padding: "20px", overflow: "hidden",
          }}>
            <svg viewBox="0 0 800 600" style={{ width: "100%", maxHeight: "620px" }}>
              <circle cx="400" cy="300" r="52" fill="#e8a94610" stroke="#e8a94633" strokeWidth="1" />
              <text x="400" y="296" textAnchor="middle" fill="#e8a946"
                fontFamily="Playfair Display, serif" fontSize="13" fontWeight="700">FEDERICO</text>
              <text x="400" y="311" textAnchor="middle" fill="#e8a94688"
                fontFamily="DM Sans, sans-serif" fontSize="8">FRUSCIANTE</text>

              {directorNodes.map((d, i) => (
                <line key={`s${i}`} x1="400" y1="300" x2={d.x} y2={d.y}
                  stroke="#e8a94610" strokeWidth="0.5" strokeDasharray="3 6" />
              ))}

              {(() => {
                const activeId = selectedDirector?.id || hoveredId;
                if (!activeId || !sharedLinks[activeId]) return null;
                const active = directorNodes.find(n => n.id === activeId);
                if (!active) return null;

                const neigh = sharedLinks[activeId] || {};
                return Object.entries(neigh)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 18)
                  .map(([toId, w]) => {
                    const b = directorNodes.find(n => n.id === toId);
                    if (!b) return null;
                    return (
                      <line key={`g${toId}`} x1={active.x} y1={active.y} x2={b.x} y2={b.y}
                        stroke="#e8a94644" strokeWidth={0.6 + w * 0.6} />
                    );
                  });
              })()}

              {directorNodes.map((d) => {
                const isHovered = hoveredId === d.id;
                const isSelected = selectedDirector?.id === d.id;
                const primary = d.primaryGenre ? genreColor(d.primaryGenre) : "#666";
                const textColor = isHovered || isSelected ? "#f0e6d2" : "#888";

                return (
                  <g key={d.id}
                    onMouseEnter={() => setHoveredId(d.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => setSelectedDirector(d)}
                    style={{ cursor: "pointer" }}>
                    <circle cx={d.x} cy={d.y} r={d.r}
                      fill={isHovered || isSelected ? "#0f0f0f" : "#0b0b0b"}
                      stroke={isHovered || isSelected ? "#e8a94666" : "#1a1a1a"}
                      strokeWidth={isHovered || isSelected ? 2 : 1} />
                    <circle cx={d.x} cy={d.y} r={Math.max(6, d.r - 4)}
                      fill="none" stroke={`${primary}66`} strokeWidth="1" />

                    <text x={d.x} y={d.y - 2} textAnchor="middle"
                      fill={textColor} fontFamily="DM Sans, sans-serif"
                      fontSize={String(d.name).length > 16 ? "6.5" : "7.5"} fontWeight="600">
                      {d.name}
                    </text>
                    <text x={d.x} y={d.y + 10} textAnchor="middle"
                      fill={isHovered || isSelected ? "#e8a946" : "#444"}
                      fontFamily="DM Mono, monospace" fontSize="7">
                      {d.video_count} video
                    </text>

                    {(isHovered || isSelected) && d.genres?.length > 0 && (
                      <text x={d.x} y={d.y + 20} textAnchor="middle"
                        fill="#666" fontFamily="DM Sans, sans-serif" fontSize="6">
                        {d.genres.slice(0, 4).join(" · ")}{d.genres.length > 4 ? "…" : ""}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {selectedDirector && (
            <div style={{
              marginTop: "14px",
              background: "#0d0b08", border: "1px solid #1a150d",
              borderRadius: "8px", padding: "18px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", color: "#f0e6d2" }}>
                    {selectedDirector.name}
                  </div>
                  <div style={{ marginTop: "6px", fontFamily: "'DM Mono'", fontSize: "0.75rem", color: "#666" }}>
                    {selectedDirector.video_count} video • {(selectedDirector.genres || []).join(" · ") || "—"}
                  </div>
                </div>

                <button onClick={() => setSelectedDirector(null)} style={{
                  background: "#111", border: "1px solid #222", color: "#666",
                  padding: "8px 12px", borderRadius: "4px", cursor: "pointer",
                  fontFamily: "'DM Sans'", fontSize: "0.8rem",
                }}>Chiudi</button>
              </div>

              {(() => {
                const top = topFilmsForDirector(selectedDirector);
                if (!top.length) return null;
                return (
                  <div style={{ marginTop: "14px" }}>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#e8a94666", marginBottom: "8px" }}>
                      Film ricorrenti (dai titoli)
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {top.map(([k, c]) => (
                        <span key={k} style={{
                          background: "#111", border: "1px solid #222", color: "#aaa",
                          padding: "6px 10px", borderRadius: "999px",
                          fontFamily: "'DM Sans'", fontSize: "0.8rem",
                        }}>{k} <span style={{ color: "#555", fontFamily: "'DM Mono'" }}>×{c}</span></span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div style={{ marginTop: "14px" }}>
                <div style={{ fontFamily: "'DM Sans'", fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#e8a94666", marginBottom: "10px" }}>
                  Video (campione)
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  {(selectedDirector.videos || []).slice(0, 18).map(v => (
                    <a key={v.id} href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer"
                      style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "6px", padding: "10px 12px", textDecoration: "none" }}>
                      <div style={{ fontFamily: "'DM Sans'", fontSize: "0.9rem", color: "#ccc", lineHeight: 1.4 }}>{v.t}</div>
                      <div style={{ marginTop: "4px", fontFamily: "'DM Mono'", fontSize: "0.72rem", color: "#555" }}>{v.d} • {v.id}</div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* GENRES */}
      {selectedView === "genres" && (
        <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "34px" }}>
          {genres.map(({ genre, directors: dirs }) => (
            <div key={genre} style={{ borderLeft: `3px solid ${genreColor(genre)}`, paddingLeft: "20px", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.2rem", color: genreColor(genre) }}>{genre}</div>
                <div style={{ fontSize: "0.7rem", color: "#555", fontFamily: "'DM Mono'" }}>{dirs.length} registi</div>
              </div>

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {dirs.map(dn => (
                  <button key={dn} onClick={() => {
                    setSelectedView("directors");
                    setQ(dn);
                    setGenreFilter("all");
                    setTopN(36);
                  }} style={{
                    background: `${genreColor(genre)}10`,
                    border: `1px solid ${genreColor(genre)}22`,
                    borderRadius: "4px", padding: "8px 12px",
                    cursor: "pointer",
                  }}>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: "0.82rem", color: "#ccc", textAlign: "left" }}>{dn}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FILMS */}
      {selectedView === "films" && (
        <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "34px" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginBottom: "16px" }}>
            <input value={filmQuery} onChange={(e) => setFilmQuery(e.target.value)} placeholder="Cerca film…"
              style={{
                flex: "1 1 320px",
                background: "#0f0f0f", border: "1px solid #222", color: "#ccc",
                padding: "10px 12px", borderRadius: "4px",
                fontFamily: "'DM Sans'", fontSize: "0.85rem",
              }} />
            <div style={{ fontFamily: "'DM Mono'", fontSize: "0.72rem", color: "#555" }}>
              Mostrati: <span style={{ color: "#e8a946" }}>{filmsShown.length}</span> / {films.length}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "10px" }}>
            {filmsShown.map(f => (
              <button key={f.title} onClick={() => setSelectedFilm(f.title)} style={{
                background: selectedFilm === f.title ? "#e8a94612" : "#0f0f0f",
                border: `1px solid ${selectedFilm === f.title ? "#e8a94644" : "#1a1a1a"}`,
                borderRadius: "8px", padding: "12px", cursor: "pointer",
                textAlign: "left",
              }}>
                <div style={{ fontFamily: "'DM Sans'", fontSize: "0.95rem", color: "#ccc" }}>{f.title}</div>
                <div style={{ marginTop: "6px", fontFamily: "'DM Mono'", fontSize: "0.72rem", color: "#555" }}>
                  Occorrenze: <span style={{ color: "#e8a946" }}>{f.count}</span>
                </div>
              </button>
            ))}
          </div>

          {selectedFilm && (
            <div style={{ marginTop: "18px", background: "#0d0b08", border: "1px solid #1a150d", borderRadius: "8px", padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", color: "#f0e6d2" }}>{selectedFilm}</div>
                  <div style={{ marginTop: "6px", fontFamily: "'DM Mono'", fontSize: "0.75rem", color: "#666" }}>
                    Video correlati (match sul titolo)
                  </div>
                </div>
                <button onClick={() => setSelectedFilm(null)} style={{
                  background: "#111", border: "1px solid #222", color: "#666",
                  padding: "8px 12px", borderRadius: "4px", cursor: "pointer",
                  fontFamily: "'DM Sans'", fontSize: "0.8rem",
                }}>Chiudi</button>
              </div>

              <div style={{ marginTop: "14px", display: "grid", gap: "8px" }}>
                {findVideosByFilmTitle(selectedFilm, 40).map(v => (
                  <a key={v.id} href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer"
                    style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "6px", padding: "10px 12px", textDecoration: "none" }}>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: "0.9rem", color: "#ccc", lineHeight: 1.4 }}>{v.t}</div>
                    <div style={{ marginTop: "4px", fontFamily: "'DM Mono'", fontSize: "0.72rem", color: "#555" }}>{v.d} • {v.cl || v.c}</div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* YEARS */}
      {selectedView === "years" && (
        <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "40px" }}>
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            {Object.entries(yearlyDist).sort().map(([year, count]) => {
              const pct = (count / maxYearCount) * 100;
              return (
                <div key={year} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                  <span style={{ fontFamily: "'DM Mono'", fontSize: "0.8rem", color: "#e8a946", minWidth: "40px" }}>{year}</span>
                  <div style={{ flex: 1, height: "20px", background: "#111", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{
                      width: `${pct}%`, height: "100%",
                      background: `linear-gradient(90deg, #e8a946, #c45c4a)`,
                      borderRadius: "3px", transition: "width 0.8s ease",
                      display: "flex", alignItems: "center", justifyContent: "flex-end",
                      paddingRight: "8px",
                    }}>
                      {pct > 15 && <span style={{ fontFamily: "'DM Mono'", fontSize: "0.65rem", color: "#0a0a0a", fontWeight: 700 }}>{count}</span>}
                    </div>
                  </div>
                  {pct <= 15 && <span style={{ fontFamily: "'DM Mono'", fontSize: "0.7rem", color: "#555" }}>{count}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CATEGORIES */}
      {selectedView === "categories" && (
        <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "40px" }}>
          <div style={{ maxWidth: 650, margin: "0 auto" }}>
            {Object.entries(catDist).sort((a, b) => b[1] - a[1]).map(([catId, count]) => {
              const meta = CATEGORY_META[catId] || { icon: "📽️", color: hashColor(`cat:${catId}`) };
              const pct = (count / totalCat) * 100;
              return (
                <div key={catId} style={{ marginBottom: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                    <span style={{ fontFamily: "'DM Sans'", fontSize: "0.85rem", color: "#ccc" }}>{meta.icon} {catId}</span>
                    <span style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", color: "#666" }}>{count} • {pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: "6px", background: "#111", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: meta.color, borderRadius: "3px", transition: "width 0.8s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
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

       

        <p style={{ marginBottom: "20px" }}>
          L'archivio è organizzato in categorie derivate automaticamente dai titoli dei video,
          e arricchito con mappe concettuali che collegano registi, generi, e temi ricorrenti
          nell'universo cinematografico di Federico.
        </p>
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
