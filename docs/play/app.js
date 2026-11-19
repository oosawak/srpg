const srpgRoot = window.srpgMountRoot ?? document;
const srpgHost = typeof ShadowRoot !== "undefined" && srpgRoot instanceof ShadowRoot ? srpgRoot.host : null;
function rootQuery(selector) {
  return srpgRoot.querySelector(selector);
}

const canvas = rootQuery("#mapCanvas");
const ctx = canvas.getContext("2d");

// HUD & Controls
const scenarioBadge = rootQuery("#scenarioBadge");
const turnBadge = rootQuery("#turnBadge");
const phaseBadge = rootQuery("#phaseBadge");
const objectiveBanner = rootQuery("#objectiveBanner");
const playerForceLabel = rootQuery("#playerForceLabel");
const enemyForceLabel = rootQuery("#enemyForceLabel");
const oniwaStatusPill = rootQuery("#oniwaStatusPill");
const muteToggleBtn = rootQuery("#muteToggle");
const helpOpenBtn = rootQuery("#helpOpen");
const titleReturnBtn = rootQuery("#titleReturn");

const toggleViewButton = rootQuery("#toggleView");
const zoomRange = rootQuery("#zoomRange");
const zoomLabel = rootQuery("#zoomLabel");
const endTurnButton = rootQuery("#endTurn");
const resetViewButton = rootQuery("#resetView");
const viewName = rootQuery("#viewName");
const turnNumberEl = rootQuery("#turnNumber");
const phaseNameEl = rootQuery("#phaseName");
const selectedUnitEl = rootQuery("#selectedUnit");
const unitCountEl = rootQuery("#unitCount");
const objectiveDetailEl = rootQuery("#objectiveDetail");
const oniwaSummaryLine = rootQuery("#oniwaSummaryLine");
const battleLogEl = rootQuery("#battleLog");
const logCountEl = rootQuery("#logCount");

const abilityList = rootQuery("#abilityList");
const abilityCardOverlay = rootQuery("#abilityCardOverlay");
const unitInfo = rootQuery("#unitInfo");
const enemyUnitInfo = rootQuery("#enemyUnitInfo");
const enemyUnitCardOverlay = rootQuery("#enemyUnitCardOverlay");
const enemyUnitActions = rootQuery("#enemyUnitActions");
const enemyUnitPanelClose = rootQuery("#enemyUnitPanelClose");
const unitActions = rootQuery("#unitActions");
const unitCardOverlay = rootQuery("#playerUnitCardOverlay") ?? rootQuery(".unitCardOverlay");
const attackFxOverlay = rootQuery("#attackFxOverlay");
const unitPanelClose = rootQuery("#unitPanelClose");
const bootStatus = rootQuery("#bootStatus");
const inputProbe = rootQuery("#inputProbe");

// Phase Banner
const phaseBanner = rootQuery("#phaseBanner");
const phaseBannerSub = rootQuery("#phaseBannerSub");
const phaseBannerTitle = rootQuery("#phaseBannerTitle");

// Start Screen
const startOverlay = rootQuery("#startOverlay");
const startHitotoribashiBtn = rootQuery("#startHitotoribashi");
const startDemoBtn = rootQuery("#startDemo");
const startMuteCheck = rootQuery("#startMuteCheck");
const startVolumeRange = rootQuery("#startVolumeRange");
const startVolumeLabel = rootQuery("#startVolumeLabel");

// Result Screen
const resultOverlay = rootQuery("#resultOverlay");
const resultCutin = rootQuery("#resultCutin");
const resultCutinSub = rootQuery("#resultCutinSub");
const resultCutinTitle = rootQuery("#resultCutinTitle");
const resultCutinSkip = rootQuery("#resultCutinSkip");
const resultCard = rootQuery("#resultCard");
const resultEyebrow = rootQuery("#resultEyebrow");
const resultTitle = rootQuery("#resultTitle");
const resultLead = rootQuery("#resultLead");
const resTurns = rootQuery("#resTurns");
const resOniwa = rootQuery("#resOniwa");
const resPlayerAlive = rootQuery("#resPlayerAlive");
const resEnemyAlive = rootQuery("#resEnemyAlive");
const resRoster = rootQuery("#resRoster");
const resultRetryBtn = rootQuery("#resultRetry");
const resultToTitleBtn = rootQuery("#resultToTitle");

// Help Modal
const helpOverlay = rootQuery("#helpOverlay");
const helpCloseBtn = rootQuery("#helpClose");
const helpCloseFooterBtn = rootQuery("#helpCloseBtn");
const helpMuteCheck = rootQuery("#helpMuteCheck");
const helpVolumeRange = rootQuery("#helpVolumeRange");
const helpVolumeLabel = rootQuery("#helpVolumeLabel");

const statusLine = document.createElement("p");
statusLine.className = "statusLine";
const panelEl = rootQuery(".panel");
if (panelEl) panelEl.appendChild(statusLine);
if (bootStatus) bootStatus.textContent = "boot: app.js loaded";

const TILE_SIZE = 72;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.05;
const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_PX = 10;
const ZOOM_STORAGE_KEY = "srpg.play.zoom";
const SURVIVAL_TURNS = 6;
const MAX_LOG_ENTRIES = 40;
const MAX_FLOATING_TEXTS = 24;
const MAX_PARTICLES = 48;

const COLORS = {
  player: "#2563eb",
  playerLight: "#60a5fa",
  playerDark: "#1e3a8a",
  enemy: "#dc2626",
  enemyLight: "#f87171",
  enemyDark: "#7f1d1d",
  gold: "#f4c661",
};

function eventInsideSrpg(event) {
  if (srpgRoot === document) return true;
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  return path.includes(canvas) || (srpgHost ? path.includes(srpgHost) : false);
}

const bridge = {
  useWasm: false,
  instance: null,
};

const frame = {
  unitHitboxes: [],
};

const gestureState = {
  active: false,
  pointerId: null,
  pointerType: null,
  timerId: 0,
  startPoint: null,
  startTime: 0,
  current: null,
  longPressFired: false,
};

const uiState = {
  scenario: "hitotoribashi",
  started: false,
  zoom: loadSavedZoom(),
  userAdjustedZoom: false,
  unitPanelHidden: false,
  enemyPanelHidden: true,
  attackFx: null,
  phaseBannerTimer: 0,
  resultCutinTimer: 0,
  lastEnemyClickId: null,
  lastEnemyClickAt: 0,
};

const battleTracker = {
  resolved: false,
  outcome: null, // { victory: bool, reason: string, title: string, cutin: string, lead: string }
  oniwaDefendedTurns: 1,
  oniwaFallenTurn: null,
  oniwaEngagements: 0,
  lastProcessedEventSeq: -1,
  lastTurnLogged: 0,
  logs: [],
};

// Visual playback & FX state (60fps, capped counts)
const visualFx = {
  rafId: 0,
  floatingTexts: [],
  particles: [],
  dyingUnits: [],
  lunges: new Map(), // unitId -> { dx, dy, startAt, duration }
  hitFlashes: new Map(), // unitId -> { until }
};

const playback = {
  active: false,
  mode: null, // "player" | "enemy"
  steps: [],
  index: 0,
  stepStartedAt: 0,
  stepDuration: 150,
  visualUnits: null, // Map<id, unitCopy>
  targetSnapshot: null,
  onComplete: null,
};

const state = createScenarioState("hitotoribashi");
let startupError = null;
const DEBUG = false;
let attackFxTimerId = 0;

function soundPlay(name, ...args) {
  if (window.srpgSound && typeof window.srpgSound.play === "function") {
    window.srpgSound.play(name, ...args);
  }
}

function debugLog(...args) {
  if (DEBUG) console.log("[SRPG]", ...args);
}

function jobLabel(job) {
  switch (job) {
    case "Ashigaru": return "足軽";
    case "Yari": return "槍";
    case "Yumi": return "弓";
    case "Teppo": return "鉄砲";
    case "Ninja": return "忍者";
    case "Strategist": return "軍師";
    default: return String(job || "部隊");
  }
}

function unitDisplayName(unit) {
  if (!unit) return "部隊";
  return unit.name && unit.name.length > 0 ? unit.name : jobLabel(unit.job);
}

function basisLabel(basis) {
  switch (basis) {
    case "fact": return "史実";
    case "legend": return "伝承";
    case "fiction": return "創作";
    default: return "";
  }
}

function basisBadgeHtml(basis) {
  const label = basisLabel(basis);
  if (!label) return "";
  return `<span class="basisBadge basis-${basis}" title="種別の目安：${label}">${label}</span>`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// =========================================================
// Scenario Data & Local Fallback State
// =========================================================
function makeUnit(
  id, clan, job, x, y, team, mov, range, hp, atk,
  leader = false, name = "", role = "", tag = "", basis = "", note = ""
) {
  return {
    id,
    clan,
    job,
    x,
    y,
    color: team === "enemy" ? COLORS.enemy : COLORS.player,
    team,
    mov,
    range,
    hp,
    maxHp: hp,
    atk,
    moved: false,
    acted: false,
    leader,
    name,
    role,
    tag,
    basis,
    note,
  };
}

function buildDemoMap() {
  const width = 8;
  const height = 8;
  const tiles = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let tile;
      if (x === 3 && y <= 5) {
        tile = { terrain: "Road", height: 0, cover: false, water: false };
      } else if (y >= 5) {
        tile = { terrain: "RiceField", height: 0, cover: false, water: true };
      } else if (x >= 5) {
        tile = { terrain: "Terrace", height: x - 4 + Math.floor(y / 2), cover: x === 6, water: false };
      } else if (x === 1 && y === 1) {
        tile = { terrain: "Castle", height: 3, cover: true, water: false };
      } else if (x <= 2 && y <= 2) {
        tile = { terrain: "Town", height: y === 2 ? 1 : 0, cover: x % 2 === 0 && y % 2 === 0, water: false };
      } else {
        tile = { terrain: "Plain", height: 0, cover: (x + y) % 3 === 0, water: false };
      }
      tiles.push({ x, y, ...tile, bridge: false, escape: false });
    }
  }
  return { width, height, tiles };
}

function buildHitotoribashiMap() {
  const width = 10;
  const height = 10;
  const riverSet = new Set([
    "8,4", "9,4", "0,5", "1,5", "2,5", "3,5", "5,5", "6,5", "7,5", "8,5", "0,6",
  ]);
  const bridgeSet = new Set(["4,5", "4,6"]);
  const escapeSet = new Set(["3,0", "4,0", "5,0"]);
  const roadHighSet = new Set(["3,0", "4,0", "2,1", "3,1"]);
  const roadLowSet = new Set(["2,2", "2,3", "3,3", "3,4", "4,4", "4,7", "4,8", "4,9"]);
  const townSet = new Set(["5,1", "6,1"]);
  const terraceHighSet = new Set([
    "0,0", "1,0", "2,0", "7,0", "8,0", "0,1", "1,1", "4,1", "7,1", "8,1", "9,1",
    "3,2", "4,2", "9,2", "8,7", "9,7", "8,8", "9,8", "7,9", "8,9", "9,9",
  ]);
  const terraceLowSet = new Set(["0,2", "1,2", "5,2", "8,2", "5,3"]);
  const riceSet = new Set([
    "6,2", "7,2", "0,3", "1,3", "6,3", "7,3", "8,3", "0,4", "1,4", "6,4", "7,4",
    "1,6", "2,6", "8,6", "9,6", "0,7", "1,7", "0,8", "1,8", "2,8",
  ]);

  const tiles = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const k = `${x},${y}`;
      let tile;
      if (riverSet.has(k)) {
        tile = { terrain: "Water", height: 0, cover: false, water: true };
      } else if (bridgeSet.has(k)) {
        tile = { terrain: "Road", height: 1, cover: false, water: false };
      } else if (k === "5,0" || k === "6,0") {
        tile = { terrain: "Castle", height: 3, cover: true, water: false };
      } else if (k === "9,0") {
        tile = { terrain: "Mountain", height: 3, cover: true, water: false };
      } else if (roadHighSet.has(k)) {
        tile = { terrain: "Road", height: 2, cover: false, water: false };
      } else if (roadLowSet.has(k)) {
        tile = { terrain: "Road", height: 1, cover: false, water: false };
      } else if (townSet.has(k)) {
        tile = { terrain: "Town", height: 2, cover: true, water: false };
      } else if (terraceHighSet.has(k)) {
        tile = { terrain: "Terrace", height: 2, cover: k === "7,0" || k === "9,1", water: false };
      } else if (terraceLowSet.has(k)) {
        tile = { terrain: "Terrace", height: 1, cover: x === 5, water: false };
      } else if (riceSet.has(k)) {
        tile = { terrain: "RiceField", height: 1, cover: false, water: true };
      } else {
        tile = { terrain: "Plain", height: 1, cover: k === "6,7", water: false };
      }
      tiles.push({
        x,
        y,
        ...tile,
        bridge: bridgeSet.has(k),
        escape: escapeSet.has(k),
      });
    }
  }
  return { width, height, tiles };
}

function createScenarioState(scenario = "hitotoribashi") {
  if (scenario === "demo") {
    return {
      scenario: "demo",
      viewMode: "isometric",
      turnNumber: 1,
      phase: "player",
      selectedUnitId: 1,
      selectedTile: { x: 2, y: 2 },
      interactionMode: null,
      moveOrigin: null,
      message: "自軍の行動です",
      map: buildDemoMap(),
      units: [
        makeUnit(1, 1, "Ashigaru", 2, 2, "player", 4, 1, 100, 14, true),
        makeUnit(2, 1, "Yumi", 1, 5, "player", 4, 3, 80, 12),
        makeUnit(3, 2, "Teppo", 6, 2, "enemy", 3, 2, 90, 13, true),
        makeUnit(4, 2, "Ninja", 6, 5, "enemy", 4, 1, 70, 11),
      ],
      turnEvents: [],
      eventSeq: 0,
    };
  }

  return {
    scenario: "hitotoribashi",
    viewMode: "isometric",
    turnNumber: 1,
    phase: "player",
    selectedUnitId: 1,
    selectedTile: { x: 4, y: 4 },
    interactionMode: null,
    moveOrigin: null,
    message: "天正13年・人取橋の合戦。政宗を北端の小浜方面へ逃がせ。",
    map: buildHitotoribashiMap(),
    units: [
      makeUnit(1, 1, "Strategist", 4, 4, "player", 2, 1, 90, 13, true, "伊達政宗", "伊達本隊・大将", "masamune", "fact", "19歳。父・輝宗の横死直後。矢弾が迫る中、北端（小浜方面）の離脱路を目指す。"),
      makeUnit(2, 1, "Yari", 4, 6, "player", 3, 1, 135, 17, false, "鬼庭良直", "殿（しんがり）・左月斎", "oniwa", "legend", "73歳。政宗より金色の采配を預かり、黄の綿帽子を被って殿を務め討死したと伝わる。"),
      makeUnit(3, 1, "Ashigaru", 3, 4, "player", 4, 1, 115, 16, false, "伊達成実", "成実隊（退却援護）", "shigezane", "fact", "数え18歳。大森城主。崩れる陣の中で踏みとどまり、政宗離脱の時を稼いだ。"),
      makeUnit(4, 1, "Yumi", 5, 3, "player", 3, 3, 75, 13, false, "伊達弓隊", "北岸援護（模式配置）", "date_yumi", "fiction", "北岸の段々畑から橋の攻防を援護する弓隊。部隊編成と配置はゲーム用の模式図。"),
      makeUnit(5, 2, "Strategist", 4, 9, "enemy", 3, 1, 120, 16, true, "佐竹義重", "南奥州連合・総大将", "satake", "fact", "常陸の大名。南奥州諸侯連合を率い、約3万（伝承値）の軍勢で伊達軍に迫る。"),
      makeUnit(6, 2, "Yari", 3, 7, "enemy", 3, 1, 100, 15, false, "蘆名隊", "会津・蘆名勢", "ashina", "fact", "会津の名族・蘆名氏の主力勢。南岸から人取橋の突破を狙う。"),
      makeUnit(7, 2, "Yumi", 6, 7, "enemy", 3, 3, 80, 13, false, "岩城隊", "浜通り・岩城勢", "iwaki", "fact", "岩城氏の弓隊。川越しに橋上の殿と伊達本隊へ矢を浴びせる。"),
      makeUnit(8, 2, "Yari", 4, 7, "enemy", 3, 1, 90, 14, false, "連合先鋒・槍組", "連合先鋒（模式配置）", "coalition_yari", "fiction", "人取橋の南詰めへ押し寄せる連合軍先鋒。部隊構成と配置はゲーム用の模式図。"),
      makeUnit(9, 2, "Teppo", 5, 7, "enemy", 3, 2, 75, 15, false, "連合先鋒・鉄砲組", "連合鉄砲隊（模式配置）", "coalition_teppo", "fiction", "橋上の殿へ銃撃を加える連合軍鉄砲組。部隊構成と配置はゲーム用の模式図。"),
      makeUnit(10, 2, "Ashigaru", 5, 8, "enemy", 4, 1, 85, 13, false, "連合第二陣", "連合追撃勢（模式配置）", "coalition_ashigaru", "fiction", "橋の突破後に政宗を追撃する第二陣。部隊構成と配置はゲーム用の模式図。"),
    ],
    turnEvents: [],
    eventSeq: 0,
  };
}

