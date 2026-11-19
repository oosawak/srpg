// Markdown Scenario Parser for SRPG Battles.
// Works in both Browser (window.srpgScenarioParser) and Node.js (module.exports).
(function initSrpgScenarioParser(globalScope) {
  const JOB_MAP = {
    足軽: "Ashigaru",
    ashigaru: "Ashigaru",
    槍: "Yari",
    槍隊: "Yari",
    yari: "Yari",
    弓: "Yumi",
    弓隊: "Yumi",
    yumi: "Yumi",
    鉄砲: "Teppo",
    鉄砲隊: "Teppo",
    teppo: "Teppo",
    忍者: "Ninja",
    ninja: "Ninja",
    軍師: "Strategist",
    大将: "Strategist",
    strategist: "Strategist",
  };

  const JOB_DEFAULTS = {
    Ashigaru: { hp: 100, atk: 14, mov: 4, range: 1 },
    Yari: { hp: 110, atk: 15, mov: 3, range: 1 },
    Yumi: { hp: 80, atk: 13, mov: 3, range: 3 },
    Teppo: { hp: 78, atk: 15, mov: 3, range: 2 },
    Ninja: { hp: 75, atk: 13, mov: 4, range: 1 },
    Strategist: { hp: 95, atk: 14, mov: 3, range: 1 },
  };

  const BASIS_MAP = {
    史実: "fact",
    fact: "fact",
    伝承: "legend",
    legend: "legend",
    創作: "fiction",
    fiction: "fiction",
  };

  const TERRAIN_MAP = {
    plain: "Plain",
    平地: "Plain",
    road: "Road",
    道: "Road",
    街道: "Road",
    castle: "Castle",
    城: "Castle",
    town: "Town",
    城下町: "Town",
    ricefield: "RiceField",
    田: "RiceField",
    田んぼ: "RiceField",
    terrace: "Terrace",
    段々畑: "Terrace",
    高台: "Terrace",
    mountain: "Mountain",
    山: "Mountain",
    water: "Water",
    川: "Water",
    水: "Water",
    堀: "Water",
  };

  const AI_ROLE_MAP = {
    escape: "escape",
    離脱: "escape",
    hold_bridge: "hold_bridge",
    橋防衛: "hold_bridge",
    殿: "hold_bridge",
    hold_pos: "hold_pos",
    防衛: "hold_pos",
    守備: "hold_pos",
    flank: "flank",
    側撃: "flank",
    大将狙い: "flank",
    general: "general",
    汎用: "general",
    enemy: "enemy",
    敵: "enemy",
  };

  function stripCodeTicks(str) {
    return String(str ?? "").trim().replace(/^`+|`+$/g, "").trim();
  }

  function parseBool(val, fallback = false) {
    if (typeof val === "boolean") return val;
    const s = String(val ?? "").trim().toLowerCase();
    if (!s) return fallback;
    if (["true", "yes", "1", "はい", "○", "◯", "あり", "有効"].includes(s)) return true;
    if (["false", "no", "0", "いいえ", "×", "なし", "無効", "-"].includes(s)) return false;
    return fallback;
  }

  function parseIntSafe(val, fallback = 0) {
    const n = Number.parseInt(String(val ?? "").trim(), 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeJob(raw) {
    const key = String(raw ?? "").trim();
    return JOB_MAP[key] || JOB_MAP[key.toLowerCase()] || "Ashigaru";
  }

  function normalizeTeam(raw) {
    const s = String(raw ?? "").trim().toLowerCase();
    if (s.includes("敵") || s === "enemy" || s === "2") return "enemy";
    return "player";
  }

  function normalizeBasis(raw) {
    const key = String(raw ?? "").trim();
    return BASIS_MAP[key] || BASIS_MAP[key.toLowerCase()] || "fiction";
  }

  function normalizeTerrain(raw) {
    const key = String(raw ?? "").trim();
    return TERRAIN_MAP[key] || TERRAIN_MAP[key.toLowerCase()] || "Plain";
  }

  function normalizeAiRole(raw, team) {
    if (team === "enemy") return "enemy";
    const key = String(raw ?? "").trim();
    if (!key || key === "-" || key === "—") return "general";
    return AI_ROLE_MAP[key] || AI_ROLE_MAP[key.toLowerCase()] || "general";
  }

  function parseFrontmatter(text) {
    const normalized = String(text ?? "").replace(/\r\n/g, "\n");
    const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) {
      return { meta: {}, body: normalized };
    }
    const meta = {};
    for (const rawLine of match[1].split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const k = line.slice(0, idx).trim();
      let v = line.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      meta[k] = v;
    }
    return { meta, body: match[2] };
  }

  function splitSections(body) {
    const sections = {};
    let currentH2 = "_root";
    let currentH3 = null;
    const lines = body.split("\n");

    function ensure(name) {
      if (!sections[name]) sections[name] = [];
    }
    ensure(currentH2);

    let inFence = false;
    for (const line of lines) {
      if (line.trim().startsWith("```")) {
        inFence = !inFence;
      }
      if (!inFence && line.startsWith("## ")) {
        currentH2 = line.slice(3).trim();
        currentH3 = null;
        ensure(currentH2);
        continue;
      }
      if (!inFence && line.startsWith("### ")) {
        currentH3 = line.slice(4).trim();
        ensure(`${currentH2} > ${currentH3}`);
        continue;
      }
      if (currentH3) {
        sections[`${currentH2} > ${currentH3}`].push(line);
      } else {
        sections[currentH2].push(line);
      }
    }

    const out = {};
    for (const [k, arr] of Object.entries(sections)) {
      out[k] = arr.join("\n").trim();
    }
    return out;
  }

  function parseBulletMap(sectionText) {
    const map = {};
    for (const rawLine of String(sectionText ?? "").split("\n")) {
      const line = rawLine.trim();
      if (!line.startsWith("- ")) continue;
      const content = line.slice(2).trim();
      const boldMatch = content.match(/^\*\*(.+?)\*\*\s*[:：]\s*(.*)$/);
      if (boldMatch) {
        map[boldMatch[1].trim()] = boldMatch[2].trim();
        continue;
      }
      const colonIdx = content.search(/[:：]/);
      if (colonIdx > 0) {
        map[content.slice(0, colonIdx).trim()] = content.slice(colonIdx + 1).trim();
      }
    }
    return map;
  }

  function parseMarkdownTable(sectionText) {
    const lines = String(sectionText ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("|"));
    if (lines.length < 3) return [];

    const splitRow = (row) =>
      row
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());

    const headers = splitRow(lines[0]);
    const rows = [];
    for (let i = 2; i < lines.length; i += 1) {
      if (/^\|[\s:|-]+\|$/.test(lines[i])) continue;
      const cells = splitRow(lines[i]);
      if (cells.length === 0) continue;
      const obj = {};
      for (let c = 0; c < headers.length; c += 1) {
        obj[headers[c]] = cells[c] ?? "";
      }
      rows.push(obj);
    }
    return rows;
  }

  function parseMarkdownLink(str) {
    const m = String(str ?? "").match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (!m) return null;
    return { label: m[1].trim(), url: m[2].trim() };
  }

  function parseOutcomeLine(raw, defaults) {
    if (!raw) return defaults;
    const parts = raw.split("|").map((s) => s.trim());
    if (parts.length >= 4) {
      return {
        cutinSub: parts[0],
        cutinTitle: parts[1],
        title: parts[2],
        lead: parts[3],
      };
    }
    if (parts.length === 3) {
      return {
        cutinSub: defaults.cutinSub,
        cutinTitle: parts[0],
        title: parts[1],
        lead: parts[2],
      };
    }
    return { ...defaults, lead: raw };
  }

  function parseMapBlock(mapSectionText) {
    const match = String(mapSectionText ?? "").match(/```(?:map|grid|text)?\n([\s\S]*?)```/);
    if (!match) {
      throw new Error("マップのコードブロック（```map ... ```）が見つかりません");
    }
    const rows = match[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.split(/\s+/));

    if (rows.length === 0) {
      throw new Error("マップグリッドが空です");
    }
    const width = rows[0].length;
    for (let y = 0; y < rows.length; y += 1) {
      if (rows[y].length !== width) {
        throw new Error(`マップの行 ${y} の列数が一致しません（期待 ${width}, 実際 ${rows[y].length}）`);
      }
    }
    return { width, height: rows.length, rows };
  }

  function extractOverview(sectionText) {
    return String(sectionText ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith(">"))
      .join("\n\n");
  }

  function extractQuoteNote(sectionText) {
    return String(sectionText ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith(">"))
      .map((l) => l.replace(/^>\s?/, ""))
      .join(" ");
  }

  function parseScenarioMarkdown(mdText) {
    const { meta, body } = parseFrontmatter(mdText);
    const sections = splitSections(body);

    const basicMap = parseBulletMap(sections["基本情報"] || "");
    const rulesMap = parseBulletMap(sections["特殊ルール"] || "");
    const bookLinkParsed = parseMarkdownLink(basicMap["該当章"] || "");

    const titleFromHeading = (sections["_root"] || "")
      .split("\n")
      .find((l) => l.trim().startsWith("# "))
      ?.replace(/^#\s+/, "")
      .trim();

    const title = meta.title || titleFromHeading || "無題の合戦";
    const slug = meta.slug || "custom";
    const year = parseIntSafe(meta.year, 0);
    const order = parseIntSafe(meta.order, 999);
    const date = meta.date || basicMap["年月日"] || "";
    const place = meta.place || basicMap["場所"] || "";
    const playerArmy = meta.player_army || "伊達軍";
    const enemyArmy = meta.enemy_army || "敵軍";
    const forces = meta.forces || basicMap["両軍と兵力"] || "";
    const bookChapter = meta.book_chapter || bookLinkParsed?.label || "";
    const bookUrl = meta.book_url || bookLinkParsed?.url || "";
    const keyart = meta.keyart || "";
    const theme = meta.theme || "autumn";
    const subtitle = meta.subtitle || "";
    const victoryText = basicMap["勝利条件"] || "";
    const defeatText = basicMap["敗北条件"] || "";
    const startMessage = basicMap["開戦メッセージ"] || `${title}が開戦。`;
    const overview = extractOverview(sections["概況"] || "");
    const mapNote = extractQuoteNote(sections["マップ"] || "");
    const unitNote = extractQuoteNote(sections["ユニット"] || "");

    // Legend table
    const legendSection =
      sections["マップ > 地形凡例"] ||
      sections["マップ > 凡例"] ||
      sections["地形凡例"] ||
      sections["凡例"] ||
      "";
    const legendRows = parseMarkdownTable(legendSection);
    const legendBySymbol = new Map();
    const legendList = [];

    for (const row of legendRows) {
      const symbol = stripCodeTicks(row["記号"] ?? row["symbol"] ?? "");
      if (!symbol) continue;
      const terrain = normalizeTerrain(row["地形"] ?? row["terrain"] ?? "Plain");
      const entry = {
        symbol,
        terrain,
        height: parseIntSafe(row["高さ"] ?? row["height"], terrain === "Water" ? 0 : 1),
        cover: parseBool(row["遮蔽"] ?? row["cover"], false),
        water: parseBool(row["水地"] ?? row["water"], terrain === "Water" || terrain === "RiceField"),
        bridge: parseBool(row["橋"] ?? row["bridge"], false),
        escape: parseBool(row["離脱"] ?? row["escape"], false),
        label: String(row["表示名"] ?? row["説明"] ?? row["label"] ?? terrain).trim(),
      };
      legendBySymbol.set(symbol, entry);
      legendList.push(entry);
    }

    // Map grid
    const grid = parseMapBlock(sections["マップ"] || "");
    const tiles = [];
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const sym = grid.rows[y][x];
        const def = legendBySymbol.get(sym);
        if (!def) {
          throw new Error(`未定義の地形記号 '${sym}' がマップ (${x},${y}) にあります`);
        }
        tiles.push({
          x,
          y,
          symbol: sym,
          terrain: def.terrain,
          height: def.height,
          cover: def.cover,
          water: def.water,
          bridge: def.bridge,
          escape: def.escape,
        });
      }
    }

    // Units table
    const unitRows = parseMarkdownTable(sections["ユニット"] || sections["ユニット表"] || "");
    const units = [];
    for (let i = 0; i < unitRows.length; i += 1) {
      const row = unitRows[i];
      const name = String(row["名前"] ?? row["部隊名"] ?? row["name"] ?? "").trim();
      const team = normalizeTeam(row["陣営"] ?? row["team"] ?? "player");
      const job = normalizeJob(row["兵種"] ?? row["job"] ?? "Ashigaru");
      const defaults = JOB_DEFAULTS[job] || JOB_DEFAULTS.Ashigaru;
      const coordRaw = String(row["配置"] ?? row["座標"] ?? row["pos"] ?? "0,0").trim();
      const coordMatch = coordRaw.match(/(-?\d+)\s*[,，\s]\s*(-?\d+)/);
      if (!coordMatch) {
        throw new Error(`ユニット '${name || i + 1}' の配置座標が不正です: ${coordRaw}`);
      }
      const x = Number.parseInt(coordMatch[1], 10);
      const y = Number.parseInt(coordMatch[2], 10);
      const hp = parseIntSafe(row["HP"] ?? row["hp"], defaults.hp);
      const atk = parseIntSafe(row["攻撃"] ?? row["atk"], defaults.atk);
      const mov = parseIntSafe(row["移動"] ?? row["mov"], defaults.mov);
      const range = parseIntSafe(row["射程"] ?? row["range"], defaults.range);
      const leader = parseBool(row["大将"] ?? row["leader"], false);
      const id = i + 1;
      const tag = String(row["識別"] ?? row["tag"] ?? "").trim() || `unit_${id}`;
      const role = String(row["役割"] ?? row["role"] ?? "").trim();
      const aiRole = normalizeAiRole(row["AI指針"] ?? row["ai_role"] ?? "", team);
      const basis = normalizeBasis(row["種別"] ?? row["basis"] ?? "fiction");
      const note = String(row["史実注記"] ?? row["注記"] ?? row["note"] ?? "").trim();

      units.push({
        id,
        clan: team === "enemy" ? 2 : 1,
        job,
        team,
        x,
        y,
        hp,
        maxHp: hp,
        atk,
        mov,
        range,
        leader,
        name,
        role,
        tag,
        aiRole,
        basis,
        note,
      });
    }

    // Special Rules
    const maxTurns = parseIntSafe(rulesMap["最大ターン"], 10);
    const surviveTurns = rulesMap["生存勝利ターン"]
      ? parseIntSafe(rulesMap["生存勝利ターン"], 0)
      : 0;
    const escapeUnitTag = (rulesMap["離脱勝利"] || "").trim();
    const escapeDestName = (rulesMap["離脱先名称"] || "離脱先").trim();
    const escapeBadge = (rulesMap["離脱ラベル"] || "離脱").trim();
    const bridgeName = (rulesMap["橋名称"] || "橋").trim();
    const defeatEnemyLeader = parseBool(rulesMap["敵大将撃破勝利"], false);
    const routVictory = parseBool(rulesMap["敵全滅勝利"], true);
    const defeatPlayerLeaderTag = (rulesMap["自軍大将敗北"] || "").trim();
    const turnLimitOutcome = (rulesMap["制限ターン結果"] || (surviveTurns > 0 ? "victory" : "defeat")).trim();
    const recordUnitTag = (rulesMap["殿記録対象"] || rulesMap["記録対象"] || "").trim();
    const recordLabel = (rulesMap["殿記録ラベル"] || rulesMap["記録ラベル"] || "").trim();
    const recordInitialStatus = (rulesMap["殿初期状態"] || rulesMap["記録初期状態"] || "").trim();

    const openingLogs = (rulesMap["開戦ログ"] || "")
      .split(/\s*\/\s*/)
      .map((s) => s.trim())
      .filter(Boolean);

    const outcomes = {
      escape: parseOutcomeLine(rulesMap["結果・離脱勝利"], {
        cutinSub: title,
        cutinTitle: `${playerArmy}、離脱成功！`,
        title: `${playerArmy} 勝利（離脱達成）`,
        lead: `${escapeDestName}への退路を切り開き、戦場を離脱した。`,
      }),
      survive: parseOutcomeLine(rulesMap["結果・生存勝利"], {
        cutinSub: title,
        cutinTitle: "規定ターンを持ちこたえた！",
        title: `${playerArmy} 勝利（規定ターン防衛）`,
        lead: "最後まで戦線を保ち切り、戦局を支え抜いた。",
      }),
      leaderDefeated: parseOutcomeLine(rulesMap["結果・大将撃破勝利"], {
        cutinSub: title,
        cutinTitle: "敵総大将を撃破！",
        title: `${playerArmy} 勝利（敵大将撃破）`,
        lead: `${enemyArmy}の中核を打ち破り、戦場の主導権を握った。`,
      }),
      rout: parseOutcomeLine(rulesMap["結果・撃退勝利"], {
        cutinSub: title,
        cutinTitle: `${enemyArmy}を撃退！`,
        title: `${playerArmy} 大勝利（敵軍撃退）`,
        lead: `${enemyArmy}の攻勢をことごとく跳ね返し、戦場を制した。`,
      }),
      defeat: parseOutcomeLine(rulesMap["結果・敗北"], {
        cutinSub: title,
        cutinTitle: `無念… ${playerArmy}、敗走`,
        title: `${enemyArmy}の勝利（${playerArmy} 敗北）`,
        lead: `${enemyArmy}に押し切られ、${playerArmy}は戦線を維持できなかった。`,
      }),
      timeout: parseOutcomeLine(rulesMap["結果・時間切れ"], {
        cutinSub: title,
        cutinTitle: "日暮れにより戦線膠着…",
        title: "引き分け（規定ターン終了）",
        lead: "決着がつかぬまま日暮れを迎え、両軍は陣を引いた。",
      }),
    };

    const scenario = {
      slug,
      order,
      year,
      title,
      subtitle,
      date,
      place,
      playerArmy,
      enemyArmy,
      forces,
      bookChapter,
      bookUrl,
      keyart,
      theme,
      victoryText,
      defeatText,
      startMessage,
      overview,
      mapNote,
      unitNote,
      map: {
        width: grid.width,
        height: grid.height,
        tiles,
      },
      legend: legendList,
      units,
      rules: {
        maxTurns,
        surviveTurns,
        escapeUnitTag,
        escapeDestName,
        escapeBadge,
        bridgeName,
        defeatEnemyLeader,
        routVictory,
        defeatPlayerLeaderTag,
        turnLimitOutcome,
        recordUnitTag,
        recordLabel,
        recordInitialStatus,
        openingLogs,
        outcomes,
      },
    };

    validateScenario(scenario);
    return scenario;
  }

  function validateScenario(scenario) {
    if (!scenario.slug) throw new Error("slug が空です");
    if (!scenario.map || scenario.map.width <= 0 || scenario.map.height <= 0) {
      throw new Error(`${scenario.slug}: マップサイズが不正です`);
    }
    if (!Array.isArray(scenario.units) || scenario.units.length === 0) {
      throw new Error(`${scenario.slug}: ユニットが1体も定義されていません`);
    }
    const occupied = new Set();
    let playerCount = 0;
    let enemyCount = 0;
    for (const u of scenario.units) {
      if (u.x < 0 || u.y < 0 || u.x >= scenario.map.width || u.y >= scenario.map.height) {
        throw new Error(`${scenario.slug}: ユニット ${u.name || u.tag} の座標 (${u.x},${u.y}) がマップ外です`);
      }
      const tile = scenario.map.tiles[u.y * scenario.map.width + u.x];
      if (!tile || tile.terrain === "Water") {
        throw new Error(`${scenario.slug}: ユニット ${u.name || u.tag} が進入不可の川 (${u.x},${u.y}) に配置されています`);
      }
      const key = `${u.x},${u.y}`;
      if (occupied.has(key)) {
        throw new Error(`${scenario.slug}: 座標 (${u.x},${u.y}) にユニットが重複配置されています`);
      }
      occupied.add(key);
      if (u.team === "player") playerCount += 1;
      if (u.team === "enemy") enemyCount += 1;
    }
    if (playerCount === 0 || enemyCount === 0) {
      throw new Error(`${scenario.slug}: 自軍(${playerCount})と敵軍(${enemyCount})の両方が必要です`);
    }
    return true;
  }

  function toWasmScenarioObject(scenario) {
    const escapeLabel = scenario.rules.escapeDestName
      ? `${scenario.rules.escapeBadge}マス（${scenario.rules.escapeDestName}）`
      : `${scenario.rules.escapeBadge}マス`;
    return {
      slug: scenario.slug,
      title: scenario.title,
      start_message: scenario.startMessage,
      bridge_label: scenario.rules.bridgeName || "橋",
      escape_label: escapeLabel,
      map: {
        width: scenario.map.width,
        height: scenario.map.height,
        tiles: scenario.map.tiles.map((t) => ({
          x: t.x,
          y: t.y,
          terrain: t.terrain,
          height: t.height,
          cover: Boolean(t.cover),
          water: Boolean(t.water),
          bridge: Boolean(t.bridge),
          escape: Boolean(t.escape),
        })),
      },
      units: scenario.units.map((u) => ({
        id: u.id,
        clan: u.clan,
        job: u.job,
        team: u.team,
        x: u.x,
        y: u.y,
        hp: u.hp,
        atk: u.atk,
        mov: u.mov,
        range: u.range,
        leader: Boolean(u.leader),
        name: u.name,
        role: u.role,
        tag: u.tag,
        basis: u.basis,
        note: u.note,
      })),
    };
  }

  function toWasmScenarioJson(scenario) {
    return JSON.stringify(toWasmScenarioObject(scenario));
  }

  const api = {
    parseScenarioMarkdown,
    validateScenario,
    toWasmScenarioObject,
    toWasmScenarioJson,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (globalScope) {
    globalScope.srpgScenarioParser = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
