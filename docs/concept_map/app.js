/* global vis */
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