// =========================================================
// Battle Log & Tracker (Pillar 1 & Pillar 5)
// =========================================================
function addBattleLog(text, kind = "system", turnOverride = null) {
  const current = getCurrentState();
  const turn = turnOverride ?? current.turnNumber ?? 1;
  battleTracker.logs.unshift({ text, kind, turn });
  if (battleTracker.logs.length > MAX_LOG_ENTRIES) {
    battleTracker.logs.length = MAX_LOG_ENTRIES;
  }
  renderBattleLog();
}

function renderBattleLog() {
  if (!battleLogEl) return;
  battleLogEl.innerHTML = "";
  for (const entry of battleTracker.logs) {
    const li = document.createElement("li");
    li.className = `log-${entry.kind}`;
    li.innerHTML = `<span class="logTurnTag">T${entry.turn}</span>${escapeHtml(entry.text)}`;
    battleLogEl.appendChild(li);
  }
  if (logCountEl) {
    logCountEl.textContent = `${battleTracker.logs.length}件`;
  }
}

function resetBattleTracker(scenario) {
  battleTracker.resolved = false;
  battleTracker.outcome = null;
  battleTracker.oniwaDefendedTurns = scenario === "hitotoribashi" ? 1 : 0;
  battleTracker.oniwaFallenTurn = null;
  battleTracker.oniwaEngagements = 0;
  battleTracker.lastProcessedEventSeq = -1;
  battleTracker.lastTurnLogged = 1;
  battleTracker.logs = [];
  hideResultOverlay();

  if (scenario === "hitotoribashi") {
    addBattleLog("天正13年11月17日、人取橋の合戦が開戦。", "highlight", 1);
    addBattleLog("鬼庭良直（73歳）、人取橋の南詰めにて殿を務める。", "highlight", 1);
    addBattleLog("目標：伊達政宗を北端の離脱マスへ逃がすか、6ターン終了まで生存せよ。", "system", 1);
  } else {
    addBattleLog("従来デモ配置で戦闘を開始しました。", "system", 1);
  }
}

function showPhaseBanner(title, subtitle = "", isEnemy = false, duration = 1150) {
  if (!phaseBanner) return;
  if (uiState.phaseBannerTimer) {
    window.clearTimeout(uiState.phaseBannerTimer);
    uiState.phaseBannerTimer = 0;
  }
  phaseBanner.classList.toggle("phase-enemy", isEnemy);
  if (phaseBannerSub) phaseBannerSub.textContent = subtitle;
  if (phaseBannerTitle) phaseBannerTitle.textContent = title;
  phaseBanner.hidden = false;
  uiState.phaseBannerTimer = window.setTimeout(() => {
    phaseBanner.hidden = true;
    uiState.phaseBannerTimer = 0;
  }, duration);
}

// =========================================================
// Victory / Defeat Evaluation (Pillar 1 — JS side from render JSON)
// =========================================================
function evaluateScenarioOutcome(current) {
  if (battleTracker.resolved || !uiState.started) return null;

  const playersAlive = currentPlayerUnits(current.units);
  const enemiesAlive = currentEnemyUnits(current.units);

  if (current.scenario === "hitotoribashi") {
    const masamune = current.units.find((u) => u.tag === "masamune");
    const oniwa = current.units.find((u) => u.tag === "oniwa");

    // Track Oniwa rear-guard turns
    if (oniwa) {
      if (oniwa.hp > 0) {
        battleTracker.oniwaDefendedTurns = Math.max(
          battleTracker.oniwaDefendedTurns,
          Math.min(current.turnNumber, SURVIVAL_TURNS)
        );
      } else if (battleTracker.oniwaFallenTurn == null) {
        battleTracker.oniwaFallenTurn = current.turnNumber;
        battleTracker.oniwaDefendedTurns = Math.max(battleTracker.oniwaDefendedTurns, current.turnNumber);
      }
    }

    // Defeat: Masamune fallen or all player units lost
    if (!masamune || masamune.hp <= 0 || playersAlive.length === 0) {
      return {
        victory: false,
        reason: "masamune_fallen",
        cutinSub: "天正13年・人取橋",
        cutinTitle: "無念… 伊達政宗、討ち死に",
        title: "連合軍の勝利（伊達軍 敗北）",
        lead: "南奥州連合の大軍に押し切られ、若き当主・伊達政宗は人取橋のほとりに倒れた。伊達家の命運はここで潰えた。",
      };
    }

    // Victory 1: Masamune reached North Escape tile
    const mTile = tileAt(current.map, masamune.x, masamune.y);
    if (mTile && mTile.escape) {
      return {
        victory: true,
        reason: "escape",
        cutinSub: "天正13年・小浜方面へ",
        cutinTitle: "伊達政宗、離脱成功！",
        title: "伊達軍 撤退成功（離脱達成）",
        lead: "鬼庭良直と伊達成実が時間を稼ぐ中、政宗は北の退路を切り開き小浜方面へ生還した。伊達家は存亡の淵で踏みとどまった。",
      };
    }

    // Victory 2: Survived required turns (6 turns completed -> turn 7 reached)
    if (current.turnNumber > SURVIVAL_TURNS) {
      return {
        victory: true,
        reason: "survive",
        cutinSub: "天正13年・日暮れ",
        cutinTitle: "六刻を持ちこたえ、撤退成功！",
        title: "伊達軍 撤退成功（規定ターン生存）",
        lead: "夕闇が迫る人取橋で伊達軍は最後まで崩れなかった。佐竹勢も深追いを控え、政宗は軍を残して退くことに成功した。",
      };
    }

    // Victory 3: All coalition forces routed
    if (enemiesAlive.length === 0 || current.phase === "victory") {
      return {
        victory: true,
        reason: "rout",
        cutinSub: "天正13年・人取橋",
        cutinTitle: "南奥州連合軍を撃退！",
        title: "伊達軍 大勝利（連合軍撃退）",
        lead: "寡兵をもって人取橋の要衝を守り切り、迫り来る南奥州連合の攻勢をことごとく跳ね返した。",
      };
    }

    return null;
  }

  // Demo mode victory/defeat
  if (enemiesAlive.length === 0 || current.phase === "victory") {
    return {
      victory: true,
      reason: "demo_victory",
      cutinSub: "従来デモ配置",
      cutinTitle: "自軍 勝利！",
      title: "勝利（デモ戦終了）",
      lead: "敵部隊をすべて撃破しました。",
    };
  }
  if (playersAlive.length === 0 || current.phase === "defeat" || current.phase === "gameover") {
    return {
      victory: false,
      reason: "demo_defeat",
      cutinSub: "従来デモ配置",
      cutinTitle: "自軍 敗北…",
      title: "敗北（デモ戦終了）",
      lead: "自軍部隊が全滅しました。",
    };
  }
  return null;
}

function triggerResolution(outcome, current) {
  if (battleTracker.resolved) return;
  battleTracker.resolved = true;
  battleTracker.outcome = outcome;

  addBattleLog(
    outcome.victory ? `【決着】${outcome.title}` : `【決着】${outcome.title}`,
    "highlight",
    Math.min(current.turnNumber, SURVIVAL_TURNS)
  );
  soundPlay(outcome.victory ? "victory" : "defeatEnd");

  if (!resultOverlay) return;
  resultOverlay.hidden = false;

  // Populate summary card
  const elapsedTurns =
    current.scenario === "hitotoribashi" && outcome.reason === "survive"
      ? SURVIVAL_TURNS
      : current.turnNumber;
  const players = current.units.filter((u) => u.team === "player");
  const enemies = current.units.filter((u) => u.team === "enemy");
  const playerAliveCount = players.filter((u) => u.hp > 0).length;
  const enemyAliveCount = enemies.filter((u) => u.hp > 0).length;

  if (resultEyebrow) {
    resultEyebrow.textContent = current.scenario === "hitotoribashi" ? "人取橋の合戦 — 結果" : "デモ戦 — 結果";
  }
  if (resultTitle) resultTitle.textContent = outcome.title;
  if (resultLead) resultLead.textContent = outcome.lead;
  if (resTurns) resTurns.textContent = `${elapsedTurns} ターン`;

  if (resOniwa) {
    if (current.scenario === "hitotoribashi") {
      const oniwa = current.units.find((u) => u.tag === "oniwa");
      const statusTxt = oniwa && oniwa.hp > 0 ? "生還" : `T${battleTracker.oniwaFallenTurn ?? elapsedTurns} 討死`;
      resOniwa.textContent = `${battleTracker.oniwaDefendedTurns} ターン防衛（${statusTxt}）`;
    } else {
      resOniwa.textContent = "—（デモ配置）";
    }
  }
  if (resPlayerAlive) resPlayerAlive.textContent = `${playerAliveCount} / ${players.length} 部隊`;
  if (resEnemyAlive) resEnemyAlive.textContent = `${enemyAliveCount} / ${enemies.length} 部隊`;

  if (resRoster) {
    const renderList = (list) =>
      list
        .map((u) => {
          const deadClass = u.hp <= 0 ? ' class="dead"' : "";
          const stateText = u.hp > 0 ? `残HP ${u.hp}/${u.maxHp}` : "討死・壊滅";
          return `<li${deadClass}>${escapeHtml(unitDisplayName(u))} ${basisBadgeHtml(u.basis)} — ${stateText}</li>`;
        })
        .join("");

    resRoster.innerHTML = `
      <div class="resRosterCol">
        <h3>${current.scenario === "hitotoribashi" ? "伊達軍" : "自軍"}</h3>
        <ul>${renderList(players)}</ul>
      </div>
      <div class="resRosterCol">
        <h3>${current.scenario === "hitotoribashi" ? "南奥州連合軍" : "敵軍"}</h3>
        <ul>${renderList(enemies)}</ul>
      </div>
    `;
  }

  // Show short skippable cut-in first, then summary card
  if (resultCutin && resultCard) {
    resultCutin.classList.toggle("defeat", !outcome.victory);
    if (resultCutinSub) resultCutinSub.textContent = outcome.cutinSub;
    if (resultCutinTitle) resultCutinTitle.textContent = outcome.cutinTitle;
    resultCutin.hidden = false;
    resultCard.hidden = true;

    if (uiState.resultCutinTimer) window.clearTimeout(uiState.resultCutinTimer);
    uiState.resultCutinTimer = window.setTimeout(showResultSummaryCard, 1900);
  } else if (resultCard) {
    resultCard.hidden = false;
  }
}

function showResultSummaryCard() {
  if (uiState.resultCutinTimer) {
    window.clearTimeout(uiState.resultCutinTimer);
    uiState.resultCutinTimer = 0;
  }
  if (resultCutin) resultCutin.hidden = true;
  if (resultCard) resultCard.hidden = false;
}

function hideResultOverlay() {
  if (uiState.resultCutinTimer) {
    window.clearTimeout(uiState.resultCutinTimer);
    uiState.resultCutinTimer = 0;
  }
  if (resultOverlay) resultOverlay.hidden = true;
  if (resultCutin) resultCutin.hidden = true;
  if (resultCard) resultCard.hidden = true;
}

// =========================================================
// Visual Effects & Step-by-step Playback (Pillars 2 & 3)
// =========================================================
function spawnFloatingText(screenX, screenY, text, color = "#ffffff", scale = 1) {
  if (visualFx.floatingTexts.length >= MAX_FLOATING_TEXTS) {
    visualFx.floatingTexts.shift();
  }
  visualFx.floatingTexts.push({
    x: screenX,
    y: screenY,
    text,
    color,
    scale,
    startedAt: performance.now(),
    duration: 920,
  });
}

function spawnParticles(screenX, screenY, color, count = 8) {
  for (let i = 0; i < count; i += 1) {
    if (visualFx.particles.length >= MAX_PARTICLES) {
      visualFx.particles.shift();
    }
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const speed = 1.2 + Math.random() * 2.6;
    visualFx.particles.push({
      x: screenX,
      y: screenY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.1,
      size: 2.2 + Math.random() * 2.5,
      color,
      startedAt: performance.now(),
      duration: 380 + Math.random() * 240,
    });
  }
}

function triggerUnitLunge(attacker, target, current) {
  if (!attacker || !target) return;
  const fromTile = tileAt(current.map, attacker.x, attacker.y);
  const toTile = tileAt(current.map, target.x, target.y);
  if (!fromTile || !toTile) return;
  const fromP = tileToScreen(fromTile, current);
  const toP = tileToScreen(toTile, current);
  const dx = toP.x - fromP.x;
  const dy = toP.y - fromP.y;
  const dist = Math.hypot(dx, dy) || 1;
  const push = Math.min(20, dist * 0.35);
  visualFx.lunges.set(attacker.id, {
    dx: (dx / dist) * push,
    dy: (dy / dist) * push,
    startedAt: performance.now(),
    duration: 240,
  });
}

function triggerHitFlash(unitId) {
  visualFx.hitFlashes.set(unitId, performance.now() + 260);
}

function spawnDyingUnit(unit, current) {
  const tile = tileAt(current.map, unit.x, unit.y);
  if (!tile) return;
  const pos = tileToScreen(tile, current);
  visualFx.dyingUnits.push({
    unit: { ...unit },
    pos,
    startedAt: performance.now(),
    duration: 520,
  });
}

function logCombatEvent(ev, unitsList, turn) {
  const findUnit = (id) => unitsList.find((u) => u.id === id);
  if (ev.type === "attack") {
    const attacker = findUnit(ev.attacker_id);
    const target = findUnit(ev.target_id);
    if (!attacker || !target) return;
    const aName = unitDisplayName(attacker);
    const tName = unitDisplayName(target);

    if (attacker.tag === "oniwa" || target.tag === "oniwa") {
      battleTracker.oniwaEngagements += 1;
    }

    if (ev.killed) {
      if (target.tag === "oniwa") {
        battleTracker.oniwaFallenTurn = turn;
        battleTracker.oniwaDefendedTurns = Math.max(battleTracker.oniwaDefendedTurns, turn);
        addBattleLog(`鬼庭良直、人取橋にて壮絶な討ち死に！（${aName}の攻撃で ${ev.damage} ダメージ）`, "highlight", turn);
      } else if (target.tag === "masamune") {
        addBattleLog(`伊達政宗が ${aName} に討たれた！（${ev.damage} ダメージ）`, "highlight", turn);
      } else if (target.team === "enemy") {
        addBattleLog(`${aName} が ${tName} を撃破！（${ev.damage} ダメージ）`, "highlight", turn);
      } else {
        addBattleLog(`${aName} の攻撃で ${tName} が壊滅！（${ev.damage} ダメージ）`, "damage", turn);
      }
      return;
    }

    if (target.tag === "masamune") {
      const crisis = ev.target_hp <= target.maxHp * 0.55 ? "【政宗危機】" : "【本隊被弾】";
      addBattleLog(`${crisis}${aName} が 伊達政宗 に ${ev.damage} ダメージ（残HP ${ev.target_hp}）`, "highlight", turn);
    } else if (target.tag === "oniwa" || attacker.tag === "oniwa") {
      const prefix = target.tag === "oniwa" ? "【殿・奮戦】" : "【殿・反撃】";
      addBattleLog(`${prefix}${aName} → ${tName} に ${ev.damage} ダメージ`, "highlight", turn);
    } else if (attacker.team === "player") {
      addBattleLog(`${aName} が ${tName} に ${ev.damage} ダメージ（命中）`, "attack", turn);
    } else {
      addBattleLog(`${aName} の攻撃！ ${tName} に ${ev.damage} ダメージ`, "damage", turn);
    }
  } else if (ev.type === "ability") {
    const actor = findUnit(ev.unit_id);
    const aName = unitDisplayName(actor);
    if (ev.healed > 0) {
      addBattleLog(`${aName} の「${ev.name}」！ 周囲の味方を合計 ${ev.healed} 回復`, "ability", turn);
    } else {
      addBattleLog(`${aName} が「${ev.name}」を発動！`, "ability", turn);
    }
  }
}

