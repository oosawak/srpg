// Dynamically renders the battles portal list from scenarios/manifest.json + scenarios/*.md.
(function initBattlesPortal() {
  const grid = document.getElementById("battleCardGrid");
  const countBadge = document.getElementById("portalCountBadge");
  if (!grid || !window.srpgScenarioParser) return;

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderCards(scenarios) {
    if (countBadge) {
      countBadge.textContent = `収録合戦 ${scenarios.length} 本`;
    }
    grid.innerHTML = scenarios
      .map((sc) => {
        const hasArt = Boolean(sc.keyart);
        const artUrl = hasArt
          ? new URL(sc.keyart, new URL(`./scenarios/${sc.slug}.md`, window.location.href)).href
          : "";
        const topStyle = hasArt ? ` style="background-image:url('${escapeHtml(artUrl)}')"` : "";
        const topClass = hasArt ? "battleCardTop has-keyart" : "battleCardTop";
        const playerCount = sc.units.filter((u) => u.team === "player").length;
        const enemyCount = sc.units.filter((u) => u.team === "enemy").length;
        const reinfCount = sc.units.filter((u) => (u.spawnTurn ?? 1) > 1).length;
        const extraPill = sc.extra
          ? `<span class="battleExtraPill">${escapeHtml(sc.extra)}</span>`
          : "";
        const reinfChip =
          reinfCount > 0 ? `<span class="battleCardChip">増援 ${reinfCount}部隊</span>` : "";
        const bookRow = sc.bookUrl
          ? `<a class="bookLinkInline" href="${escapeHtml(sc.bookUrl)}" target="_blank" rel="noopener noreferrer">📖 ${escapeHtml(sc.bookChapter || "『伊達の国』")} ↗</a>`
          : "";

        return `
          <article class="battleCard">
            <div class="${topClass}"${topStyle}>
              <div class="battleCardBadgeRow">
                <span class="battleYearPill">${escapeHtml(sc.year ? `${sc.year}年` : sc.date)}</span>
                ${extraPill}
              </div>
              <h2>${escapeHtml(sc.title)}</h2>
              <p class="battleCardPlace">${escapeHtml(sc.date)} ／ ${escapeHtml(sc.place)}</p>
            </div>
            <div class="battleCardBody">
              <p class="battleCardForces">${escapeHtml(sc.forces)}</p>
              <p class="battleCardOverview">${escapeHtml(sc.overview)}</p>
              <p class="battleCardWin"><strong>勝利条件:</strong> ${escapeHtml(sc.victoryText)}</p>
              <div class="battleCardMeta">
                <span class="battleCardChip">盤面 ${sc.map.width}×${sc.map.height}</span>
                <span class="battleCardChip">${escapeHtml(sc.playerArmy)} ${playerCount}部隊</span>
                <span class="battleCardChip">${escapeHtml(sc.enemyArmy)} ${enemyCount}部隊</span>
                ${reinfChip}
                ${sc.rules.maxTurns ? `<span class="battleCardChip">最大 ${sc.rules.maxTurns}T</span>` : ""}
              </div>
              ${bookRow}
              <div class="battleCardActions">
                <a class="battlePlayLink" href="./${escapeHtml(sc.slug)}/">出陣する →</a>
                <a class="battleAutoLink" href="./${escapeHtml(sc.slug)}/?auto=1">自動で見る</a>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function loadFromMarkdown() {
    try {
      const resp = await fetch("./scenarios/manifest.json", { cache: "no-cache" });
      if (!resp.ok) return;
      const manifest = await resp.json();
      const files = Array.isArray(manifest?.files) ? manifest.files : [];
      if (files.length === 0) return;

      const parsedList = await Promise.all(
        files.map(async (file) => {
          const r = await fetch(`./scenarios/${file}`, { cache: "no-cache" });
          if (!r.ok) throw new Error(`failed to fetch ${file}`);
          const md = await r.text();
          return window.srpgScenarioParser.parseScenarioMarkdown(md);
        })
      );

      parsedList.sort((a, b) => a.order - b.order || a.year - b.year || a.slug.localeCompare(b.slug));
      renderCards(parsedList);
    } catch (err) {
      console.warn("[SRPG Battles Portal] dynamic load fallback to pre-rendered list:", err);
    }
  }

  loadFromMarkdown();
})();