function startEventPlayback(beforeState, afterState, events, mode = "enemy", onComplete = null) {
  finishPlaybackImmediately(false);

  const playable = (events ?? []).filter((ev) => ev.type === "move" || ev.type === "attack" || ev.type === "ability");
  if (playable.length === 0) {
    if (typeof onComplete === "function") onComplete();
    return false;
  }

  playback.active = true;
  playback.mode = mode;
  playback.steps = playable;
  playback.index = 0;
  playback.stepStartedAt = performance.now();
  playback.visualUnits = new Map(beforeState.units.map((u) => [u.id, { ...u }]));
  playback.targetSnapshot = afterState;
  playback.onComplete = onComplete;

  beginCurrentPlaybackStep();
  return true;
}

function beginCurrentPlaybackStep() {
  if (!playback.active || playback.index >= playback.steps.length) {
    finishPlaybackImmediately(true);
    return;
  }
  const ev = playback.steps[playback.index];
  const refState = playback.targetSnapshot ?? getCurrentState();
  const unitsList = [...playback.visualUnits.values()];
  playback.stepStartedAt = performance.now();

  if (ev.type === "move") {
    playback.stepDuration = playback.mode === "enemy" ? 135 : 170;
    soundPlay("move");
  } else if (ev.type === "attack") {
    playback.stepDuration = 320;
    const attacker = playback.visualUnits.get(ev.attacker_id);
    const target = playback.visualUnits.get(ev.target_id);
    if (attacker && target) {
      triggerUnitLunge(attacker, target, refState);
      soundPlay("attack", attacker.job);
      triggerHitFlash(target.id);
      const tTile = tileAt(refState.map, target.x, target.y);
      if (tTile) {
        const pos = tileToScreen(tTile, refState);
        const cx = pos.x + pos.size * 0.5;
        const cy = pos.y + (refState.viewMode === "topdown" ? pos.size * 0.3 : pos.size * 0.12);
        spawnFloatingText(cx, cy - 10, `-${ev.damage}`, target.team === "player" ? "#fca5a5" : "#fef08a", 1.15);
        spawnFloatingText(cx + 18, cy - 26, ev.killed ? "撃破！" : "命中", ev.killed ? "#fbbf24" : "#e2e8f0", 0.82);
        spawnParticles(cx, cy + 4, target.team === "player" ? "#f87171" : "#facc15", ev.killed ? 14 : 8);
      }
      target.hp = Math.max(0, ev.target_hp ?? target.hp - ev.damage);
      if (ev.killed) {
        soundPlay("defeat");
        spawnDyingUnit(target, refState);
      } else {
        soundPlay("hit");
      }
      const turnForLog =
        playback.mode === "enemy"
          ? Math.max(1, (refState.turnNumber ?? 1) - (refState.phase === "player" ? 1 : 0))
          : refState.turnNumber;
      logCombatEvent(ev, unitsList, turnForLog);
    }
  } else if (ev.type === "ability") {
    playback.stepDuration = 280;
    const actor = playback.visualUnits.get(ev.unit_id);
    if (actor) {
      const aTile = tileAt(refState.map, actor.x, actor.y);
      if (aTile) {
        const pos = tileToScreen(aTile, refState);
        const cx = pos.x + pos.size * 0.5;
        const cy = pos.y;
        const label = ev.healed > 0 ? `+${ev.healed} 回復` : ev.name;
        spawnFloatingText(cx, cy - 14, label, "#7dd3fc", 1.05);
        spawnParticles(cx, cy, "#38bdf8", 10);
      }
      if (ev.healed > 0) {
        soundPlay("heal");
        // Sync healed HP from targetSnapshot
        for (const u of refState.units) {
          const vu = playback.visualUnits.get(u.id);
          if (vu && vu.team === "player") vu.hp = u.hp;
        }
      } else {
        soundPlay("select");
      }
      logCombatEvent(ev, unitsList, refState.turnNumber);
    }
  }
}

function advancePlayback(now) {
  if (!playback.active) return;
  const elapsed = now - playback.stepStartedAt;
  if (elapsed < playback.stepDuration) return;

  const ev = playback.steps[playback.index];
  if (ev && ev.type === "move") {
    const vu = playback.visualUnits.get(ev.unit_id);
    if (vu) {
      vu.x = ev.to_x;
      vu.y = ev.to_y;
    }
  }

  playback.index += 1;
  if (playback.index >= playback.steps.length) {
    finishPlaybackImmediately(true);
  } else {
    beginCurrentPlaybackStep();
  }
}

function finishPlaybackImmediately(runCallback = true) {
  if (!playback.active) return;
  // Apply any remaining unlogged combat events so log and Oniwa stats stay accurate
  const refState = playback.targetSnapshot ?? getCurrentState();
  const unitsList = playback.visualUnits ? [...playback.visualUnits.values()] : refState.units;
  for (let i = playback.index + 1; i < playback.steps.length; i += 1) {
    const ev = playback.steps[i];
    if (ev.type === "attack" || ev.type === "ability") {
      const turnForLog =
        playback.mode === "enemy"
          ? Math.max(1, (refState.turnNumber ?? 1) - (refState.phase === "player" ? 1 : 0))
          : refState.turnNumber;
      logCombatEvent(ev, unitsList, turnForLog);
    }
  }

  const cb = playback.onComplete;
  playback.active = false;
  playback.mode = null;
  playback.steps = [];
  playback.index = 0;
  playback.visualUnits = null;
  playback.targetSnapshot = null;
  playback.onComplete = null;

  if (runCallback && typeof cb === "function") {
    cb();
  }
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// =========================================================
// Zoom & Coordinate Helpers (Pillar 6 responsive fit)
// =========================================================
function terrainColor(tile) {
  if (tile.bridge) return "#b07b47";
  switch (tile.terrain) {
    case "Water": return "#236eb8";
    case "Castle": return "#8893a2";
    case "Town": return "#8c6148";
    case "RiceField": return "#5b9a68";
    case "Terrace": return "#8a7e4a";
    case "Road": return "#c2ab79";
    case "Mountain": return "#596a54";
    default: return "#466c44";
  }
}

function terrainCost(tile) {
  let base;
  switch (tile.terrain) {
    case "Plain":
    case "Road":
      base = 1;
      break;
    case "Town":
    case "Castle":
    case "Terrace":
      base = 2;
      break;
    case "RiceField":
      base = 3;
      break;
    case "Mountain":
      base = 4;
      break;
    case "Water":
      base = 99;
      break;
    default:
      base = 1;
  }
  return tile.water ? base + 1 : base;
}

function renderHeight(tile) {
  return Math.max(0, tile.height);
}

function isoLiftPx(tile, zoom) {
  return (10 + renderHeight(tile) * 9) * zoom;
}

function terrainLabel(tile) {
  if (!tile) return "不明";
  if (tile.bridge) return "人取橋";
  switch (tile.terrain) {
    case "Water": return "川";
    case "Castle": return "城";
    case "Town": return "城下町";
    case "RiceField": return "田んぼ";
    case "Terrace": return "段々畑";
    case "Road": return "街道";
    case "Mountain": return "山";
    default: return "平地";
  }
}

function tileSummary(tile) {
  if (!tile) return "タイル情報なし";
  if (tile.bridge) return "人取橋 / 移動コスト 1 / 渡河可能";
  if (tile.terrain === "Water") return "川 / 進入不可";

  const traits = [];
  if (tile.escape) traits.push("離脱マス（小浜方面）");
  if (tile.cover) traits.push("遮蔽あり");
  if (tile.water) traits.push("水地");
  if (tile.height > 0) traits.push(`高さ +${tile.height}`);
  return `${terrainLabel(tile)} / 移動コスト ${terrainCost(tile)}${traits.length > 0 ? ` / ${traits.join(" / ")}` : ""}`;
}

function computeAutoZoom(mapWidth = 10, mapHeight = 10) {
  const cw = canvas?.clientWidth || window.innerWidth || 960;
  const ch = canvas?.clientHeight || 680;
  const isoW = (mapWidth + mapHeight) * (TILE_SIZE * 0.5) + 80;
  const isoH = (mapWidth + mapHeight) * (TILE_SIZE * 0.25) + 180;
  const fit = Math.min((cw * 0.92) / isoW, (ch * 0.86) / isoH);
  return clampZoom(Math.round(Math.min(1.15, Math.max(0.45, fit)) * 20) / 20);
}

function defaultZoom() {
  const cur = getCurrentState();
  return computeAutoZoom(cur?.map?.width ?? 10, cur?.map?.height ?? 10);
}

function loadSavedZoom() {
  try {
    const raw = window.localStorage.getItem(ZOOM_STORAGE_KEY);
    if (raw == null) return window.matchMedia("(max-width: 768px)").matches ? 0.65 : 0.95;
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) return 0.9;
    return clampZoom(value);
  } catch {
    return 0.9;
  }
}

function saveZoom(value) {
  try {
    window.localStorage.setItem(ZOOM_STORAGE_KEY, String(value));
  } catch {
    // ignore
  }
}

function clampZoom(value) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value));
}

function setZoom(value, userInitiated = true) {
  if (userInitiated) uiState.userAdjustedZoom = true;
  uiState.zoom = clampZoom(value);
  saveZoom(uiState.zoom);
  if (zoomRange) zoomRange.value = String(Math.round(uiState.zoom * 100));
  if (zoomLabel) zoomLabel.textContent = `${Math.round(uiState.zoom * 100)}%`;
  safeRender();
}

function currentZoom() {
  return clampZoom(uiState.zoom);
}

function tileAt(map, x, y) {
  if (!map || !Array.isArray(map.tiles)) return null;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  return map.tiles[y * map.width + x] ?? map.tiles.find((t) => t.x === x && t.y === y) ?? null;
}

function unitAt(units, x, y) {
  return units.find((unit) => unit.hp > 0 && unit.x === x && unit.y === y) ?? null;
}

function currentPlayerUnits(units) {
  return units.filter((unit) => unit.team === "player" && unit.hp > 0);
}

function currentEnemyUnits(units) {
  return units.filter((unit) => unit.team === "enemy" && unit.hp > 0);
}

function normalizeSnapshot(snapshot) {
  const tiles = snapshot?.map?.tiles ?? [];
  const units = snapshot?.units ?? [];
  return {
    scenario: snapshot?.scenario ?? uiState.scenario ?? "hitotoribashi",
    viewMode: snapshot?.view_mode ?? state.viewMode,
    turnNumber: snapshot?.turn_number ?? 1,
    phase: snapshot?.phase ?? "player",
    selectedUnitId: snapshot?.selected_unit_id ?? null,
    interactionMode: snapshot?.interaction_mode ?? null,
    selectedTile: snapshot?.selected_tile ?? null,
    moveOrigin: snapshot?.move_origin ?? null,
    message: snapshot?.message ?? "戦場接続完了",
    eventSeq: snapshot?.event_seq ?? 0,
    turnEvents: snapshot?.turn_events ?? [],
    map: {
      width: snapshot?.map?.width ?? 8,
      height: snapshot?.map?.height ?? 8,
      tiles: tiles.map((tile) => ({
        x: tile.x ?? 0,
        y: tile.y ?? 0,
        terrain: tile.terrain ?? "Plain",
        height: tile.height ?? 0,
        cover: Boolean(tile.cover),
        water: Boolean(tile.water),
        bridge: Boolean(tile.bridge),
        escape: Boolean(tile.escape),
      })),
    },
    units: units.map((unit) => {
      const team = unit.team ?? (unit.clan === 2 ? "enemy" : "player");
      return {
        id: unit.id ?? 0,
        clan: unit.clan ?? 0,
        job: unit.job ?? "Ashigaru",
        x: unit.x ?? 0,
        y: unit.y ?? 0,
        color: team === "enemy" ? COLORS.enemy : COLORS.player,
        team,
        mov: unit.mov ?? 4,
        range: unit.range ?? 1,
        hp: unit.hp ?? 100,
        maxHp: unit.max_hp ?? unit.hp ?? 100,
        atk: unit.atk ?? 10,
        moved: Boolean(unit.moved),
        acted: Boolean(unit.acted),
        leader: Boolean(unit.leader ?? (unit.id === 1 || unit.id === 3)),
        name: unit.name ?? "",
        role: unit.role ?? "",
        tag: unit.tag ?? "",
        basis: unit.basis ?? "",
        note: unit.note ?? "",
      };
    }),
    moveTiles: (snapshot?.move_tiles ?? []).map((tile) => `${tile.x},${tile.y}`),
    attackTiles: (snapshot?.attack_tiles ?? []).map((tile) => `${tile.x},${tile.y}`),
    isPlayerTurn: Boolean(snapshot?.is_player_turn),
    unitCount: snapshot?.unit_count ?? units.filter((u) => (u.hp ?? 0) > 0).length,
    abilities: snapshot?.abilities ?? [],
  };
}

function getCurrentState() {
  if (bridge.useWasm && bridge.instance) {
    try {
      const raw = bridge.instance.get_render_data();
      return normalizeSnapshot(JSON.parse(raw));
    } catch {
      return state;
    }
  }
  return state;
}

function snapshotState(current) {
  return {
    ...current,
    selectedTile: current.selectedTile ? { ...current.selectedTile } : null,
    moveOrigin: current.moveOrigin ? { ...current.moveOrigin } : null,
    units: current.units.map((u) => ({ ...u })),
  };
}

function viewOrigin(current) {
  const zoom = currentZoom();
  const cw = canvas.clientWidth || 960;
  const ch = canvas.clientHeight || 680;
  if (current.viewMode === "topdown") {
    const mapPixelWidth = current.map.width * TILE_SIZE * zoom;
    const mapPixelHeight = current.map.height * TILE_SIZE * zoom;
    return {
      x: Math.max(18, (cw - mapPixelWidth) / 2),
      y: Math.max(46, (ch - mapPixelHeight) / 2 + 12),
    };
  }
  const isoTotalH = (current.map.width + current.map.height) * (TILE_SIZE * 0.25 * zoom);
  return {
    x: cw / 2 - (TILE_SIZE * zoom) / 2,
    y: Math.max(66, (ch - isoTotalH) / 2 + 24 * zoom),
  };
}

function tileToScreen(tile, current) {
  const origin = viewOrigin(current);
  const size = TILE_SIZE * currentZoom();
  if (current.viewMode === "topdown") {
    return {
      x: origin.x + tile.x * size,
      y: origin.y + tile.y * size,
      size,
    };
  }
  const isoX = (tile.x - tile.y) * (size / 2);
  const isoY = (tile.x + tile.y) * (size / 4) - isoLiftPx(tile, currentZoom());
  return {
    x: origin.x + isoX,
    y: origin.y + isoY,
    size,
  };
}

function isoPolygon(pos) {
  const halfW = pos.size * 0.5;
  const halfH = pos.size * 0.25;
  return [
    { x: pos.x, y: pos.y + halfH },
    { x: pos.x + halfW, y: pos.y },
    { x: pos.x + pos.size, y: pos.y + halfH },
    { x: pos.x + halfW, y: pos.y + halfH * 2 },
  ];
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 0.00001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function screenToTile(point, current) {
  const tiles = [...current.map.tiles].sort((a, b) => {
    const da = current.viewMode === "isometric" ? a.x + a.y : a.y;
    const db = current.viewMode === "isometric" ? b.x + b.y : b.y;
    if (db !== da) return db - da;
    return b.x - a.x;
  });

  for (const tile of tiles) {
    const pos = tileToScreen(tile, current);
    if (current.viewMode === "topdown") {
      if (
        point.x >= pos.x &&
        point.x <= pos.x + pos.size - 2 &&
        point.y >= pos.y &&
        point.y <= pos.y + pos.size - 2
      ) {
        return tile;
      }
    } else if (pointInPolygon(point, isoPolygon(pos))) {
      return tile;
    }
  }
  return null;
}

// =========================================================
// Local Fallback Rules (when WASM unavailable)
// =========================================================
function reachableTiles(unit, current) {
  const queue = [{ x: unit.x, y: unit.y, cost: 0 }];
  const best = new Map();
  best.set(`${unit.x},${unit.y}`, 0);

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const node = queue.shift();
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = node.x + dx;
      const y = node.y + dy;
      const tile = tileAt(current.map, x, y);
      if (!tile || tile.terrain === "Water") continue;
      const occupied = unitAt(current.units, x, y);
      if (occupied && occupied.id !== unit.id) continue;
      const nextCost = node.cost + terrainCost(tile);
      if (nextCost > unit.mov) continue;
      const key = `${x},${y}`;
      if (!best.has(key) || nextCost < best.get(key)) {
        best.set(key, nextCost);
        queue.push({ x, y, cost: nextCost });
      }
    }
  }
  return best;
}

function attackableUnits(unit, current) {
  return current.units.filter((target) => {
    if (target.team === unit.team || target.hp <= 0) return false;
    return Math.abs(target.x - unit.x) + Math.abs(target.y - unit.y) <= unit.range;
  });
}

function shortestPathStep(start, goal, current, moverId) {
  const open = [{ x: start.x, y: start.y, cost: 0 }];
  const prev = new Map();
  const costMap = new Map();
  costMap.set(`${start.x},${start.y}`, 0);

  while (open.length > 0) {
    open.sort((a, b) => a.cost - b.cost);
    const node = open.shift();
    if (node.x === goal.x && node.y === goal.y) break;

    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = node.x + dx;
      const y = node.y + dy;
      const tile = tileAt(current.map, x, y);
      if (!tile || tile.terrain === "Water") continue;
      const occupied = unitAt(current.units, x, y);
      if (occupied && occupied.id !== moverId && !(x === goal.x && y === goal.y)) continue;
      const nextCost = node.cost + terrainCost(tile);
      const key = `${x},${y}`;
      if (nextCost < (costMap.get(key) ?? Infinity)) {
        costMap.set(key, nextCost);
        prev.set(key, `${node.x},${node.y}`);
        open.push({ x, y, cost: nextCost });
      }
    }
  }
  const goalKey = `${goal.x},${goal.y}`;
  if (!prev.has(goalKey)) return null;
  let cursor = goalKey;
  let parent = prev.get(cursor);
  while (parent && parent !== `${start.x},${start.y}`) {
    cursor = parent;
    parent = prev.get(cursor);
  }
  const [x, y] = cursor.split(",").map(Number);
  return { x, y };
}

function selectedPlayerUnit(current) {
  if (current.selectedUnitId == null) return null;
  return current.units.find((u) => u.id === current.selectedUnitId && u.team === "player" && u.hp > 0) ?? null;
}

function selectedUnitById(current) {
  if (current.selectedUnitId == null) return null;
  return current.units.find((u) => u.id === current.selectedUnitId && u.hp > 0) ?? null;
}

function isMoveMode(current) {
  return (current.interactionMode ?? null) === "move";
}

function selectedTileAt(current) {
  if (!current.selectedTile) return null;
  return tileAt(current.map, current.selectedTile.x, current.selectedTile.y);
}

function selectedTileUnit(current) {
  if (!current.selectedTile) return null;
  return unitAt(current.units, current.selectedTile.x, current.selectedTile.y);
}

function canPlayerAttackTarget(current, target) {
  if (!target || target.team !== "enemy" || target.hp <= 0) return false;
  const attacker = selectedPlayerUnit(current);
  if (!attacker || attacker.acted || attacker.hp <= 0 || current.phase !== "player") return false;
  return Math.abs(target.x - attacker.x) + Math.abs(target.y - attacker.y) <= attacker.range;
}

function abilitiesForUnit(unit, current = state) {
  if (!unit) return [];
  if (Array.isArray(current.abilities) && current.abilities.length > 0 && unit.team === "player") {
    return current.abilities;
  }
  switch (unit.job) {
    case "Ashigaru": return [{ id: 0, name: "押し込み", range: 1, cost: 2 }];
    case "Yumi": return [{ id: 0, name: "曲射", range: 4, cost: 3 }];
    case "Teppo": return [{ id: 0, name: "火縄チャージ", range: 5, cost: 4 }];
    case "Ninja": return [{ id: 0, name: "煙玉", range: 0, cost: 2 }];
    case "Strategist": return [{ id: 0, name: "陣形変更", range: 2, cost: 3 }];
    default: return [];
  }
}

// =========================================================
// Actions (WASM primary + local JS fallback)
// =========================================================
function clearAttackFx() {
  if (attackFxTimerId) {
    window.clearTimeout(attackFxTimerId);
    attackFxTimerId = 0;
  }
  uiState.attackFx = null;
}

function updateAttackFxOverlay() {
  if (!attackFxOverlay) return;
  if (!uiState.attackFx) {
    attackFxOverlay.hidden = true;
    attackFxOverlay.innerHTML = "";
    return;
  }
  attackFxOverlay.hidden = false;
  attackFxOverlay.innerHTML = `
    <span class="attackFxSlash"></span>
    <span class="attackFxLabel">${escapeHtml(uiState.attackFx.attackerName)} → ${escapeHtml(uiState.attackFx.targetName)}</span>
  `;
}

function checkAndHandleOutcome() {
  const current = getCurrentState();
  const outcome = evaluateScenarioOutcome(current);
  if (outcome) {
    triggerResolution(outcome, current);
    return true;
  }
  return false;
}

function executePlayerAttack(target) {
  if (battleTracker.resolved) return false;
  finishPlaybackImmediately(true);
  const before = snapshotState(getCurrentState());
  const attacker = selectedPlayerUnit(before);
  if (!attacker || !target || !canPlayerAttackTarget(before, target)) {
    soundPlay("ui");
    return false;
  }

  uiState.attackFx = {
    attackerName: unitDisplayName(attacker),
    targetName: unitDisplayName(target),
  };
  updateAttackFxOverlay();
  if (attackFxTimerId) window.clearTimeout(attackFxTimerId);
  attackFxTimerId = window.setTimeout(() => {
    attackFxTimerId = 0;
    uiState.attackFx = null;
    updateAttackFxOverlay();
  }, 300);

  if (bridge.useWasm && bridge.instance) {
    bridge.instance.click_tile(target.x, target.y);
    bridge.instance.attack_selected();
    const after = snapshotState(getCurrentState());
    startEventPlayback(before, after, after.turnEvents, "player", () => {
      checkAndHandleOutcome();
      safeRender();
    });
    safeRender();
    return true;
  }

  // Local fallback
  const localAttacker = state.units.find((u) => u.id === attacker.id);
  const localTarget = state.units.find((u) => u.id === target.id);
  if (!localAttacker || !localTarget) return false;
  localTarget.hp = Math.max(0, localTarget.hp - localAttacker.atk);
  localAttacker.acted = true;
  state.selectedTile = { x: localTarget.x, y: localTarget.y };
  state.moveOrigin = null;
  state.interactionMode = null;
  const killed = localTarget.hp <= 0;
  state.message = `${unitDisplayName(localAttacker)} が ${unitDisplayName(localTarget)} に ${localAttacker.atk} ダメージ${killed ? " / 撃破" : ""}`;
  state.turnEvents = [
    {
      type: "attack",
      attacker_id: localAttacker.id,
      target_id: localTarget.id,
      damage: localAttacker.atk,
      killed,
      target_hp: localTarget.hp,
    },
  ];
  state.eventSeq += 1;
  const after = snapshotState(state);
  startEventPlayback(before, after, state.turnEvents, "player", () => {
    checkAndHandleOutcome();
    safeRender();
  });
  safeRender();
  return true;
}

function executeAbility(abilityId) {
  if (battleTracker.resolved) return;
  finishPlaybackImmediately(true);
  const before = snapshotState(getCurrentState());
  const actor = selectedPlayerUnit(before);
  if (!actor || actor.acted || before.phase !== "player") {
    soundPlay("ui");
    return;
  }

  if (bridge.useWasm && bridge.instance && typeof bridge.instance.use_ability === "function") {
    bridge.instance.use_ability(abilityId | 0);
    const after = snapshotState(getCurrentState());
    if (after.turnEvents && after.turnEvents.length > 0) {
      startEventPlayback(before, after, after.turnEvents, "player", () => {
        checkAndHandleOutcome();
        safeRender();
      });
    } else {
      addBattleLog(after.message, "system", after.turnNumber);
      soundPlay("ui");
    }
    safeRender();
    return;
  }

  // Local fallback for Strategist/Ashigaru/Yumi/Teppo/Ninja
  const localActor = state.units.find((u) => u.id === actor.id);
  if (!localActor) return;
  state.turnEvents = [];
  if (localActor.job === "Strategist") {
    let healed = 0;
    for (const u of state.units) {
      if (u.team === "player" && u.hp > 0 && Math.abs(u.x - localActor.x) + Math.abs(u.y - localActor.y) <= 2) {
        const b = u.hp;
        u.hp = Math.min(u.maxHp, u.hp + 6);
        healed += u.hp - b;
      }
    }
    localActor.acted = true;
    state.message = `${unitDisplayName(localActor)} が陣形を整えた`;
    state.turnEvents.push({ type: "ability", unit_id: localActor.id, name: "陣形変更", target_id: null, damage: 0, healed });
  } else if (localActor.job === "Yumi") {
    const targets = state.units.filter((u) => u.team === "enemy" && u.hp > 0 && Math.abs(u.x - localActor.x) + Math.abs(u.y - localActor.y) <= 4);
    targets.sort((a, b) => b.hp - a.hp);
    if (targets[0]) {
      const dmg = localActor.atk + 4;
      targets[0].hp = Math.max(0, targets[0].hp - dmg);
      localActor.acted = true;
      state.message = `${unitDisplayName(localActor)} の曲射で ${dmg} ダメージ`;
      state.turnEvents.push({ type: "attack", attacker_id: localActor.id, target_id: targets[0].id, damage: dmg, killed: targets[0].hp <= 0, target_hp: targets[0].hp });
    }
  } else if (localActor.job === "Ashigaru") {
    const target = state.units.find((u) => u.team === "enemy" && u.hp > 0 && Math.abs(u.x - localActor.x) + Math.abs(u.y - localActor.y) === 1);
    if (target) {
      const nx = target.x + Math.sign(target.x - localActor.x);
      const ny = target.y + Math.sign(target.y - localActor.y);
      const nt = tileAt(state.map, nx, ny);
      if (nt && nt.terrain !== "Water" && !unitAt(state.units, nx, ny)) {
        const fx = target.x;
        const fy = target.y;
        target.x = nx;
        target.y = ny;
        localActor.acted = true;
        state.message = `${unitDisplayName(localActor)} の押し込み`;
        state.turnEvents.push({ type: "move", unit_id: target.id, from_x: fx, from_y: fy, to_x: nx, to_y: ny });
        state.turnEvents.push({ type: "ability", unit_id: localActor.id, name: "押し込み", target_id: target.id, damage: 0, healed: 0 });
      } else {
        target.hp = Math.max(0, target.hp - 8);
        localActor.acted = true;
        state.message = `${unitDisplayName(localActor)} の押し込み失敗、代わりに8ダメージ`;
        state.turnEvents.push({ type: "attack", attacker_id: localActor.id, target_id: target.id, damage: 8, killed: target.hp <= 0, target_hp: target.hp });
      }
    }
  }
  const after = snapshotState(state);
  if (state.turnEvents.length > 0) {
    startEventPlayback(before, after, state.turnEvents, "player", () => {
      checkAndHandleOutcome();
      safeRender();
    });
  } else {
    soundPlay("ui");
  }
  safeRender();
}

function beginMoveSelection() {
  if (battleTracker.resolved) return;
  finishPlaybackImmediately(true);
  soundPlay("select");
  if (bridge.useWasm && bridge.instance && typeof bridge.instance.begin_move === "function") {
    bridge.instance.begin_move();
    safeRender();
    return;
  }
  const selected = selectedPlayerUnit(state);
  if (!selected || state.phase !== "player" || selected.moved) {
    state.message = "移動できる自軍ユニットを選択してください";
    safeRender();
    return;
  }
  state.interactionMode = "move";
  state.selectedUnitId = selected.id;
  state.selectedTile = { x: selected.x, y: selected.y };
  state.moveOrigin = { unitId: selected.id, x: selected.x, y: selected.y, moved: selected.moved };
  state.message = `${unitDisplayName(selected)} の移動先を選択してください`;
  safeRender();
}

function cancelMoveSelection() {
  if (battleTracker.resolved) return;
  finishPlaybackImmediately(true);
  soundPlay("ui");
  if (bridge.useWasm && bridge.instance && typeof bridge.instance.cancel_move === "function") {
    bridge.instance.cancel_move();
    safeRender();
    return;
  }
  if (state.moveOrigin) {
    const unit = state.units.find((u) => u.id === state.moveOrigin.unitId);
    if (unit) {
      unit.x = state.moveOrigin.x;
      unit.y = state.moveOrigin.y;
      unit.moved = state.moveOrigin.moved;
      state.selectedUnitId = unit.id;
      state.selectedTile = { x: unit.x, y: unit.y };
    }
  }
  state.moveOrigin = null;
  state.interactionMode = null;
  state.message = "移動をキャンセル";
  safeRender();
}

function runLocalEnemyTurn() {
  const events = [];
  const enemies = currentEnemyUnits(state.units);
  for (const enemy of enemies) {
    const players = currentPlayerUnits(state.units);
    if (players.length === 0) break;
    let nearest = players[0];
    let bestD = Math.abs(nearest.x - enemy.x) + Math.abs(nearest.y - enemy.y);
    for (const p of players.slice(1)) {
      const d = Math.abs(p.x - enemy.x) + Math.abs(p.y - enemy.y);
      if (d < bestD) {
        bestD = d;
        nearest = p;
      }
    }

    let steps = enemy.mov;
    while (steps > 0) {
      const cur = { x: enemy.x, y: enemy.y };
      const next = shortestPathStep(cur, nearest, state, enemy.id);
      if (!next || (next.x === cur.x && next.y === cur.y)) break;
      if (unitAt(state.units, next.x, next.y)) break;
      if (next.x === nearest.x && next.y === nearest.y) break;
      enemy.x = next.x;
      enemy.y = next.y;
      events.push({ type: "move", unit_id: enemy.id, from_x: cur.x, from_y: cur.y, to_x: next.x, to_y: next.y });
      steps -= 1;
    }

    const dist = Math.abs(nearest.x - enemy.x) + Math.abs(nearest.y - enemy.y);
    if (dist <= enemy.range && nearest.hp > 0) {
      nearest.hp = Math.max(0, nearest.hp - enemy.atk);
      events.push({
        type: "attack",
        attacker_id: enemy.id,
        target_id: nearest.id,
        damage: enemy.atk,
        killed: nearest.hp <= 0,
        target_hp: nearest.hp,
      });
      if (currentPlayerUnits(state.units).length === 0) {
        state.phase = "defeat";
        state.selectedUnitId = null;
        state.turnEvents = events;
        return;
      }
    }
  }

  for (const u of state.units) {
    if (u.team === "player") {
      u.moved = false;
      u.acted = false;
    }
  }
  state.phase = "player";
  state.turnNumber += 1;
  const first = currentPlayerUnits(state.units)[0] ?? null;
  state.selectedUnitId = first ? first.id : null;
  state.selectedTile = first ? { x: first.x, y: first.y } : null;
  state.interactionMode = null;
  state.moveOrigin = null;
  state.message = "自軍の行動です";
  state.turnEvents = events;
}

function runTurnEnd() {
  if (battleTracker.resolved) return;
  if (playback.active) {
    finishPlaybackImmediately(true);
  }
  const before = snapshotState(getCurrentState());
  if (before.phase !== "player") return;

  const enemyTitle = before.scenario === "hitotoribashi" ? "敵フェイズ — 南奥州連合軍" : "敵フェイズ";
  showPhaseBanner(enemyTitle, `第${before.turnNumber}ターン`, true, 950);
  soundPlay("turnStart", false);
  addBattleLog(`第${before.turnNumber}ターン 敵フェイズ開始`, "system", before.turnNumber);

  if (bridge.useWasm && bridge.instance) {
    bridge.instance.end_turn();
  } else {
    runLocalEnemyTurn();
  }

  const after = snapshotState(getCurrentState());
  const onEnemyDone = () => {
    // Check if scenario resolved during enemy turn or by survival turn count
    if (checkAndHandleOutcome()) {
      safeRender();
      return;
    }
    const label = after.scenario === "hitotoribashi" ? `第${after.turnNumber}ターン — 伊達軍` : `第${after.turnNumber}ターン — 自軍`;
    const sub =
      after.scenario === "hitotoribashi"
        ? `残り ${Math.max(0, SURVIVAL_TURNS - after.turnNumber + 1)} ターンで撤退完了`
        : "自軍フェイズ";
    showPhaseBanner(label, sub, false, 1100);
    soundPlay("turnStart", true);
    addBattleLog(`敵フェイズ終了。第${after.turnNumber}ターン 伊達軍の行動。`, "system", after.turnNumber);
    safeRender();
  };

  if (after.turnEvents && after.turnEvents.length > 0) {
    startEventPlayback(before, after, after.turnEvents, "enemy", onEnemyDone);
  } else {
    onEnemyDone();
  }
  safeRender();
}

function startScenario(scenario = "hitotoribashi") {
  finishPlaybackImmediately(false);
  clearAttackFx();
  uiState.scenario = scenario;
  uiState.started = true;
  uiState.unitPanelHidden = false;
  uiState.enemyPanelHidden = true;

  if (window.srpgSound) {
    window.srpgSound.unlock();
    window.srpgSound.startBgm();
    window.srpgSound.play("turnStart", true);
  }

  const scenarioId = scenario === "hitotoribashi" ? 1 : 0;
  if (bridge.useWasm && bridge.instance && typeof bridge.instance.set_scenario === "function") {
    bridge.instance.set_scenario(scenarioId);
  } else {
    Object.assign(state, createScenarioState(scenario));
  }

  if (startOverlay) startOverlay.hidden = true;
  resetBattleTracker(scenario);

  // Auto-fit zoom on first start if user hasn't manually tweaked it
  const cur = getCurrentState();
  if (!uiState.userAdjustedZoom) {
    setZoom(computeAutoZoom(cur.map.width, cur.map.height), false);
  }

  const title = scenario === "hitotoribashi" ? "第1ターン — 伊達軍" : "第1ターン — 自軍";
  const sub = scenario === "hitotoribashi" ? "天正13年11月17日 人取橋の合戦" : "従来デモ配置";
  showPhaseBanner(title, sub, false, 1300);
  safeRender();
}

function resetCurrentScenario() {
  finishPlaybackImmediately(false);
  clearAttackFx();
  soundPlay("ui");
  if (bridge.useWasm && bridge.instance) {
    bridge.instance.reset();
  } else {
    Object.assign(state, createScenarioState(uiState.scenario));
  }
  uiState.unitPanelHidden = false;
  uiState.enemyPanelHidden = true;
  resetBattleTracker(uiState.scenario);
  const title = uiState.scenario === "hitotoribashi" ? "第1ターン — 伊達軍" : "第1ターン — 自軍";
  showPhaseBanner(title, "再出陣", false, 1050);
  safeRender();
}

function returnToStartScreen() {
  finishPlaybackImmediately(false);
  hideResultOverlay();
  if (helpOverlay) helpOverlay.hidden = true;
  if (startOverlay) startOverlay.hidden = false;
  uiState.started = false;
  soundPlay("ui");
  syncAudioUi();
}

// =========================================================
// Input Handling (Pillar 6 — Non-blocking & Responsive)
// =========================================================
function hitTestUnit(point, current) {
  let best = null;
  let bestDist = Infinity;
  for (const hit of frame.unitHitboxes) {
    const dist = Math.hypot(point.x - hit.x, point.y - hit.y);
    if (dist <= hit.radius && dist < bestDist) {
      const unit = unitAt(current.units, hit.tileX, hit.tileY);
      if (!unit || unit.hp <= 0) continue;
      best = { ...hit, unit };
      bestDist = dist;
    }
  }
  return best;
}

function handleCanvasPoint(point, current, meta = {}) {
  if (!uiState.started || battleTracker.resolved) return;

  // Pillar 6: Accept input during animation by fast-forwarding playback cleanly
  if (playback.active) {
    finishPlaybackImmediately(true);
    if (battleTracker.resolved) return;
    current = getCurrentState();
  }

  const label = meta.longPress ? "長押し" : meta.source === "tap" ? "タップ" : "クリック";
  if (inputProbe) inputProbe.textContent = `input: ${label}`;

  const hitUnit = hitTestUnit(point, current);
  if (hitUnit) {
    const unit = hitUnit.unit;

    // Long press on own unit -> select & enter move mode
    if (meta.longPress && unit.team === "player" && current.phase === "player") {
      uiState.unitPanelHidden = false;
      soundPlay("select");
      if (bridge.useWasm && bridge.instance) {
        bridge.instance.click_tile(hitUnit.tileX, hitUnit.tileY);
        bridge.instance.begin_move();
      } else {
        state.selectedUnitId = unit.id;
        state.selectedTile = { x: hitUnit.tileX, y: hitUnit.tileY };
        beginMoveSelection();
      }
      safeRender();
      return;
    }

    // Enemy clicked/tapped
    if (unit.team === "enemy" && current.phase === "player") {
      const now = performance.now();
      const isSecondClick =
        uiState.lastEnemyClickId === unit.id &&
        current.selectedTile &&
        current.selectedTile.x === unit.x &&
        current.selectedTile.y === unit.y &&
        now - uiState.lastEnemyClickAt < 2500;
      uiState.lastEnemyClickId = unit.id;
      uiState.lastEnemyClickAt = now;
      uiState.enemyPanelHidden = false;
      uiState.unitPanelHidden = false;

      if ((meta.longPress || isSecondClick) && canPlayerAttackTarget(current, unit)) {
        executePlayerAttack(unit);
        return;
      }

      soundPlay("select");
      if (bridge.useWasm && bridge.instance) {
        bridge.instance.click_tile(hitUnit.tileX, hitUnit.tileY);
      } else {
        state.selectedTile = { x: hitUnit.tileX, y: hitUnit.tileY };
        state.interactionMode = null;
        state.message = canPlayerAttackTarget(state, unit)
          ? `${unitDisplayName(unit)} を確認 / 攻撃可能`
          : `${unitDisplayName(unit)} を確認`;
      }
      safeRender();
      return;
    }

    // Player unit clicked/tapped
    uiState.unitPanelHidden = false;
    uiState.lastEnemyClickId = null;
    soundPlay("select");
    if (bridge.useWasm && bridge.instance) {
      bridge.instance.click_tile(hitUnit.tileX, hitUnit.tileY);
    } else {
      state.selectedUnitId = unit.id;
      state.interactionMode = null;
      state.selectedTile = { x: hitUnit.tileX, y: hitUnit.tileY };
      state.message = `${unitDisplayName(unit)} を選択`;
    }
    safeRender();
    return;
  }

  // Tile clicked
  const tile = screenToTile(point, current);
  if (!tile) return;

  uiState.unitPanelHidden = false;
  uiState.lastEnemyClickId = null;
  const before = snapshotState(current);
  const wasMoveMode = isMoveMode(current);

  if (bridge.useWasm && bridge.instance) {
    bridge.instance.click_tile(tile.x, tile.y);
    const after = snapshotState(getCurrentState());
    if (wasMoveMode && after.turnEvents && after.turnEvents.some((e) => e.type === "move")) {
      startEventPlayback(before, after, after.turnEvents, "player", () => {
        checkAndHandleOutcome();
        safeRender();
      });
    } else {
      soundPlay("ui");
      checkAndHandleOutcome();
    }
    safeRender();
    return;
  }

  // Local fallback tile click
  if (state.phase !== "player") return;
  const selected = selectedPlayerUnit(state);
  if (wasMoveMode && selected && !selected.moved) {
    const moveMap = reachableTiles(selected, state);
    if (moveMap.has(`${tile.x},${tile.y}`) && !unitAt(state.units, tile.x, tile.y)) {
      const fx = selected.x;
      const fy = selected.y;
      selected.x = tile.x;
      selected.y = tile.y;
      selected.moved = true;
      state.interactionMode = null;
      state.selectedTile = { x: tile.x, y: tile.y };
      state.message = `${unitDisplayName(selected)} が ${tile.x},${tile.y} へ移動`;
      state.turnEvents = [{ type: "move", unit_id: selected.id, from_x: fx, from_y: fy, to_x: tile.x, to_y: tile.y }];
      const after = snapshotState(state);
      startEventPlayback(before, after, state.turnEvents, "player", () => {
        checkAndHandleOutcome();
        safeRender();
      });
      safeRender();
      return;
    }
  }
  soundPlay("ui");
  state.selectedTile = { x: tile.x, y: tile.y };
  state.message = tileSummary(tile);
  safeRender();
}

function cancelLongPressGesture() {
  if (gestureState.timerId) {
    clearTimeout(gestureState.timerId);
    gestureState.timerId = 0;
  }
  gestureState.active = false;
  gestureState.pointerId = null;
  gestureState.pointerType = null;
  gestureState.startPoint = null;
  gestureState.startTime = 0;
  gestureState.current = null;
  gestureState.longPressFired = false;
}

function beginLongPressGesture(event) {
  if (gestureState.active) cancelLongPressGesture();
  gestureState.active = true;
  gestureState.pointerId = event.pointerId;
  gestureState.pointerType = event.pointerType;
  gestureState.startTime = performance.now();
  gestureState.current = getCurrentState();
  const rect = canvas.getBoundingClientRect();
  gestureState.startPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  gestureState.longPressFired = false;

  if (canvas.setPointerCapture) {
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  gestureState.timerId = window.setTimeout(() => {
    if (!gestureState.active || gestureState.longPressFired || !gestureState.startPoint) return;
    gestureState.longPressFired = true;
    handleCanvasPoint(gestureState.startPoint, getCurrentState(), { longPress: true });
  }, LONG_PRESS_MS);
}

canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  beginLongPressGesture(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (!gestureState.active || gestureState.pointerId !== event.pointerId || gestureState.longPressFired) return;
  const rect = canvas.getBoundingClientRect();
  const pt = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  if (Math.hypot(pt.x - gestureState.startPoint.x, pt.y - gestureState.startPoint.y) > LONG_PRESS_MOVE_PX) {
    cancelLongPressGesture();
  }
});

canvas.addEventListener("pointerup", (event) => {
  if (!gestureState.active || gestureState.pointerId !== event.pointerId) return;
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const pt = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  const shouldTap = !gestureState.longPressFired;
  const src = event.pointerType === "touch" ? "tap" : "mouse";
  cancelLongPressGesture();
  if (shouldTap) {
    handleCanvasPoint(pt, getCurrentState(), { source: src });
  }
});

canvas.addEventListener("pointercancel", (event) => {
  if (gestureState.active && gestureState.pointerId === event.pointerId) {
    cancelLongPressGesture();
  }
});

// =========================================================
// Rich Canvas 2D Renderer (Pillar 3)
// =========================================================
function shadeColor(hex, percent) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const mix = (ch) => Math.max(0, Math.min(255, Math.round(ch + (255 - ch) * percent)));
  const darken = (ch) => Math.max(0, Math.min(255, Math.round(ch * (1 + percent))));
  const rr = percent >= 0 ? mix(r) : darken(r);
  const gg = percent >= 0 ? mix(g) : darken(g);
  const bb = percent >= 0 ? mix(b) : darken(b);
  return `rgb(${rr}, ${gg}, ${bb})`;
}

function roundedRectPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawBackdrop(width, height, scenario) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  if (scenario === "hitotoribashi") {
    grad.addColorStop(0, "#142030");
    grad.addColorStop(0.45, "#111b27");
    grad.addColorStop(1, "#0a1017");
  } else {
    grad.addColorStop(0, "#0f1722");
    grad.addColorStop(1, "#080d14");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle distant autumn mountain silhouette in upper background
  if (scenario === "hitotoribashi") {
    ctx.save();
    ctx.fillStyle = "rgba(38, 56, 76, 0.28)";
    ctx.beginPath();
    ctx.moveTo(0, height * 0.24);
    ctx.lineTo(width * 0.14, height * 0.12);
    ctx.lineTo(width * 0.29, height * 0.19);
    ctx.lineTo(width * 0.48, height * 0.08);
    ctx.lineTo(width * 0.67, height * 0.17);
    ctx.lineTo(width * 0.84, height * 0.1);
    ctx.lineTo(width, height * 0.2);
    ctx.lineTo(width, height * 0.36);
    ctx.lineTo(0, height * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function overlaysForCurrentState(current) {
  const move = new Set();
  const attack = new Set();
  const selected = selectedPlayerUnit(current);
  if (!selected || current.phase !== "player" || playback.active) {
    return { move, attack };
  }

  if (isMoveMode(current) && !selected.moved) {
    if (Array.isArray(current.moveTiles) && current.moveTiles.length > 0) {
      for (const k of current.moveTiles) move.add(k);
    } else {
      const reach = reachableTiles(selected, current);
      for (const k of reach.keys()) {
        if (k !== `${selected.x},${selected.y}`) move.add(k);
      }
    }
  }

  if (!selected.acted) {
    if (Array.isArray(current.attackTiles) && current.attackTiles.length > 0) {
      for (const k of current.attackTiles) attack.add(k);
    } else {
      for (const target of attackableUnits(selected, current)) {
        attack.add(`${target.x},${target.y}`);
      }
    }
  }

  return { move, attack };
}

function moveCostsForCurrentState(current) {
  const costs = new Map();
  const selected = selectedPlayerUnit(current);
  if (!selected || current.phase !== "player" || selected.moved || !isMoveMode(current) || playback.active) {
    return costs;
  }
  const reach = reachableTiles(selected, current);
  for (const [k, cost] of reach.entries()) {
    if (k !== `${selected.x},${selected.y}`) costs.set(k, cost);
  }
  return costs;
}

function drawIsoTerrainDetail(tile, polygon, pos, zoom, now) {
  const cx = pos.x + pos.size * 0.5;
  const cy = pos.y + pos.size * 0.25;

  if (tile.terrain === "Water") {
    // Flowing river lines (NE -> SW)
    const phase = ((now * 0.025 + tile.x * 11 + tile.y * 7) % 18) / 18;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
    ctx.closePath();
    ctx.clip();

    ctx.strokeStyle = "rgba(186, 230, 253, 0.52)";
    ctx.lineWidth = Math.max(1, 1.5 * zoom);
    for (let i = -1; i <= 1; i += 1) {
      const ox = (phase - 0.5) * pos.size * 0.35;
      const oy = i * 6.5 * zoom + ox * 0.48;
      ctx.beginPath();
      ctx.moveTo(cx - 16 * zoom - ox, cy + oy + 6 * zoom);
      ctx.quadraticCurveTo(cx - ox, cy + oy - 2 * zoom, cx + 16 * zoom - ox, cy + oy - 6 * zoom);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (tile.bridge) {
    // Wooden bridge deck planks + side railings (欄干) + pilings
    ctx.save();
    // Pilings beneath bridge
    ctx.fillStyle = "#4b311d";
    const lift = isoLiftPx(tile, zoom);
    ctx.fillRect(polygon[0].x + 5 * zoom, polygon[0].y + 2 * zoom, 3.5 * zoom, lift * 0.85);
    ctx.fillRect(polygon[3].x - 2 * zoom, polygon[3].y + 1 * zoom, 3.5 * zoom, lift * 0.85);
    ctx.fillRect(polygon[2].x - 8 * zoom, polygon[2].y + 2 * zoom, 3.5 * zoom, lift * 0.85);

    // Planks running perpendicular to N-S bridge crossing
    ctx.strokeStyle = "rgba(62, 36, 18, 0.65)";
    ctx.lineWidth = Math.max(1, 1.2 * zoom);
    for (let i = 1; i <= 5; i += 1) {
      const t = i / 6;
      const sx = polygon[0].x + (polygon[3].x - polygon[0].x) * t;
      const sy = polygon[0].y + (polygon[3].y - polygon[0].y) * t;
      const ex = polygon[1].x + (polygon[2].x - polygon[1].x) * t;
      const ey = polygon[1].y + (polygon[2].y - polygon[1].y) * t;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    // Wooden railings along W (0->3) and E (1->2) edges of bridge
    const railH = 7 * zoom;
    ctx.strokeStyle = "#7c4a22";
    ctx.lineWidth = Math.max(1.5, 2.4 * zoom);
    // West railing
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y - railH);
    ctx.lineTo(polygon[3].x, polygon[3].y - railH);
    ctx.stroke();
    // East railing
    ctx.beginPath();
    ctx.moveTo(polygon[1].x, polygon[1].y - railH);
    ctx.lineTo(polygon[2].x, polygon[2].y - railH);
    ctx.stroke();
    // Railing posts
    ctx.strokeStyle = "#5c3417";
    ctx.lineWidth = Math.max(1, 1.8 * zoom);
    for (const p of polygon) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - railH - 1.5 * zoom);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (tile.terrain === "RiceField") {
    // Flooded paddy sheen + earthen ridges
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
    ctx.closePath();
    ctx.clip();

    // Sunlit water shimmer strips
    ctx.fillStyle = "rgba(186, 235, 255, 0.28)";
    ctx.beginPath();
    ctx.ellipse(cx - 4 * zoom, cy - 1 * zoom, 15 * zoom, 5 * zoom, -0.25, 0, Math.PI * 2);
    ctx.fill();

    // Paddy crop lines
    ctx.strokeStyle = "rgba(38, 92, 48, 0.55)";
    ctx.lineWidth = Math.max(1, 1.1 * zoom);
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(cx - 16 * zoom, cy + i * 4.2 * zoom - 4 * zoom);
      ctx.lineTo(cx + 16 * zoom, cy + i * 4.2 * zoom + 4 * zoom);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (tile.terrain === "Terrace") {
    // Stepped terrace ridges
    ctx.save();
    ctx.strokeStyle = "rgba(52, 46, 22, 0.42)";
    ctx.lineWidth = Math.max(1, 1.3 * zoom);
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(cx - 14 * zoom, cy + i * 4.5 * zoom + 3 * zoom);
      ctx.lineTo(cx + 14 * zoom, cy + i * 4.5 * zoom - 3 * zoom);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (tile.terrain === "Road") {
    // Dirt highway track lines
    ctx.save();
    ctx.strokeStyle = "rgba(255, 241, 206, 0.36)";
    ctx.lineWidth = Math.max(1, 2 * zoom);
    ctx.beginPath();
    ctx.moveTo(cx - 10 * zoom, cy - 4 * zoom);
    ctx.lineTo(cx + 10 * zoom, cy + 4 * zoom);
    ctx.stroke();
    ctx.restore();
  }

  if (tile.terrain === "Castle") {
    // Japanese hilltop castle keep (白壁・石垣・瓦屋根)
    ctx.save();
    const bw = 18 * zoom;
    const bh = 11 * zoom;
    // White plaster lower tier
    ctx.fillStyle = "#e8e3d5";
    ctx.fillRect(cx - bw * 0.5, cy - bh * 1.15, bw, bh);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = Math.max(1, 1 * zoom);
    ctx.strokeRect(cx - bw * 0.5, cy - bh * 1.15, bw, bh);
    // Lower dark roof eaves
    ctx.fillStyle = "#263140";
    ctx.beginPath();
    ctx.moveTo(cx - bw * 0.72, cy - bh * 1.1);
    ctx.lineTo(cx + bw * 0.72, cy - bh * 1.1);
    ctx.lineTo(cx + bw * 0.48, cy - bh * 1.55);
    ctx.lineTo(cx - bw * 0.48, cy - bh * 1.55);
    ctx.closePath();
    ctx.fill();
    // Upper keep tier
    ctx.fillStyle = "#f4efe2";
    ctx.fillRect(cx - bw * 0.32, cy - bh * 2.15, bw * 0.64, bh * 0.65);
    // Top roof
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.moveTo(cx - bw * 0.52, cy - bh * 2.1);
    ctx.lineTo(cx + bw * 0.52, cy - bh * 2.1);
    ctx.lineTo(cx, cy - bh * 2.75);
    ctx.closePath();
    ctx.fill();
    // Golden shachihoko glint
    ctx.fillStyle = "#facc15";
    ctx.fillRect(cx - 1.5 * zoom, cy - bh * 2.85, 3 * zoom, 2 * zoom);
    ctx.restore();
  } else if (tile.terrain === "Town") {
    // Small roofed town houses
    ctx.save();
    ctx.fillStyle = "#5c3b28";
    ctx.beginPath();
    ctx.moveTo(cx - 10 * zoom, cy);
    ctx.lineTo(cx - 2 * zoom, cy - 6 * zoom);
    ctx.lineTo(cx + 6 * zoom, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#754c33";
    ctx.beginPath();
    ctx.moveTo(cx - 1 * zoom, cy + 4 * zoom);
    ctx.lineTo(cx + 7 * zoom, cy - 2 * zoom);
    ctx.lineTo(cx + 14 * zoom, cy + 4 * zoom);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (tile.cover && tile.terrain !== "Water") {
    // Autumn foliage trees (maple orange/gold & pine green — Nov 1585)
    ctx.save();
    const isMaple = (tile.x + tile.y) % 2 === 0;
    ctx.fillStyle = "#4a3420";
    ctx.fillRect(cx + 9 * zoom, cy - 5 * zoom, 2.2 * zoom, 6 * zoom);
    ctx.fillStyle = isMaple ? "#d97706" : "#2f6b3c";
    ctx.beginPath();
    ctx.arc(cx + 10 * zoom, cy - 7 * zoom, 5.5 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isMaple ? "#f59e0b" : "#3f874f";
    ctx.beginPath();
    ctx.arc(cx + 8 * zoom, cy - 9 * zoom, 3.6 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Escape tile beacon (小浜方面・離脱マス)
  if (tile.escape) {
    const pulse = 0.55 + 0.45 * Math.sin(now * 0.005);
    ctx.save();
    ctx.strokeStyle = `rgba(250, 204, 21, ${0.55 + 0.4 * pulse})`;
    ctx.lineWidth = Math.max(1.5, 2.4 * zoom);
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = `rgba(250, 204, 21, ${0.18 + 0.14 * pulse})`;
    ctx.fill();

    // Small crisp "離脱" tag
    const tagW = 30 * zoom;
    const tagH = 14 * zoom;
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "rgba(250, 204, 21, 0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    roundedRectPath(cx - tagW / 2, cy - tagH / 2 - 2 * zoom, tagW, tagH, 4 * zoom);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fef08a";
    ctx.font = `700 ${Math.max(8, 9.5 * zoom)}px "GenInterfaceJP", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("離脱", cx, cy - 1.5 * zoom);
    ctx.restore();
  }
}

function drawIsoTile(tile, pos, current, overlays, now) {
  const polygon = isoPolygon(pos);
  const key = `${tile.x},${tile.y}`;
  const base = terrainColor(tile);
  const depth = renderHeight(tile);
  const zoom = pos.size / TILE_SIZE;
  const heightPx = isoLiftPx(tile, zoom);

  const leftShade = tile.terrain === "Castle" ? "#5a6370" : shadeColor(base, depth > 0 ? -0.22 : -0.28);
  const rightShade = tile.terrain === "Castle" ? "#6d7785" : shadeColor(base, depth > 0 ? -0.14 : -0.18);
  const topShade = shadeColor(base, depth > 0 ? 0.08 : 0.03);

  // Left vertical face (polygon[0] -> polygon[3])
  ctx.fillStyle = leftShade;
  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  ctx.lineTo(polygon[3].x, polygon[3].y);
  ctx.lineTo(polygon[3].x, polygon[3].y + heightPx);
  ctx.lineTo(polygon[0].x, polygon[0].y + heightPx);
  ctx.closePath();
  ctx.fill();

  // Right vertical face (polygon[3] -> polygon[2])
  ctx.fillStyle = rightShade;
  ctx.beginPath();
  ctx.moveTo(polygon[3].x, polygon[3].y);
  ctx.lineTo(polygon[2].x, polygon[2].y);
  ctx.lineTo(polygon[2].x, polygon[2].y + heightPx);
  ctx.lineTo(polygon[3].x, polygon[3].y + heightPx);
  ctx.closePath();
  ctx.fill();

  // Stone wall courses on Castle / Terrace side faces
  if (tile.terrain === "Castle" || tile.terrain === "Terrace") {
    ctx.strokeStyle = tile.terrain === "Castle" ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.18)";
    ctx.lineWidth = Math.max(0.8, 1 * zoom);
    const rows = Math.max(2, Math.floor(heightPx / (7 * zoom)));
    for (let r = 1; r < rows; r += 1) {
      const dy = (heightPx * r) / rows;
      ctx.beginPath();
      ctx.moveTo(polygon[0].x, polygon[0].y + dy);
      ctx.lineTo(polygon[3].x, polygon[3].y + dy);
      ctx.lineTo(polygon[2].x, polygon[2].y + dy);
      ctx.stroke();
    }
  }

  // Top face
  ctx.fillStyle = topShade;
  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let i = 1; i < 4; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
  ctx.closePath();
  ctx.fill();

  // Terrain-specific surface detail
  drawIsoTerrainDetail(tile, polygon, pos, zoom, now);

  // Move / Attack / Selected overlays
  if (overlays.move.has(key)) {
    ctx.fillStyle = "rgba(56, 189, 248, 0.34)";
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(125, 211, 252, 0.92)";
    ctx.lineWidth = Math.max(1.2, 1.8 * zoom);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  if (overlays.attack.has(key)) {
    const pulse = 0.65 + 0.35 * Math.sin(now * 0.008);
    ctx.fillStyle = `rgba(239, 68, 68, ${0.32 + 0.16 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(252, 165, 165, 0.96)";
    ctx.lineWidth = Math.max(1.5, 2.2 * zoom);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  if (current.selectedTileKey === key) {
    ctx.strokeStyle = "rgba(250, 204, 21, 0.9)";
    ctx.lineWidth = Math.max(1.5, 2.2 * zoom);
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // Subtle tile border
  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let i = 1; i < 4; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
  ctx.closePath();
  ctx.strokeStyle = tile.terrain === "Water" ? "rgba(186, 230, 253, 0.25)" : "rgba(0, 0, 0, 0.28)";
  ctx.stroke();
}

function drawTopDownTile(tile, pos, current, overlays, now) {
  const zoom = pos.size / TILE_SIZE;
  const size = pos.size - Math.max(2, Math.round(2 * zoom));
  const key = `${tile.x},${tile.y}`;
  const base = terrainColor(tile);

  ctx.fillStyle = base;
  ctx.fillRect(pos.x, pos.y, size, size);

  // Terrain accents in TopDown view
  if (tile.terrain === "Water") {
    const wave = ((now * 0.02 + tile.x * 9) % 12) / 12;
    ctx.strokeStyle = "rgba(186, 230, 253, 0.45)";
    ctx.lineWidth = Math.max(1, 1.4 * zoom);
    ctx.beginPath();
    ctx.moveTo(pos.x + 6 * zoom, pos.y + (16 + wave * 12) * zoom);
    ctx.lineTo(pos.x + size - 6 * zoom, pos.y + (12 + wave * 12) * zoom);
    ctx.stroke();
  } else if (tile.bridge) {
    ctx.strokeStyle = "rgba(62, 36, 18, 0.7)";
    ctx.lineWidth = Math.max(1, 1.5 * zoom);
    for (let i = 1; i < 6; i += 1) {
      const py = pos.y + (size * i) / 6;
      ctx.beginPath();
      ctx.moveTo(pos.x + 3 * zoom, py);
      ctx.lineTo(pos.x + size - 3 * zoom, py);
      ctx.stroke();
    }
    ctx.fillStyle = "#6e3f1c";
    ctx.fillRect(pos.x, pos.y, 4 * zoom, size);
    ctx.fillRect(pos.x + size - 4 * zoom, pos.y, 4 * zoom, size);
  } else if (tile.terrain === "RiceField") {
    ctx.fillStyle = "rgba(186, 235, 255, 0.22)";
    ctx.fillRect(pos.x + 4 * zoom, pos.y + 4 * zoom, size - 8 * zoom, size * 0.42);
  } else if (tile.terrain === "Castle") {
    ctx.fillStyle = "#e8e3d5";
    ctx.fillRect(pos.x + size * 0.22, pos.y + size * 0.22, size * 0.56, size * 0.56);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(pos.x + size * 0.3, pos.y + size * 0.3, size * 0.4, size * 0.4);
  }

  if (tile.escape) {
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = Math.max(2, 2.5 * zoom);
    ctx.strokeRect(pos.x + 2, pos.y + 2, size - 4, size - 4);
    ctx.fillStyle = "#fef08a";
    ctx.font = `700 ${Math.max(8, 10 * zoom)}px "GenInterfaceJP", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("離脱", pos.x + size / 2, pos.y + 13 * zoom);
    ctx.lineWidth = 1;
  }

  if (overlays.move.has(key)) {
    ctx.fillStyle = "rgba(56, 189, 248, 0.34)";
    ctx.fillRect(pos.x, pos.y, size, size);
    ctx.strokeStyle = "rgba(125, 211, 252, 0.92)";
    ctx.lineWidth = Math.max(1.2, 2 * zoom);
    ctx.strokeRect(pos.x + 1, pos.y + 1, size - 2, size - 2);
    ctx.lineWidth = 1;
  }
  if (overlays.attack.has(key)) {
    ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
    ctx.fillRect(pos.x, pos.y, size, size);
    ctx.strokeStyle = "rgba(252, 165, 165, 0.96)";
    ctx.lineWidth = Math.max(1.5, 2.2 * zoom);
    ctx.strokeRect(pos.x + 1, pos.y + 1, size - 2, size - 2);
    ctx.lineWidth = 1;
  }
  if (current.selectedTileKey === key) {
    ctx.strokeStyle = "rgba(250, 204, 21, 0.95)";
    ctx.lineWidth = Math.max(1.5, 2.2 * zoom);
    ctx.strokeRect(pos.x + 1, pos.y + 1, size - 2, size - 2);
    ctx.lineWidth = 1;
  }

  ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
  ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, size, size);
}

function unitBadgeText(unit) {
  if (unit.tag === "masamune") return "政";
  if (unit.tag === "oniwa") return "鬼";
  if (unit.tag === "shigezane") return "実";
  if (unit.tag === "satake") return "佐";
  if (unit.tag === "ashina") return "蘆";
  if (unit.tag === "iwaki") return "岩";
  switch (unit.job) {
    case "Ashigaru": return "足";
    case "Yari": return "槍";
    case "Yumi": return "弓";
    case "Teppo": return "鉄";
    case "Ninja": return "忍";
    case "Strategist": return "軍";
    default: return String(unit.id);
  }
}

function getInterpolatedUnitScreenPos(unit, current, now) {
  const tile = tileAt(current.map, unit.x, unit.y);
  if (!tile) return null;
  let pos = tileToScreen(tile, current);

  // Smooth 1-tile hop during playback
  if (playback.active && playback.index < playback.steps.length) {
    const ev = playback.steps[playback.index];
    if (ev.type === "move" && ev.unit_id === unit.id) {
      const fromTile = tileAt(current.map, ev.from_x, ev.from_y);
      const toTile = tileAt(current.map, ev.to_x, ev.to_y);
      if (fromTile && toTile) {
        const fromP = tileToScreen(fromTile, current);
        const toP = tileToScreen(toTile, current);
        const t = easeOutCubic(Math.max(0, Math.min(1, (now - playback.stepStartedAt) / playback.stepDuration)));
        const hopY = Math.sin(t * Math.PI) * 7 * (pos.size / TILE_SIZE);
        pos = {
          x: fromP.x + (toP.x - fromP.x) * t,
          y: fromP.y + (toP.y - fromP.y) * t - hopY,
          size: pos.size,
        };
      }
    }
  }

  // Attack lunge offset
  const lunge = visualFx.lunges.get(unit.id);
  if (lunge) {
    const lt = (now - lunge.startedAt) / lunge.duration;
    if (lt >= 1) {
      visualFx.lunges.delete(unit.id);
    } else {
      const impulse = Math.sin(lt * Math.PI);
      pos = { x: pos.x + lunge.dx * impulse, y: pos.y + lunge.dy * impulse, size: pos.size };
    }
  }

  return pos;
}

function drawUnit(unit, current, now, alpha = 1, tilt = 0) {
  if (unit.hp <= 0 && alpha === 1) return;
  const pos = getInterpolatedUnitScreenPos(unit, current, now);
  if (!pos) return;
  const zoom = pos.size / TILE_SIZE;
  const isTopDown = current.viewMode === "topdown";
  const isPlayer = unit.team === "player";
  const isSelected = current.selectedUnitId === unit.id && isPlayer && !playback.active;
  const exhausted = isPlayer && unit.moved && unit.acted && current.phase === "player";

  // Idle subtle vertical bob
  const bob = alpha === 1 ? Math.sin(now * 0.0042 + unit.id * 1.3) * 1.6 * zoom : 0;
  const baseX = pos.x + pos.size * 0.5;
  const baseY = isTopDown ? pos.y + pos.size * 0.52 : pos.y + pos.size * 0.24;
  const x = baseX;
  const y = baseY - 4 * zoom + bob;
  const radius = (isTopDown ? 13 : 11.5) * zoom;

  if (alpha === 1) {
    frame.unitHitboxes.push({
      id: unit.id,
      tileX: unit.x,
      tileY: unit.y,
      x,
      y,
      radius: radius + 12 * zoom,
    });
  }

  ctx.save();
  ctx.globalAlpha = exhausted ? 0.72 * alpha : alpha;

  // Selected glowing golden ground ring under unit's feet
  if (isSelected) {
    const pulse = 0.65 + 0.35 * Math.sin(now * 0.007);
    ctx.strokeStyle = `rgba(250, 204, 21, ${0.7 + 0.3 * pulse})`;
    ctx.lineWidth = Math.max(2, 2.8 * zoom);
    ctx.beginPath();
    ctx.ellipse(baseX, baseY + 5 * zoom, radius + 7 * zoom, (radius + 7 * zoom) * 0.52, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = Math.max(1, 1.2 * zoom);
    ctx.beginPath();
    ctx.ellipse(baseX, baseY + 5 * zoom, radius + 3.5 * zoom, (radius + 3.5 * zoom) * 0.52, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Ground elliptical shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.beginPath();
  ctx.ellipse(baseX, baseY + 6 * zoom, radius + 2.5 * zoom, 5.2 * zoom, 0, 0, Math.PI * 2);
  ctx.fill();

  // Optional collapse tilt when defeated
  if (tilt !== 0) {
    ctx.translate(baseX, baseY + 4 * zoom);
    ctx.rotate(tilt);
    ctx.translate(-baseX, -(baseY + 4 * zoom));
  }

  // Tall Nobori Sashimono Flag (旗指物) — Date blue crescent vs Coalition red sunburst
  const poleX = x + (isPlayer ? -radius * 0.78 : radius * 0.78);
  const poleTopY = y - 28 * zoom;
  ctx.strokeStyle = "#d4c39a";
  ctx.lineWidth = Math.max(1.2, 1.8 * zoom);
  ctx.beginPath();
  ctx.moveTo(poleX, baseY + 3 * zoom);
  ctx.lineTo(poleX, poleTopY);
  ctx.stroke();

  const flagW = 10 * zoom;
  const flagH = 18 * zoom;
  const flagX = isPlayer ? poleX - flagW : poleX;
  const flutter = Math.sin(now * 0.006 + unit.id) * 1.2 * zoom;
  ctx.fillStyle = isPlayer ? "#1d4ed8" : "#b91c1c";
  ctx.strokeStyle = isPlayer ? "#93c5fd" : "#fca5a5";
  ctx.lineWidth = Math.max(0.8, 1 * zoom);
  ctx.beginPath();
  ctx.moveTo(poleX, poleTopY);
  ctx.lineTo(flagX + (isPlayer ? 0 : flagW), poleTopY + flutter * 0.4);
  ctx.lineTo(flagX + (isPlayer ? 0 : flagW), poleTopY + flagH + flutter);
  ctx.lineTo(poleX, poleTopY + flagH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Clan Crest on Flag
  const fcx = (poleX + (isPlayer ? flagX : flagX + flagW)) * 0.5;
  const fcy = poleTopY + flagH * 0.48;
  ctx.fillStyle = "#fde047";
  if (isPlayer) {
    // Date Crescent Moon (三日月)
    ctx.beginPath();
    ctx.arc(fcx, fcy, 3.1 * zoom, 0.3, Math.PI * 1.7);
    ctx.arc(fcx + 1.1 * zoom, fcy, 2.3 * zoom, Math.PI * 1.65, 0.35, true);
    ctx.closePath();
    ctx.fill();
  } else {
    // Coalition gold bars / sunburst
    ctx.fillRect(fcx - 2.6 * zoom, fcy - 2.6 * zoom, 5.2 * zoom, 1.5 * zoom);
    ctx.fillRect(fcx - 2.6 * zoom, fcy - 0.2 * zoom, 5.2 * zoom, 1.5 * zoom);
    ctx.fillRect(fcx - 2.6 * zoom, fcy + 2.2 * zoom, 5.2 * zoom, 1.5 * zoom);
  }

  // Armored Samurai Token Body
  const hitUntil = visualFx.hitFlashes.get(unit.id) ?? 0;
  const isFlashing = now < hitUntil;
  const bodyGrad = ctx.createRadialGradient(
    x - radius * 0.3,
    y - radius * 0.35,
    radius * 0.15,
    x,
    y,
    radius
  );
  if (isFlashing) {
    bodyGrad.addColorStop(0, "#ffffff");
    bodyGrad.addColorStop(1, "#fecaca");
  } else if (isPlayer) {
    bodyGrad.addColorStop(0, "#3b82f6");
    bodyGrad.addColorStop(1, "#1e3a8a");
  } else {
    bodyGrad.addColorStop(0, "#ef4444");
    bodyGrad.addColorStop(1, "#7f1d1d");
  }

  ctx.beginPath();
  ctx.fillStyle = bodyGrad;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = unit.leader ? "#facc15" : isPlayer ? "#bfdbfe" : "#fecaca";
  ctx.lineWidth = unit.leader ? Math.max(2, 2.6 * zoom) : Math.max(1.2, 1.6 * zoom);
  ctx.stroke();

  // Iconic headgear accents for key historical commanders
  if (unit.tag === "oniwa") {
    // 鬼庭良直's legendary yellow cotton cap (黄の綿帽子)
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(x, y - radius * 0.72, radius * 0.56, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#854d0e";
    ctx.lineWidth = Math.max(1, 1.2 * zoom);
    ctx.stroke();
  } else if (unit.tag === "masamune") {
    // Masamune's golden crescent kabuto crest (三日月前立)
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = Math.max(1.6, 2.2 * zoom);
    ctx.beginPath();
    ctx.arc(x, y - radius * 1.15, radius * 0.65, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
  }

  // Unit character emblem
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.max(9, 12.5 * zoom)}px "GenInterfaceJP", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(unitBadgeText(unit), x, y + 0.5 * zoom);

  // HP bar directly below unit
  const barW = 32 * zoom;
  const barH = 4.6 * zoom;
  const hpPct = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
  ctx.fillStyle = "rgba(8, 12, 18, 0.82)";
  ctx.fillRect(x - barW / 2 - 1, baseY + 7 * zoom, barW + 2, barH + 2);
  ctx.fillStyle = isPlayer ? (hpPct < 0.35 ? "#f59e0b" : "#34d399") : "#f87171";
  ctx.fillRect(x - barW / 2, baseY + 7 * zoom + 1, barW * hpPct, barH);

  // Name Ribbon (名前の帯) for named generals / units
  if (unit.name && alpha === 1) {
    const label = unit.name;
    const fontSize = Math.max(9, 10.5 * zoom);
    ctx.font = `700 ${fontSize}px "GenInterfaceJP", sans-serif`;
    const textW = ctx.measureText(label).width;
    const padX = 5 * zoom;
    const boxW = textW + padX * 2;
    const boxH = fontSize + 5 * zoom;
    const rx = x - boxW / 2;
    const ry = baseY + 13.5 * zoom;

    ctx.fillStyle = isPlayer ? "rgba(15, 29, 58, 0.88)" : "rgba(58, 15, 20, 0.88)";
    ctx.strokeStyle = unit.leader ? "rgba(250, 204, 21, 0.85)" : isPlayer ? "rgba(96, 165, 250, 0.65)" : "rgba(248, 113, 113, 0.65)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    roundedRectPath(rx, ry, boxW, boxH, 4 * zoom);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = unit.leader ? "#fef08a" : "#f8fafc";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, ry + boxH * 0.52);
  }

  ctx.restore();
}

function drawMoveCostLabel(text, pos, current) {
  const zoom = pos.size / TILE_SIZE;
  const cx = pos.x + pos.size * 0.5;
  const cy = current.viewMode === "topdown" ? pos.y + pos.size * 0.5 : pos.y + pos.size * 0.25;
  const w = 20 * zoom;
  const h = 16 * zoom;
  ctx.save();
  ctx.fillStyle = "rgba(8, 22, 42, 0.72)";
  ctx.strokeStyle = "rgba(125, 211, 252, 0.75)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundedRectPath(cx - w / 2, cy - h / 2, w, h, 6 * zoom);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e0f2fe";
  ctx.font = `700 ${Math.max(9, 11 * zoom)}px "GenInterfaceJP", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + 0.5);
  ctx.restore();
}

function drawAttackTargetReticle(unit, current, now) {
  if (playback.active || !canPlayerAttackTarget(current, unit)) return;
  const tile = tileAt(current.map, unit.x, unit.y);
  if (!tile) return;
  const pos = tileToScreen(tile, current);
  const zoom = pos.size / TILE_SIZE;
  const cx = pos.x + pos.size * 0.5;
  const cy = current.viewMode === "topdown" ? pos.y + pos.size * 0.45 : pos.y + pos.size * 0.2;
  const pulse = 0.65 + 0.35 * Math.sin(now * 0.01);

  ctx.save();
  ctx.strokeStyle = `rgba(255, 100, 100, ${0.7 + 0.3 * pulse})`;
  ctx.lineWidth = Math.max(2, 2.5 * zoom);
  ctx.beginPath();
  ctx.arc(cx, cy, (15 + pulse * 2.5) * zoom, 0, Math.PI * 2);
  ctx.stroke();

  const w = 20 * zoom;
  const h = 14 * zoom;
  ctx.fillStyle = "rgba(127, 29, 29, 0.92)";
  ctx.strokeStyle = "#fca5a5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundedRectPath(cx - w / 2, cy - 26 * zoom, w, h, 4 * zoom);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fee2e2";
  ctx.font = `700 ${Math.max(8, 10 * zoom)}px "GenInterfaceJP", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("攻", cx, cy - 19 * zoom);
  ctx.restore();
}

function drawVisualFx(now) {
  // Particles
  for (let i = visualFx.particles.length - 1; i >= 0; i -= 1) {
    const p = visualFx.particles[i];
    const t = (now - p.startedAt) / p.duration;
    if (t >= 1) {
      visualFx.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1 - t * 0.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Floating damage / hit / heal popups
  for (let i = visualFx.floatingTexts.length - 1; i >= 0; i -= 1) {
    const ft = visualFx.floatingTexts[i];
    const t = (now - ft.startedAt) / ft.duration;
    if (t >= 1) {
      visualFx.floatingTexts.splice(i, 1);
      continue;
    }
    const rise = easeOutCubic(t) * 34;
    const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    const size = Math.round(16 * ft.scale);
    ctx.font = `700 ${size}px "GenInterfaceJP", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "rgba(8, 12, 18, 0.92)";
    ctx.strokeText(ft.text, ft.x, ft.y - rise);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y - rise);
    ctx.restore();
  }
}

function render(now = performance.now()) {
  advancePlayback(now);

  const rawCurrent = getCurrentState();
  const displayUnits =
    playback.active && playback.visualUnits ? [...playback.visualUnits.values()] : rawCurrent.units;
  const current = { ...rawCurrent, units: displayUnits };

  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const width = canvas.clientWidth || 960;
  const height = canvas.clientHeight || 680;
  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  drawBackdrop(width, height, current.scenario);
  frame.unitHitboxes = [];

  const tiles = [...current.map.tiles].sort((a, b) => {
    const da = current.viewMode === "isometric" ? a.x + a.y : a.y;
    const db = current.viewMode === "isometric" ? b.x + b.y : b.y;
    if (da !== db) return da - db;
    return current.viewMode === "isometric" ? b.x - a.x : a.x - b.x;
  });

  const overlays = overlaysForCurrentState(current);
  const moveCosts = moveCostsForCurrentState(current);
  const selectedKey = current.selectedTile
    ? `${current.selectedTile.x},${current.selectedTile.y}`
    : null;
  const renderState = { ...current, selectedTileKey: selectedKey };

  for (const tile of tiles) {
    const pos = tileToScreen(tile, current);
    if (current.viewMode === "topdown") {
      drawTopDownTile(tile, pos, renderState, overlays, now);
    } else {
      drawIsoTile(tile, pos, renderState, overlays, now);
    }
  }

  // Move cost badges
  for (const [key, cost] of moveCosts.entries()) {
    const [x, y] = key.split(",").map(Number);
    const tile = tileAt(current.map, x, y);
    if (!tile) continue;
    drawMoveCostLabel(String(cost), tileToScreen(tile, current), current);
  }

  // Dying units collapse animation
  for (let i = visualFx.dyingUnits.length - 1; i >= 0; i -= 1) {
    const d = visualFx.dyingUnits[i];
    const t = (now - d.startedAt) / d.duration;
    if (t >= 1) {
      visualFx.dyingUnits.splice(i, 1);
      continue;
    }
    drawUnit(d.unit, current, now, 1 - t, t * 0.9);
  }

  // Sort units back-to-front so isometric depth overlaps properly
  const sortedUnits = [...current.units]
    .filter((u) => u.hp > 0)
    .sort((a, b) => (a.x + a.y) - (b.x + b.y));
  for (const unit of sortedUnits) {
    drawUnit(unit, current, now);
  }
  for (const unit of sortedUnits) {
    drawAttackTargetReticle(unit, current, now);
  }

  drawVisualFx(now);

  // Subtle compass / battlefield label in bottom-center
  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  ctx.font = `700 11px "GenInterfaceJP", sans-serif`;
  ctx.textAlign = "center";
  const footerText =
    current.scenario === "hitotoribashi"
      ? `北: 小浜方面（離脱） ／ 中央: 人取橋 ／ 南: 連合軍  [${current.viewMode === "isometric" ? "斜め見下ろし" : "真上2D"}]`
      : current.viewMode === "isometric"
        ? "斜め見下ろしビュー（従来デモ配置）"
        : "真上 2D ビュー（従来デモ配置）";
  ctx.fillText(footerText, width * 0.5, height - 10);

  drawHud(rawCurrent);
}

// =========================================================
// HUD & Unit Cards (Pillar 5)
// =========================================================
let lastHudSignature = "";

function drawHud(current) {
  const playersAlive = currentPlayerUnits(current.units).length;
  const enemiesAlive = currentEnemyUnits(current.units).length;
  const isHito = current.scenario === "hitotoribashi";
  const oniwa = current.units.find((u) => u.tag === "oniwa");

  // Compute lightweight signature to avoid rebuilding DOM every 60fps animation frame
  const sig = JSON.stringify({
    sc: current.scenario,
    vm: current.viewMode,
    t: current.turnNumber,
    p: current.phase,
    pb: playback.active,
    su: current.selectedUnitId,
    st: current.selectedTile,
    im: current.interactionMode,
    mo: Boolean(current.moveOrigin),
    msg: current.message,
    upH: uiState.unitPanelHidden,
    epH: uiState.enemyPanelHidden,
    res: battleTracker.resolved,
    od: battleTracker.oniwaDefendedTurns,
    units: current.units.map((u) => `${u.id}:${u.hp}:${u.x},${u.y}:${u.moved}:${u.acted}`),
  });
  if (sig === lastHudSignature) return;
  lastHudSignature = sig;

  if (scenarioBadge) scenarioBadge.textContent = isHito ? "人取橋の合戦（1585）" : "従来デモ配置";
  if (turnBadge) {
    turnBadge.textContent = isHito
      ? `第 ${Math.min(current.turnNumber, SURVIVAL_TURNS)} / ${SURVIVAL_TURNS} ターン`
      : `第 ${current.turnNumber} ターン`;
  }
  if (phaseBadge) {
    phaseBadge.className = "phaseBadge";
    if (battleTracker.resolved) {
      phaseBadge.classList.add(battleTracker.outcome?.victory ? "phase-victory" : "phase-defeat");
      phaseBadge.textContent = battleTracker.outcome?.victory ? "勝利" : "敗北";
    } else if (playback.active && playback.mode === "enemy") {
      phaseBadge.classList.add("phase-enemy");
      phaseBadge.textContent = isHito ? "連合軍 行動中" : "敵軍 行動中";
    } else {
      phaseBadge.classList.add("phase-player");
      phaseBadge.textContent = isHito ? "伊達軍" : "自軍";
    }
  }

  if (objectiveBanner) {
    if (isHito) {
      const rem = Math.max(0, SURVIVAL_TURNS - current.turnNumber + 1);
      objectiveBanner.textContent = `目標: 政宗を北端の「離脱」マスへ逃がす、またはあと ${rem} ターン生存（敗北: 政宗討死）`;
    } else {
      objectiveBanner.textContent = "目標: 敵部隊をすべて撃破する（従来デモ配置）";
    }
  }

  if (objectiveDetailEl) {
    if (isHito) {
      objectiveDetailEl.innerHTML =
        `<strong>勝利:</strong> 政宗が北端の「離脱」マス（小浜方面）へ到達、または${SURVIVAL_TURNS}ターン終了まで生存<br /><strong>敗北:</strong> 伊達政宗の討ち死に`;
    } else {
      objectiveDetailEl.innerHTML =
        "<strong>勝利:</strong> 敵部隊を全滅<br /><strong>敗北:</strong> 自軍部隊が全滅";
    }
  }

  if (playerForceLabel) playerForceLabel.textContent = `${isHito ? "伊達" : "自軍"} ${playersAlive}部隊`;
  if (enemyForceLabel) enemyForceLabel.textContent = `${isHito ? "連合" : "敵軍"} ${enemiesAlive}部隊`;

  if (oniwaStatusPill) {
    oniwaStatusPill.hidden = !isHito;
    if (isHito && oniwa) {
      const alive = oniwa.hp > 0;
      oniwaStatusPill.classList.toggle("fallen", !alive);
      oniwaStatusPill.textContent = alive
        ? `殿・鬼庭: ${battleTracker.oniwaDefendedTurns}T防衛中 (HP ${oniwa.hp})`
        : `殿・鬼庭: ${battleTracker.oniwaDefendedTurns}T防衛後 討死`;
    }
  }
  if (oniwaSummaryLine) {
    oniwaSummaryLine.hidden = !isHito;
    if (isHito && oniwa) {
      oniwaSummaryLine.textContent =
        oniwa.hp > 0
          ? `殿・鬼庭良直: 防衛 ${battleTracker.oniwaDefendedTurns} ターン継続中（交戦 ${battleTracker.oniwaEngagements} 回）`
          : `殿・鬼庭良直: ${battleTracker.oniwaDefendedTurns} ターン橋を守り抜いて討死（交戦 ${battleTracker.oniwaEngagements} 回）`;
    }
  }

  if (viewName) viewName.textContent = current.viewMode === "isometric" ? "斜め見下ろし" : "真上 2D";
  if (turnNumberEl) turnNumberEl.textContent = String(current.turnNumber);
  if (phaseNameEl) phaseNameEl.textContent = playback.active && playback.mode === "enemy" ? "敵フェイズ" : isHito ? "伊達軍" : "自軍";
  const sel = selectedUnitById(current);
  if (selectedUnitEl) selectedUnitEl.textContent = sel ? unitDisplayName(sel) : "なし";
  if (unitCountEl) unitCountEl.textContent = `${playersAlive + enemiesAlive}`;

  if (zoomLabel) zoomLabel.textContent = `${Math.round(currentZoom() * 100)}%`;
  if (zoomRange) zoomRange.value = String(Math.round(currentZoom() * 100));
  if (toggleViewButton) {
    toggleViewButton.textContent = current.viewMode === "isometric" ? "切替: 斜め見下ろし" : "切替: 真上 2D";
  }
  if (endTurnButton) {
    endTurnButton.disabled = battleTracker.resolved || current.phase !== "player";
  }
  statusLine.textContent = current.message;

  renderAbilityList(current);
  renderUnitPanel(current);
  updateAttackFxOverlay();
}

function renderUnitPanel(current) {
  if (!unitInfo || !unitActions) return;
  if (unitCardOverlay) unitCardOverlay.hidden = Boolean(uiState.unitPanelHidden);

  const tile = selectedTileAt(current);
  const tileUnit = selectedTileUnit(current);
  const playerUnit = selectedPlayerUnit(current);
  const enemyUnit = tileUnit && tileUnit.team === "enemy" ? tileUnit : null;

  if (enemyUnitCardOverlay) {
    enemyUnitCardOverlay.hidden = !enemyUnit || uiState.enemyPanelHidden;
  }

  if (!uiState.unitPanelHidden) {
    unitInfo.innerHTML = "";
    unitActions.innerHTML = "";

    if (!playerUnit) {
      const empty = document.createElement("div");
      empty.className = "unitInfoBody";
      empty.textContent = "自軍ユニットをタップしてください";
      unitInfo.appendChild(empty);
    } else {
      const hpPct = Math.max(0, Math.min(100, (playerUnit.hp / playerUnit.maxHp) * 100));
      const pTile = tileAt(current.map, playerUnit.x, playerUnit.y);
      const statusText =
        playerUnit.moved && playerUnit.acted
          ? "行動済"
          : playerUnit.moved
            ? "移動済・攻撃可"
            : playerUnit.acted
              ? "攻撃済・移動可"
              : "行動可能";

      unitInfo.innerHTML = `
        <div class="unitHeaderLine">
          <span class="unitInfoTitle">${escapeHtml(unitDisplayName(playerUnit))}</span>
          ${basisBadgeHtml(playerUnit.basis)}
        </div>
        ${playerUnit.role ? `<div class="unitRoleTag">${escapeHtml(playerUnit.role)}</div>` : ""}
        <div class="unitInfoBody">兵種: ${escapeHtml(jobLabel(playerUnit.job))} / 攻撃 ${playerUnit.atk} / 移動 ${playerUnit.mov} / 射程 ${playerUnit.range}</div>
        <div class="unitHpWrap">
          <div class="unitHpBar"><div class="unitHpFill${hpPct <= 35 ? " low" : ""}" style="width:${hpPct}%"></div></div>
          <div class="unitHpLabel">兵力 ${playerUnit.hp} / ${playerUnit.maxHp}（${statusText}）</div>
        </div>
        <div class="unitTerrainBox">現在地 (${playerUnit.x},${playerUnit.y}): ${escapeHtml(tileSummary(pTile))}</div>
        ${playerUnit.note ? `<div class="unitNote">${escapeHtml(playerUnit.note)}</div>` : ""}
      `;

      if (tile && (!pTile || tile.x !== pTile.x || tile.y !== pTile.y)) {
        const selTerrain = document.createElement("div");
        selTerrain.className = "unitTerrainBox";
        selTerrain.textContent = `選択マス (${tile.x},${tile.y}): ${tileSummary(tile)}`;
        unitInfo.appendChild(selTerrain);
      }

      const moveBtn = document.createElement("button");
      moveBtn.type = "button";
      moveBtn.className = isMoveMode(current) ? "primary" : "secondary";
      moveBtn.textContent = isMoveMode(current) ? "移動先を選択中" : "移動";
      moveBtn.disabled = battleTracker.resolved || playerUnit.moved || current.phase !== "player";
      moveBtn.addEventListener("click", beginMoveSelection);
      unitActions.appendChild(moveBtn);

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "secondary";
      const canUndo = Boolean(current.moveOrigin);
      cancelBtn.textContent = canUndo ? "移動を戻す" : "キャンセル";
      cancelBtn.disabled = battleTracker.resolved || !(isMoveMode(current) || canUndo);
      cancelBtn.addEventListener("click", cancelMoveSelection);
      unitActions.appendChild(cancelBtn);
    }
  }

  if (enemyUnit && enemyUnitInfo && enemyUnitActions && !uiState.enemyPanelHidden) {
    const hpPct = Math.max(0, Math.min(100, (enemyUnit.hp / enemyUnit.maxHp) * 100));
    const attackable = canPlayerAttackTarget(current, enemyUnit);
    const eTile = tileAt(current.map, enemyUnit.x, enemyUnit.y);
    enemyUnitInfo.innerHTML = `
      <div class="unitHeaderLine">
        <span class="unitInfoTitle">${escapeHtml(unitDisplayName(enemyUnit))}</span>
        ${basisBadgeHtml(enemyUnit.basis)}
      </div>
      ${enemyUnit.role ? `<div class="unitRoleTag">${escapeHtml(enemyUnit.role)}</div>` : ""}
      <div class="unitInfoBody">兵種: ${escapeHtml(jobLabel(enemyUnit.job))} / 攻撃 ${enemyUnit.atk} / 移動 ${enemyUnit.mov} / 射程 ${enemyUnit.range}</div>
      <div class="unitHpWrap">
        <div class="unitHpBar"><div class="unitHpFill" style="width:${hpPct}%"></div></div>
        <div class="unitHpLabel">兵力 ${enemyUnit.hp} / ${enemyUnit.maxHp}（${attackable ? "射程内・攻撃可" : "射程外"}）</div>
      </div>
      <div class="unitTerrainBox">地形 (${enemyUnit.x},${enemyUnit.y}): ${escapeHtml(tileSummary(eTile))}</div>
      ${enemyUnit.note ? `<div class="unitNote">${escapeHtml(enemyUnit.note)}</div>` : ""}
    `;

    enemyUnitActions.innerHTML = "";
    const atkBtn = document.createElement("button");
    atkBtn.type = "button";
    atkBtn.className = attackable ? "danger" : "secondary";
    atkBtn.textContent = attackable ? "攻撃する" : "射程外";
    atkBtn.disabled = battleTracker.resolved || !attackable;
    atkBtn.addEventListener("click", () => executePlayerAttack(enemyUnit));
    enemyUnitActions.appendChild(atkBtn);
  }
}

function renderAbilityList(current) {
  if (!abilityList) return;
  const unit = selectedPlayerUnit(current);
  const abilities = abilitiesForUnit(unit, current);
  abilityList.innerHTML = "";

  if (!unit) {
    abilityList.innerHTML = `<div class="abilityEmpty">自軍ユニットを選択</div>`;
    return;
  }
  if (abilities.length === 0) {
    abilityList.innerHTML = `<div class="abilityEmpty">${escapeHtml(unitDisplayName(unit))}：固有技なし</div>`;
    return;
  }

  for (const ability of abilities) {
    const btn = document.createElement("button");
    btn.className = "abilityButton";
    btn.type = "button";
    btn.disabled = battleTracker.resolved || unit.acted || current.phase !== "player";
    btn.innerHTML = `<strong>${escapeHtml(ability.name)}</strong><small>射程 ${ability.range} / 消費 ${ability.cost}</small>`;
    btn.addEventListener("click", () => executeAbility(ability.id));
    abilityList.appendChild(btn);
  }
}

// =========================================================
// Audio UI Sync (Pillar 4)
// =========================================================
function syncAudioUi() {
  const snd = window.srpgSound;
  if (!snd) return;
  const muted = snd.isMuted();
  const volPct = Math.round(snd.getVolume() * 100);

  if (muteToggleBtn) {
    muteToggleBtn.textContent = muted ? "🔇 無音" : "🔊 音";
    muteToggleBtn.setAttribute("aria-pressed", muted ? "true" : "false");
  }
  if (startMuteCheck) startMuteCheck.checked = muted;
  if (helpMuteCheck) helpMuteCheck.checked = muted;
  if (startVolumeRange) startVolumeRange.value = String(volPct);
  if (helpVolumeRange) helpVolumeRange.value = String(volPct);
  if (startVolumeLabel) startVolumeLabel.textContent = `${volPct}%`;
  if (helpVolumeLabel) helpVolumeLabel.textContent = `${volPct}%`;
}

// =========================================================
// Main 60fps Loop & Wiring
// =========================================================
function safeRender(now = performance.now()) {
  if (startupError) return;
  try {
    render(now);
  } catch (error) {
    showStartupError(error);
  }
}

function startRenderLoop() {
  if (visualFx.rafId) return;
  const tick = (now) => {
    visualFx.rafId = requestAnimationFrame(tick);
    safeRender(now);
  };
  visualFx.rafId = requestAnimationFrame(tick);
}

function showStartupError(error) {
  startupError = error;
  const message = error instanceof Error ? error.message : String(error);
  statusLine.textContent = `JS error: ${message}`;
  console.error("[SRPG] error:", error);
}

function toggleViewMode() {
  finishPlaybackImmediately(true);
  soundPlay("ui");
  if (bridge.useWasm && bridge.instance) {
    bridge.instance.toggle_view();
  } else {
    state.viewMode = state.viewMode === "isometric" ? "topdown" : "isometric";
    state.message = state.viewMode === "isometric" ? "斜め見下ろしへ切替" : "真上 2D へ切替";
  }
  lastHudSignature = "";
  safeRender();
}

// Wire buttons
if (startHitotoribashiBtn) {
  startHitotoribashiBtn.addEventListener("click", () => startScenario("hitotoribashi"));
}
if (startDemoBtn) {
  startDemoBtn.addEventListener("click", () => startScenario("demo"));
}
if (resultCutinSkip) {
  resultCutinSkip.addEventListener("click", showResultSummaryCard);
}
if (resultCutin) {
  resultCutin.addEventListener("click", showResultSummaryCard);
}
if (resultRetryBtn) {
  resultRetryBtn.addEventListener("click", () => {
    hideResultOverlay();
    resetCurrentScenario();
  });
}
if (resultToTitleBtn) {
  resultToTitleBtn.addEventListener("click", returnToStartScreen);
}
if (titleReturnBtn) {
  titleReturnBtn.addEventListener("click", returnToStartScreen);
}
if (helpOpenBtn) {
  helpOpenBtn.addEventListener("click", () => {
    soundPlay("ui");
    syncAudioUi();
    if (helpOverlay) helpOverlay.hidden = false;
  });
}
if (helpCloseBtn) {
  helpCloseBtn.addEventListener("click", () => {
    soundPlay("ui");
    if (helpOverlay) helpOverlay.hidden = true;
  });
}
if (helpCloseFooterBtn) {
  helpCloseFooterBtn.addEventListener("click", () => {
    soundPlay("ui");
    if (helpOverlay) helpOverlay.hidden = true;
  });
}
if (unitPanelClose) {
  unitPanelClose.addEventListener("click", () => {
    uiState.unitPanelHidden = true;
    soundPlay("ui");
    lastHudSignature = "";
    safeRender();
  });
}
if (enemyUnitPanelClose) {
  enemyUnitPanelClose.addEventListener("click", () => {
    uiState.enemyPanelHidden = true;
    soundPlay("ui");
    lastHudSignature = "";
    safeRender();
  });
}

if (muteToggleBtn) {
  muteToggleBtn.addEventListener("click", () => {
    if (!window.srpgSound) return;
    window.srpgSound.unlock();
    window.srpgSound.toggleMute();
    if (!window.srpgSound.isMuted() && uiState.started) {
      window.srpgSound.startBgm();
    }
    syncAudioUi();
    soundPlay("ui");
  });
}
for (const chk of [startMuteCheck, helpMuteCheck]) {
  if (!chk) continue;
  chk.addEventListener("change", () => {
    if (!window.srpgSound) return;
    window.srpgSound.setMuted(chk.checked);
    syncAudioUi();
  });
}
for (const rng of [startVolumeRange, helpVolumeRange]) {
  if (!rng) continue;
  rng.addEventListener("input", () => {
    if (!window.srpgSound) return;
    window.srpgSound.setVolume(Number.parseInt(rng.value, 10) / 100);
    syncAudioUi();
  });
}

if (zoomRange) {
  zoomRange.value = String(Math.round(uiState.zoom * 100));
  zoomRange.addEventListener("input", () => {
    setZoom(Number.parseInt(zoomRange.value, 10) / 100, true);
  });
}

window.addEventListener("resize", () => {
  if (!uiState.userAdjustedZoom) {
    const cur = getCurrentState();
    setZoom(computeAutoZoom(cur.map.width, cur.map.height), false);
  }
  safeRender();
});

window.addEventListener("keydown", (event) => {
  if (!eventInsideSrpg(event)) return;
  if (event.key === "Escape") {
    if (helpOverlay && !helpOverlay.hidden) {
      helpOverlay.hidden = true;
      return;
    }
    if (resultCutin && !resultCutin.hidden) {
      showResultSummaryCard();
      return;
    }
    if (getCurrentState().interactionMode === "move" || getCurrentState().moveOrigin) {
      cancelMoveSelection();
    }
  } else if (!uiState.started || battleTracker.resolved) {
    return;
  } else if (event.key === "m" || event.key === "M") {
    beginMoveSelection();
  } else if (event.key === "e" || event.key === "E") {
    runTurnEnd();
  } else if (event.key === "v" || event.key === "V") {
    toggleViewMode();
  } else if (event.key === "h" || event.key === "H" || event.key === "?") {
    if (helpOverlay) helpOverlay.hidden = !helpOverlay.hidden;
  }
});

async function connectBridge() {
  if (window.srpgGame && typeof window.srpgGame.get_render_data === "function") {
    bridge.instance = window.srpgGame;
    bridge.useWasm = true;
    return;
  }
  if (window.createSrpgGame) {
    const instance = await window.createSrpgGame();
    if (instance && typeof instance.get_render_data === "function") {
      bridge.instance = instance;
      bridge.useWasm = true;
    }
  }
}

window.addEventListener("error", (event) => {
  if (!startupError) showStartupError(event.error ?? event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  if (!startupError) showStartupError(event.reason ?? "unhandled rejection");
});

window.srpgUi = {
  toggleView: toggleViewMode,
  zoomIn: () => setZoom(uiState.zoom + ZOOM_STEP, true),
  zoomOut: () => setZoom(uiState.zoom - ZOOM_STEP, true),
  zoomReset: () => setZoom(defaultZoom(), false),
  endTurn: runTurnEnd,
  reset: resetCurrentScenario,
  startScenario,
};

syncAudioUi();
connectBridge()
  .catch((error) => {
    console.warn("[SRPG] WASM bridge unavailable, falling back to local JS state:", error);
  })
  .finally(() => {
    const cur = getCurrentState();
    setZoom(computeAutoZoom(cur.map.width, cur.map.height), false);
    startRenderLoop();
  });
