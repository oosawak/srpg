const appScriptUrl = document.currentScript?.src ?? window.location.href;
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
const autoStatusBadge = rootQuery("#autoStatusBadge");
const objectiveBanner = rootQuery("#objectiveBanner");
const playerForceLabel = rootQuery("#playerForceLabel");
const enemyForceLabel = rootQuery("#enemyForceLabel");
const recordStatusPill = rootQuery("#recordStatusPill");
const autoToggleBtn = rootQuery("#autoToggle");
const muteToggleBtn = rootQuery("#muteToggle");
const shareBattleBtn = rootQuery("#shareBattle");
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
const recordSummaryLine = rootQuery("#recordSummaryLine");
const battleLogEl = rootQuery("#battleLog");
const logCountEl = rootQuery("#logCount");
const terrainLegendList = rootQuery("#terrainLegendList");
const panelBookLink = rootQuery("#panelBookLink");

const abilityList = rootQuery("#abilityList");
const unitInfo = rootQuery("#unitInfo");
const unitActions = rootQuery("#unitActions");
const unitCardOverlay = rootQuery("#playerUnitCardOverlay") ?? rootQuery(".unitCardOverlay");
const unitFaceCard = rootQuery("#unitFaceCard");
const faceCardFaction = rootQuery("#faceCardFaction");
const faceCardBody = rootQuery("#faceCardBody");
const faceCardActions = rootQuery("#faceCardActions");
const faceCardClose = rootQuery("#faceCardClose");
const abilityCutinOverlay = rootQuery("#abilityCutinOverlay");
const abilityCutinPortrait = rootQuery("#abilityCutinPortrait");
const abilityCutinSub = rootQuery("#abilityCutinSub");
const abilityCutinName = rootQuery("#abilityCutinName");
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
const startArtWrap = rootQuery("#startArtWrap");
const startArtImg = rootQuery("#startArtImg");
const startArtEmblem = rootQuery("#startArtEmblem");
const startExtraBadge = rootQuery("#startExtraBadge");
const startEyebrow = rootQuery("#startEyebrow");
const startTitle = rootQuery("#startTitle");
const startSubtitle = rootQuery("#startSubtitle");
const startOverview = rootQuery("#startOverview");
const startBookLink = rootQuery("#startBookLink");
const startRulesList = rootQuery("#startRulesList");
const startBattleBtn = rootQuery("#startBattleBtn");
const startAutoBattleBtn = rootQuery("#startAutoBattleBtn");
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
const resRecordLabel = rootQuery("#resRecordLabel");
const resRecordValue = rootQuery("#resRecordValue");
const resPlayerLabel = rootQuery("#resPlayerLabel");
const resPlayerAlive = rootQuery("#resPlayerAlive");
const resEnemyLabel = rootQuery("#resEnemyLabel");
const resEnemyAlive = rootQuery("#resEnemyAlive");
const resRoster = rootQuery("#resRoster");
const resultBookBox = rootQuery("#resultBookBox");
const resultBookDesc = rootQuery("#resultBookDesc");
const resultBookLink = rootQuery("#resultBookLink");
const resultShareBtn = rootQuery("#resultShareBtn");
const resultRetryAutoBtn = rootQuery("#resultRetryAuto");
const resultRetryBtn = rootQuery("#resultRetry");
const resultToTitleBtn = rootQuery("#resultToTitle");

// Help Modal & Share Toast
const helpOverlay = rootQuery("#helpOverlay");
const helpCloseBtn = rootQuery("#helpClose");
const helpCloseFooterBtn = rootQuery("#helpCloseBtn");
const helpMuteCheck = rootQuery("#helpMuteCheck");
const helpVolumeRange = rootQuery("#helpVolumeRange");
const helpVolumeLabel = rootQuery("#helpVolumeLabel");
const shareToast = rootQuery("#shareToast");

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
const ZOOM_STORAGE_KEY = "srpg.battles.zoom";
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

let activeScenario = null;
let activeWasmJson = "";
let activeAiConfig = null;

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
  slug: resolveRequestedSlug(),
  started: false,
  zoom: loadSavedZoom(),
  userAdjustedZoom: false,
  unitPanelHidden: false,
  faceCardUnitId: null,
  faceCardHidden: false,
  attackFx: null,
  phaseBannerTimer: 0,
  resultCutinTimer: 0,
  shareToastTimer: 0,
  lastEnemyClickId: null,
  lastEnemyClickAt: 0,
};

const cutinState = {
  active: false,
  timerId: 0,
  onDone: null,
  isAuto: false,
};

const battleTracker = {
  resolved: false,
  outcome: null,
  recordDefendedTurns: 0,
  recordFallenTurn: null,
  recordEngagements: 0,
  lastProcessedEventSeq: -1,
  lastTurnLogged: 0,
  spawnedTurns: new Set(),
  logs: [],
};

const visualFx = {
  rafId: 0,
  floatingTexts: [],
  particles: [],
  dyingUnits: [],
  lunges: new Map(),
  hitFlashes: new Map(),
};

const playback = {
  active: false,
  mode: null,
  steps: [],
  index: 0,
  stepStartedAt: 0,
  stepDuration: 150,
  visualUnits: null,
  targetSnapshot: null,
  onComplete: null,
};

const autoState = {
  enabled: false,
  running: false,
  cancelPending: false,
  lastEndedInAuto: false,
  queue: [],
  timerId: 0,
  generation: 0,
};

let state = createEmptyState();
let startupError = null;
let attackFxTimerId = 0;

function resolveRequestedSlug() {
  const fromBody = document.body?.dataset?.scenarioSlug?.trim();
  if (fromBody) return fromBody;
  const params = new URLSearchParams(window.location.search);
  return params.get("battle")?.trim() || "hitotoribashi";
}

function createEmptyState() {
  return {
    scenario: uiState.slug,
    viewMode: "isometric",
    turnNumber: 1,
    phase: "player",
    selectedUnitId: null,
    selectedTile: null,
    interactionMode: null,
    moveOrigin: null,
    message: "シナリオ読込中...",
    map: { width: 10, height: 10, tiles: [] },
    units: [],
    turnEvents: [],
    eventSeq: 0,
  };
}

function buildLocalStateFromScenario(scenario) {
  const units = scenario.units
    .filter((u) => (u.spawnTurn ?? 1) <= 1)
    .map((u) => ({
    id: u.id,
    clan: u.clan,
    job: u.job,
    x: u.x,
    y: u.y,
    color: u.team === "enemy" ? COLORS.enemy : COLORS.player,
    team: u.team,
    mov: u.mov,
    range: u.range,
    hp: u.hp,
    maxHp: u.maxHp,
    atk: u.atk,
    moved: false,
    acted: false,
    leader: Boolean(u.leader),
    name: u.name,
    role: u.role,
    tag: u.tag,
    aiRole: u.aiRole,
    basis: u.basis,
    note: u.note,
    stats: u.stats ? { ...u.stats } : { valor: 70, intellect: 60, leadership: 65 },
  }));
  const firstPlayer =
    units.find((u) => u.team === "player" && u.leader) ??
    units.find((u) => u.team === "player") ??
    null;

  return {
    scenario: scenario.slug,
    viewMode: "isometric",
    turnNumber: 1,
    phase: "player",
    selectedUnitId: firstPlayer ? firstPlayer.id : null,
    selectedTile: firstPlayer ? { x: firstPlayer.x, y: firstPlayer.y } : null,
    interactionMode: null,
    moveOrigin: null,
    message: scenario.startMessage,
    map: {
      width: scenario.map.width,
      height: scenario.map.height,
      tiles: scenario.map.tiles.map((t) => ({ ...t })),
    },
    units,
    turnEvents: [],
    eventSeq: 0,
  };
}

function buildAiConfig(scenario) {
  const unitAiRoles = {};
  const initialPositions = {};
  for (const u of scenario.units) {
    if (u.tag) {
      unitAiRoles[u.tag] = u.aiRole || "general";
      initialPositions[u.tag] = { x: u.x, y: u.y };
    }
  }
  return {
    slug: scenario.slug,
    rules: scenario.rules,
    unitAiRoles,
    initialPositions,
  };
}

function soundPlay(name, ...args) {
  if (window.srpgSound && typeof window.srpgSound.play === "function") {
    window.srpgSound.play(name, ...args);
  }
}

function showShareToast(msg) {
  if (!shareToast) return;
  if (uiState.shareToastTimer) window.clearTimeout(uiState.shareToastTimer);
  shareToast.textContent = msg;
  shareToast.hidden = false;
  uiState.shareToastTimer = window.setTimeout(() => {
    shareToast.hidden = true;
    uiState.shareToastTimer = 0;
  }, 2400);
}

async function shareCurrentBattle() {
  soundPlay("ui");
  const title = activeScenario ? `${activeScenario.title} — 政宗の戦場 SRPG` : document.title;
  const text = activeScenario
    ? `${activeScenario.title}（${activeScenario.date}） ${activeScenario.forces}`
    : "";
  const url = `${window.location.origin}${window.location.pathname}`;
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch {
      // fall back to clipboard
    }
  }
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(url);
      showShareToast("合戦URLをコピーしました");
      return;
    } catch {
      // ignore
    }
  }
  showShareToast(`URL: ${url}`);
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
// General Portraits (assets/faces/<tag>.webp) & Crest Cards
// =========================================================
const FACE_PORTRAIT_TAGS = new Set([
  "masamune",
  "kagetsuna",
  "yoshiaki",
  "tsunamoto",
  "yoshihiro",
  "kanagami",
  "sase",
  "morikuni",
  "nobushige",
  "mototsugu",
  "yoshitsugu",
]);

// Named generals without face images -> geometric family-crest cards
const CREST_CARD_GENERALS = {
  oniwa: {
    crestName: "三つ鱗紋",
    motif: "uroko",
    bg: "#2b2110",
    accent: "#f4c661",
  },
  shigezane: {
    crestName: "九曜紋",
    motif: "kuyo",
    bg: "#10223e",
    accent: "#93c5fd",
  },
  satake: {
    crestName: "五本骨扇",
    motif: "ogi",
    bg: "#3b1218",
    accent: "#fca5a5",
  },
  masakage: {
    crestName: "竪三引両",
    motif: "mitsuhiki",
    bg: "#132642",
    accent: "#f4c661",
  },
  hidemune: {
    crestName: "宇和島九曜",
    motif: "kuyo_ring",
    bg: "#0e2438",
    accent: "#7dd3fc",
  },
  munezane: {
    crestName: "丸に割菱",
    motif: "hishi",
    bg: "#172940",
    accent: "#fde047",
  },
  kanetsugu: {
    crestName: "三つ盛亀甲",
    motif: "kikko",
    bg: "#33141d",
    accent: "#f4c661",
  },
  keiji: {
    crestName: "加賀梅鉢",
    motif: "umebachi",
    bg: "#3d1319",
    accent: "#fbbf24",
  },
  sakenobe: {
    crestName: "丸に三つ星",
    motif: "mitsuboshi",
    bg: "#12293e",
    accent: "#93c5fd",
  },
  shimura: {
    crestName: "丸に二引両",
    motif: "futahiki",
    bg: "#132a42",
    accent: "#7dd3fc",
  },
  honjo: {
    crestName: "丸に井桁",
    motif: "igeta",
    bg: "#2f1520",
    accent: "#f87171",
  },
  morichika: {
    crestName: "七つ酢漿草",
    motif: "katabami",
    bg: "#36141b",
    accent: "#fcd34d",
  },
  shigenari: {
    crestName: "隅立て四つ目",
    motif: "yotsume",
    bg: "#33141d",
    accent: "#fda4af",
  },
  susukida: {
    crestName: "違い鷹の羽",
    motif: "takanoha",
    bg: "#35171a",
    accent: "#fca5a5",
  },
};

function isNamedGeneral(unit) {
  if (!unit || !unit.tag) return false;
  return FACE_PORTRAIT_TAGS.has(unit.tag) || Object.prototype.hasOwnProperty.call(CREST_CARD_GENERALS, unit.tag);
}

function faceImageUrl(tag) {
  return new URL(`./assets/faces/${tag}.webp`, appScriptUrl).href;
}

function renderCrestSvg(motif, accent = "#f4c661") {
  const stroke = escapeHtml(accent);
  let inner = "";
  switch (motif) {
    case "uroko":
      inner = `
        <circle cx="32" cy="32" r="26" fill="none" stroke="${stroke}" stroke-width="2.6" />
        <polygon points="32,12 42,29 22,29" fill="${stroke}" />
        <polygon points="22,31 32,48 12,48" fill="${stroke}" />
        <polygon points="42,31 52,48 32,48" fill="${stroke}" />
      `;
      break;
    case "kuyo":
      inner = `
        <circle cx="32" cy="32" r="9.5" fill="${stroke}" />
        <circle cx="32" cy="13" r="4.6" fill="${stroke}" />
        <circle cx="45.4" cy="18.6" r="4.6" fill="${stroke}" />
        <circle cx="51" cy="32" r="4.6" fill="${stroke}" />
        <circle cx="45.4" cy="45.4" r="4.6" fill="${stroke}" />
        <circle cx="32" cy="51" r="4.6" fill="${stroke}" />
        <circle cx="18.6" cy="45.4" r="4.6" fill="${stroke}" />
        <circle cx="13" cy="32" r="4.6" fill="${stroke}" />
        <circle cx="18.6" cy="18.6" r="4.6" fill="${stroke}" />
      `;
      break;
    case "kuyo_ring":
      inner = `
        <circle cx="32" cy="32" r="27" fill="none" stroke="${stroke}" stroke-width="2.2" />
        <circle cx="32" cy="32" r="8" fill="${stroke}" />
        <circle cx="32" cy="15.5" r="3.8" fill="${stroke}" />
        <circle cx="43.7" cy="20.3" r="3.8" fill="${stroke}" />
        <circle cx="48.5" cy="32" r="3.8" fill="${stroke}" />
        <circle cx="43.7" cy="43.7" r="3.8" fill="${stroke}" />
        <circle cx="32" cy="48.5" r="3.8" fill="${stroke}" />
        <circle cx="20.3" cy="43.7" r="3.8" fill="${stroke}" />
        <circle cx="15.5" cy="32" r="3.8" fill="${stroke}" />
        <circle cx="20.3" cy="20.3" r="3.8" fill="${stroke}" />
      `;
      break;
    case "ogi":
      inner = `
        <circle cx="32" cy="32" r="27" fill="none" stroke="${stroke}" stroke-width="2.2" opacity="0.65" />
        <path d="M32 50 L11 24 A28 28 0 0 1 53 24 Z" fill="none" stroke="${stroke}" stroke-width="2.6" />
        <line x1="32" y1="50" x2="21" y2="17" stroke="${stroke}" stroke-width="1.6" />
        <line x1="32" y1="50" x2="32" y2="14" stroke="${stroke}" stroke-width="1.6" />
        <line x1="32" y1="50" x2="43" y2="17" stroke="${stroke}" stroke-width="1.6" />
        <circle cx="32" cy="26" r="6.2" fill="${stroke}" />
      `;
      break;
    case "mitsuhiki":
      inner = `
        <circle cx="32" cy="32" r="26" fill="none" stroke="${stroke}" stroke-width="3.2" />
        <rect x="17" y="13" width="6.5" height="38" rx="1.5" fill="${stroke}" />
        <rect x="28.75" y="10" width="6.5" height="44" rx="1.5" fill="${stroke}" />
        <rect x="40.5" y="13" width="6.5" height="38" rx="1.5" fill="${stroke}" />
      `;
      break;
    case "hishi":
      inner = `
        <circle cx="32" cy="32" r="26" fill="none" stroke="${stroke}" stroke-width="2.8" />
        <polygon points="32,12 48,32 32,52 16,32" fill="none" stroke="${stroke}" stroke-width="2.4" />
        <polygon points="32,18 42,30 32,30 22,30" fill="${stroke}" />
        <polygon points="32,46 42,34 32,34 22,34" fill="${stroke}" />
      `;
      break;
    case "kikko":
      inner = `
        <polygon points="32,10 42,16 42,28 32,34 22,28 22,16" fill="none" stroke="${stroke}" stroke-width="2.6" />
        <polygon points="21,29 31,35 31,47 21,53 11,47 11,35" fill="none" stroke="${stroke}" stroke-width="2.6" />
        <polygon points="43,29 53,35 53,47 43,53 33,47 33,35" fill="none" stroke="${stroke}" stroke-width="2.6" />
        <circle cx="32" cy="22" r="3.4" fill="${stroke}" />
        <circle cx="21" cy="41" r="3.4" fill="${stroke}" />
        <circle cx="43" cy="41" r="3.4" fill="${stroke}" />
      `;
      break;
    case "umebachi":
      inner = `
        <circle cx="32" cy="32" r="6.8" fill="${stroke}" />
        <circle cx="32" cy="15" r="7.2" fill="none" stroke="${stroke}" stroke-width="2.6" />
        <circle cx="48.2" cy="26.7" r="7.2" fill="none" stroke="${stroke}" stroke-width="2.6" />
        <circle cx="42" cy="45.8" r="7.2" fill="none" stroke="${stroke}" stroke-width="2.6" />
        <circle cx="22" cy="45.8" r="7.2" fill="none" stroke="${stroke}" stroke-width="2.6" />
        <circle cx="15.8" cy="26.7" r="7.2" fill="none" stroke="${stroke}" stroke-width="2.6" />
      `;
      break;
    case "mitsuboshi":
      inner = `
        <circle cx="32" cy="32" r="26" fill="none" stroke="${stroke}" stroke-width="2.8" />
        <circle cx="32" cy="20" r="6.8" fill="${stroke}" />
        <circle cx="21.5" cy="39" r="6.8" fill="${stroke}" />
        <circle cx="42.5" cy="39" r="6.8" fill="${stroke}" />
      `;
      break;
    case "futahiki":
      inner = `
        <circle cx="32" cy="32" r="26" fill="none" stroke="${stroke}" stroke-width="3.2" />
        <rect x="12" y="20" width="40" height="8" rx="1.5" fill="${stroke}" />
        <rect x="12" y="36" width="40" height="8" rx="1.5" fill="${stroke}" />
      `;
      break;
    case "igeta":
      inner = `
        <circle cx="32" cy="32" r="26" fill="none" stroke="${stroke}" stroke-width="2.6" />
        <line x1="22" y1="14" x2="22" y2="50" stroke="${stroke}" stroke-width="4.4" />
        <line x1="42" y1="14" x2="42" y2="50" stroke="${stroke}" stroke-width="4.4" />
        <line x1="14" y1="22" x2="50" y2="22" stroke="${stroke}" stroke-width="4.4" />
        <line x1="14" y1="42" x2="50" y2="42" stroke="${stroke}" stroke-width="4.4" />
      `;
      break;
    case "katabami":
      inner = `
        <circle cx="32" cy="32" r="26" fill="none" stroke="${stroke}" stroke-width="2.4" />
        <circle cx="32" cy="20" r="7.5" fill="${stroke}" />
        <circle cx="21.5" cy="38" r="7.5" fill="${stroke}" />
        <circle cx="42.5" cy="38" r="7.5" fill="${stroke}" />
        <circle cx="32" cy="32" r="4.2" fill="var(--crest-bg, #221)" />
      `;
      break;
    case "yotsume":
      inner = `
        <polygon points="32,10 42,20 32,30 22,20" fill="none" stroke="${stroke}" stroke-width="3.4" />
        <polygon points="44,22 54,32 44,42 34,32" fill="none" stroke="${stroke}" stroke-width="3.4" />
        <polygon points="32,34 42,44 32,54 22,44" fill="none" stroke="${stroke}" stroke-width="3.4" />
        <polygon points="20,22 30,32 20,42 10,32" fill="none" stroke="${stroke}" stroke-width="3.4" />
      `;
      break;
    case "takanoha":
      inner = `
        <circle cx="32" cy="32" r="26" fill="none" stroke="${stroke}" stroke-width="2.5" />
        <path d="M18 46 L42 14 L48 18 L24 50 Z" fill="${stroke}" />
        <path d="M46 46 L22 14 L16 18 L40 50 Z" fill="${stroke}" opacity="0.86" />
        <line x1="21" y1="48" x2="45" y2="16" stroke="var(--crest-bg, #221)" stroke-width="1.6" />
        <line x1="43" y1="48" x2="19" y2="16" stroke="var(--crest-bg, #221)" stroke-width="1.6" />
      `;
      break;
    default:
      inner = `
        <circle cx="32" cy="32" r="26" fill="none" stroke="${stroke}" stroke-width="2.6" />
        <path d="M38 16 A16 16 0 1 0 38 48 A12 12 0 1 1 38 16 Z" fill="${stroke}" />
      `;
      break;
  }
  return `<svg class="crestSvg" viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;
}

function renderCrestCardHtml(unit, sizeClass = "card") {
  const isEnemy = unit.team === "enemy";
  const meta = CREST_CARD_GENERALS[unit.tag] || {
    crestName: isEnemy ? "軍紋" : "伊達紋",
    motif: "default",
    bg: isEnemy ? "#361218" : "#12243e",
    accent: isEnemy ? "#fca5a5" : "#f4c661",
  };
  return `
    <div class="portraitBox portrait-crest ${sizeClass}" style="--crest-bg:${meta.bg};--crest-accent:${meta.accent}" title="${escapeHtml(meta.crestName)}">
      ${renderCrestSvg(meta.motif, meta.accent)}
      <span class="crestCardName">${escapeHtml(unitDisplayName(unit))}</span>
    </div>
  `;
}

function renderPortraitHtml(unit, sizeClass = "card") {
  if (!isNamedGeneral(unit)) return "";
  if (FACE_PORTRAIT_TAGS.has(unit.tag)) {
    return `
      <div class="portraitBox portrait-photo ${sizeClass}">
        <img
          src="${escapeHtml(faceImageUrl(unit.tag))}"
          alt="${escapeHtml(unitDisplayName(unit))}"
          loading="eager"
          decoding="async"
          data-fallback-unit-id="${unit.id}"
        />
      </div>
    `;
  }
  return renderCrestCardHtml(unit, sizeClass);
}

function attachPortraitFallbacks(container, unit, sizeClass = "card") {
  if (!container || !unit) return;
  const img = container.querySelector("img[data-fallback-unit-id]");
  if (!img) return;
  img.addEventListener(
    "error",
    () => {
      const box = img.closest(".portraitBox");
      if (!box) return;
      const tmp = document.createElement("div");
      tmp.innerHTML = renderCrestCardHtml(unit, sizeClass);
      if (tmp.firstElementChild) {
        box.replaceWith(tmp.firstElementChild);
      }
    },
    { once: true }
  );
}

// =========================================================
// Ability Cut-in Overlay (skippable on click/tap/Esc)
// =========================================================
function dismissAbilityCutin(runCallback = true) {
  if (cutinState.timerId) {
    window.clearTimeout(cutinState.timerId);
    cutinState.timerId = 0;
  }
  const cb = cutinState.onDone;
  cutinState.active = false;
  cutinState.onDone = null;
  cutinState.isAuto = false;
  if (abilityCutinOverlay) {
    abilityCutinOverlay.hidden = true;
    abilityCutinOverlay.classList.remove("is-auto", "is-enemy");
  }
  if (runCallback && typeof cb === "function") {
    cb();
  }
}

function showAbilityCutin(actor, abilityName, options = {}) {
  const { isAuto = false, onDone = null } = options;
  if (!abilityCutinOverlay || !actor || !isNamedGeneral(actor)) {
    if (typeof onDone === "function") onDone();
    return false;
  }

  dismissAbilityCutin(false);
  cutinState.active = true;
  cutinState.isAuto = Boolean(isAuto);
  cutinState.onDone = isAuto ? null : onDone;

  const isEnemy = actor.team === "enemy";
  abilityCutinOverlay.classList.toggle("is-auto", Boolean(isAuto));
  abilityCutinOverlay.classList.toggle("is-enemy", isEnemy);

  if (abilityCutinPortrait) {
    abilityCutinPortrait.innerHTML = renderPortraitHtml(actor, "cutin");
    attachPortraitFallbacks(abilityCutinPortrait, actor, "cutin");
  }
  if (abilityCutinSub) {
    const parts = [actor.role, unitDisplayName(actor)].filter(Boolean);
    abilityCutinSub.textContent = parts.join(" ／ ");
  }
  if (abilityCutinName) {
    abilityCutinName.textContent = `「${abilityName || "特技"}」`;
  }

  // Re-trigger slide animation cleanly
  abilityCutinOverlay.hidden = false;
  const band = abilityCutinOverlay.querySelector(".abilityCutinBand");
  if (band) {
    band.style.animation = "none";
    void band.offsetWidth;
    band.style.animation = "";
  }

  soundPlay("cutin");

  // Auto mode: short ~950ms banner that does NOT block battle flow
  if (isAuto) {
    cutinState.timerId = window.setTimeout(() => {
      dismissAbilityCutin(false);
    }, 950);
    if (typeof onDone === "function") onDone();
    return true;
  }

  // Manual mode: 1350ms dramatic cut-in, click/tap/Esc skips immediately
  cutinState.timerId = window.setTimeout(() => {
    dismissAbilityCutin(true);
  }, 1350);
  return true;
}

// =========================================================
// Populate Static & Start-Screen UI from Parsed Markdown
// =========================================================
function swatchClassForLegend(entry) {
  if (entry.bridge) return "bridge";
  if (entry.escape) return "escape";
  switch (entry.visual) {
    case "snow": return "snow";
    case "snow_road": return "snow-road";
    case "snow_hill": return "snow-hill";
    case "frozen_rice": return "frozen-rice";
    case "stream": return "stream";
    case "lake": return "lake";
    case "bandai": return "bandai";
    case "marsh": return "marsh";
    case "moat": return "moat";
    case "citadel": return "citadel";
    case "fort": return "fort";
    case "gate": return "gate";
    case "slope": return "slope";
    case "urban": return "urban";
    case "palisade": return "palisade";
    case "earthwork": return "earthwork";
    default: break;
  }
  switch (entry.terrain) {
    case "Water": return "river";
    case "Castle": return "castle";
    case "Town": return "town";
    case "RiceField": return "rice";
    case "Terrace": return "terrace";
    case "Road": return "road";
    case "Mountain": return "mountain";
    default: return "plain";
  }
}

function populateScenarioUi(scenario) {
  document.title = `${scenario.title} — 政宗の戦場 SRPG`;

  if (startExtraBadge) {
    if (scenario.extra) {
      startExtraBadge.textContent = scenario.extra;
      startExtraBadge.hidden = false;
    } else {
      startExtraBadge.textContent = "";
      startExtraBadge.hidden = true;
    }
  }

  if (startEyebrow) {
    startEyebrow.textContent = [scenario.date, scenario.place].filter(Boolean).join(" ");
  }
  if (startTitle) startTitle.textContent = scenario.title;
  if (startSubtitle) startSubtitle.textContent = scenario.forces || scenario.subtitle;

  if (startArtWrap) {
    startArtWrap.className = "startArtWrap";
    if (scenario.keyart) {
      startArtWrap.classList.add("has-image");
      if (scenario.theme === "mist") {
        startArtWrap.classList.add("has-mist");
      }
      if (startArtImg) {
        const resolvedArt = new URL(scenario.keyart, new URL(`./scenarios/${scenario.slug}.md`, appScriptUrl));
        startArtImg.src = resolvedArt.href;
        startArtImg.alt = `${scenario.title} キーアート`;
        startArtImg.hidden = false;
      }
    } else {
      startArtWrap.classList.add("theme-banner", `theme-${scenario.theme || "autumn"}`);
      if (startArtImg) startArtImg.hidden = true;
      if (startArtEmblem) {
        startArtEmblem.textContent = scenario.year ? String(scenario.year) : scenario.title.slice(0, 2);
      }
    }
  }

  if (startOverview) {
    startOverview.textContent = scenario.overview;
  }

  if (startBookLink) {
    if (scenario.bookUrl) {
      startBookLink.href = scenario.bookUrl;
      startBookLink.textContent = `📖 本${scenario.bookChapter || "『伊達の国』"}を読む ↗`;
      startBookLink.hidden = false;
    } else {
      startBookLink.hidden = true;
    }
  }

  if (panelBookLink) {
    if (scenario.bookUrl) {
      panelBookLink.href = scenario.bookUrl;
      panelBookLink.textContent = `${scenario.bookChapter || "『伊達の国』"}を読む ↗`;
      panelBookLink.hidden = false;
    } else {
      panelBookLink.hidden = true;
    }
  }

  if (resultBookBox && resultBookLink && resultBookDesc) {
    if (scenario.bookUrl) {
      resultBookBox.hidden = false;
      resultBookDesc.textContent = `この合戦の背景と史実の歩みは本${scenario.bookChapter || "『伊達の国』"}で読めます。`;
      resultBookLink.href = scenario.bookUrl;
      resultBookLink.textContent = `📖 本${scenario.bookChapter || "『伊達の国』"}へ ↗`;
    } else {
      resultBookBox.hidden = true;
    }
  }

  if (startRulesList) {
    const items = [];
    if (scenario.victoryText) {
      items.push(`<li><strong>勝利:</strong> ${escapeHtml(scenario.victoryText)}</li>`);
    }
    if (scenario.defeatText) {
      items.push(`<li><strong>敗北:</strong> ${escapeHtml(scenario.defeatText)}</li>`);
    }
    if (scenario.rules.recordUnitTag && scenario.rules.recordLabel) {
      const recUnit = scenario.units.find((u) => u.tag === scenario.rules.recordUnitTag);
      const recName = recUnit ? recUnit.name : scenario.rules.recordLabel;
      items.push(
        `<li><strong>${escapeHtml(scenario.rules.recordLabel)}:</strong> ${escapeHtml(recName)}が持ちこたえたターン数を結果に記録</li>`
      );
    }
    const reinfUnits = scenario.units.filter((u) => (u.spawnTurn ?? 1) > 1);
    if (reinfUnits.length > 0) {
      const turns = [...new Set(reinfUnits.map((u) => u.spawnTurn))].sort((a, b) => a - b);
      const turnText = turns.map((t) => `第${t}ターン`).join("・");
      items.push(
        `<li><strong>増援:</strong> ${escapeHtml(turnText)}の自軍フェイズ開始時に援軍（${reinfUnits.length}部隊）が到着</li>`
      );
    }
    items.push(
      `<li><strong>基本操作:</strong> 味方をタップ→「移動」で青マスへ移動／赤枠の敵をタップして「攻撃」／「ターン終了」で${escapeHtml(scenario.enemyArmy)}の行動</li>`
    );
    startRulesList.innerHTML = items.join("");
  }

  if (startBattleBtn) {
    startBattleBtn.textContent = `出陣 — ${scenario.title}`;
  }

  // Build concise terrain legend from the scenario's Markdown legend
  if (terrainLegendList) {
    const seen = new Set();
    const legendItems = [];
    for (const entry of scenario.legend) {
      const cls = swatchClassForLegend(entry);
      const key = `${cls}:${entry.terrain}:${entry.visual || ""}:${entry.bridge}:${entry.escape}`;
      if (seen.has(key)) continue;
      seen.add(key);
      legendItems.push(
        `<li><span class="swatch ${cls}"></span>${escapeHtml(entry.label)}</li>`
      );
    }
    terrainLegendList.innerHTML = legendItems.join("");
  }
}

// =========================================================
// Battle Log & Tracker
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

function resetBattleTracker() {
  const rules = activeScenario?.rules;
  battleTracker.resolved = false;
  battleTracker.outcome = null;
  battleTracker.recordDefendedTurns = rules?.recordUnitTag ? 1 : 0;
  battleTracker.recordFallenTurn = null;
  battleTracker.recordEngagements = 0;
  battleTracker.lastProcessedEventSeq = -1;
  battleTracker.lastTurnLogged = 1;
  battleTracker.spawnedTurns = new Set();
  battleTracker.logs = [];
  hideResultOverlay();

  if (rules?.openingLogs && rules.openingLogs.length > 0) {
    rules.openingLogs.forEach((line, idx) => {
      addBattleLog(line, idx < rules.openingLogs.length - 1 ? "highlight" : "system", 1);
    });
  } else if (activeScenario) {
    addBattleLog(`${activeScenario.date} ${activeScenario.title}が開戦。`, "highlight", 1);
    if (activeScenario.victoryText) {
      addBattleLog(`目標：${activeScenario.victoryText}`, "system", 1);
    }
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
// Generic Scenario Outcome Evaluation (driven by Markdown rules)
// =========================================================
function evaluateScenarioOutcome(current) {
  if (battleTracker.resolved || !uiState.started || !activeScenario) return null;

  const rules = activeScenario.rules;
  const playersAlive = currentPlayerUnits(current.units);
  const enemiesAlive = currentEnemyUnits(current.units);
  const maxTurnCap = rules.surviveTurns > 0 ? rules.surviveTurns : rules.maxTurns || 12;

  // Optional rear-guard / defense unit record tracking
  if (rules.recordUnitTag) {
    const recUnit = current.units.find((u) => u.tag === rules.recordUnitTag);
    if (recUnit) {
      if (recUnit.hp > 0) {
        battleTracker.recordDefendedTurns = Math.max(
          battleTracker.recordDefendedTurns,
          Math.min(current.turnNumber, maxTurnCap)
        );
      } else if (battleTracker.recordFallenTurn == null) {
        battleTracker.recordFallenTurn = current.turnNumber;
        battleTracker.recordDefendedTurns = Math.max(battleTracker.recordDefendedTurns, current.turnNumber);
      }
    }
  }

  // Defeat: designated player leader fallen, or all player units lost
  const playerLeader = rules.defeatPlayerLeaderTag
    ? current.units.find((u) => u.tag === rules.defeatPlayerLeaderTag)
    : current.units.find((u) => u.team === "player" && u.leader);

  if ((playerLeader && playerLeader.hp <= 0) || playersAlive.length === 0 || current.phase === "defeat") {
    return {
      victory: false,
      reason: "defeat",
      ...rules.outcomes.defeat,
    };
  }

  // Defeat 2: Enemy captured designated defense objective (e.g., 本丸陥落)
  if (Array.isArray(rules.enemyCaptureTiles) && rules.enemyCaptureTiles.length > 0) {
    const enemyCaptured = enemiesAlive.some((e) =>
      rules.enemyCaptureTiles.some((pt) => pt.x === e.x && pt.y === e.y)
    );
    if (enemyCaptured) {
      return {
        victory: false,
        reason: "captured",
        ...(rules.outcomes.captured || rules.outcomes.defeat),
      };
    }
  }

  // Victory 1: Escape unit reached an escape tile
  if (rules.escapeUnitTag) {
    const escUnit = current.units.find((u) => u.tag === rules.escapeUnitTag && u.hp > 0);
    if (escUnit) {
      const tile = tileAt(current.map, escUnit.x, escUnit.y);
      if (tile && tile.escape) {
        return {
          victory: true,
          reason: "escape",
          ...rules.outcomes.escape,
        };
      }
    }
  }

  // Victory 1b: Player captured designated objective tile (e.g., 本丸・真田丸制圧)
  if (Array.isArray(rules.playerCaptureTiles) && rules.playerCaptureTiles.length > 0) {
    const playerCaptured = playersAlive.some((p) =>
      rules.playerCaptureTiles.some((pt) => pt.x === p.x && pt.y === p.y)
    );
    if (playerCaptured) {
      return {
        victory: true,
        reason: "capture",
        ...(rules.outcomes.capture || rules.outcomes.leaderDefeated),
      };
    }
  }

  // Victory 2: Survived required turns
  if (rules.surviveTurns > 0 && current.turnNumber > rules.surviveTurns) {
    return {
      victory: true,
      reason: "survive",
      ...rules.outcomes.survive,
    };
  }

  // Victory 3: Enemy leader defeated
  if (rules.defeatEnemyLeader) {
    const enemyLeader = current.units.find((u) => u.team === "enemy" && u.leader);
    if (enemyLeader && enemyLeader.hp <= 0) {
      return {
        victory: true,
        reason: "leader_defeated",
        ...rules.outcomes.leaderDefeated,
      };
    }
  }

  // Victory 4: All enemies routed
  if (rules.routVictory && (enemiesAlive.length === 0 || current.phase === "victory")) {
    return {
      victory: true,
      reason: "rout",
      ...rules.outcomes.rout,
    };
  }

  // Turn cap fallback (prevents infinite stall)
  if (rules.maxTurns > 0 && current.turnNumber > rules.maxTurns) {
    if (rules.turnLimitOutcome === "victory") {
      return {
        victory: true,
        reason: "survive",
        ...rules.outcomes.survive,
      };
    }
    return {
      victory: false,
      reason: "timeout",
      ...rules.outcomes.timeout,
    };
  }

  return null;
}

function triggerResolution(outcome, current) {
  if (battleTracker.resolved) return;
  battleTracker.resolved = true;
  battleTracker.outcome = outcome;

  const endedInAuto = autoState.enabled || autoState.cancelPending;
  autoState.lastEndedInAuto = endedInAuto;
  stopAutoMode();
  dismissAbilityCutin(false);

  const rules = activeScenario?.rules;
  const maxTurnCap = rules?.surviveTurns > 0 ? rules.surviveTurns : rules?.maxTurns || current.turnNumber;

  if (outcome.reason === "survive" && rules?.surviveLog) {
    addBattleLog(rules.surviveLog, "highlight", Math.min(current.turnNumber, maxTurnCap));
  }
  addBattleLog(`【決着】${outcome.title}`, "highlight", Math.min(current.turnNumber, maxTurnCap));
  soundPlay(outcome.victory ? "victory" : "defeatEnd");

  if (!resultOverlay) return;
  resultOverlay.hidden = false;

  if (resultRetryAutoBtn && resultRetryBtn) {
    if (endedInAuto) {
      resultRetryAutoBtn.className = "primary";
      resultRetryBtn.className = "secondary";
    } else {
      resultRetryAutoBtn.className = "accent";
      resultRetryBtn.className = "primary";
    }
  }

  const elapsedTurns =
    outcome.reason === "survive" || outcome.reason === "timeout"
      ? maxTurnCap
      : current.turnNumber;
  const players = current.units.filter((u) => u.team === "player");
  const enemies = current.units.filter((u) => u.team === "enemy");
  const playerAliveCount = players.filter((u) => u.hp > 0).length;
  const enemyAliveCount = enemies.filter((u) => u.hp > 0).length;

  if (resultEyebrow) {
    resultEyebrow.textContent = `${activeScenario?.title || "合戦"} — 結果`;
  }
  if (resultTitle) resultTitle.textContent = outcome.title;
  if (resultLead) resultLead.textContent = outcome.lead;
  if (resTurns) resTurns.textContent = `${elapsedTurns} ターン`;

  if (resRecordLabel && resRecordValue) {
    if (rules?.recordUnitTag) {
      resRecordLabel.textContent = rules.recordLabel || "防衛記録";
      const recUnit = current.units.find((u) => u.tag === rules.recordUnitTag);
      const statusTxt =
        recUnit && recUnit.hp > 0
          ? "生還"
          : `T${battleTracker.recordFallenTurn ?? elapsedTurns} 討死`;
      resRecordValue.textContent = `${battleTracker.recordDefendedTurns} ターン防衛（${statusTxt}）`;
    } else {
      resRecordLabel.textContent = "決着要因";
      const reasonMap = {
        escape: `${rules?.escapeDestName || "目標"}へ到達`,
        capture: `${rules?.captureLabel || "本丸"}制圧`,
        captured: `${rules?.captureLabel || "本丸"}陥落`,
        survive: "規定ターン防衛",
        leader_defeated: "敵大将撃破",
        rout: "敵軍撃退",
        defeat: "自軍敗北",
        timeout: "日暮れ終了",
      };
      resRecordValue.textContent = reasonMap[outcome.reason] || "決着";
    }
  }

  if (resPlayerLabel) resPlayerLabel.textContent = `${activeScenario?.playerArmy || "自軍"} 残存`;
  if (resEnemyLabel) resEnemyLabel.textContent = `${activeScenario?.enemyArmy || "敵軍"} 残存`;
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
        <h3>${escapeHtml(activeScenario?.playerArmy || "自軍")}</h3>
        <ul>${renderList(players)}</ul>
      </div>
      <div class="resRosterCol">
        <h3>${escapeHtml(activeScenario?.enemyArmy || "敵軍")}</h3>
        <ul>${renderList(enemies)}</ul>
      </div>
    `;
  }

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
// Visual Effects & Step-by-step Playback
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
  const recTag = activeScenario?.rules?.recordUnitTag || "";

  if (ev.type === "attack") {
    const attacker = findUnit(ev.attacker_id);
    const target = findUnit(ev.target_id);
    if (!attacker || !target) return;
    const aName = unitDisplayName(attacker);
    const tName = unitDisplayName(target);

    if (recTag && (attacker.tag === recTag || target.tag === recTag)) {
      battleTracker.recordEngagements += 1;
    }

    if (ev.killed) {
      if (recTag && target.tag === recTag) {
        battleTracker.recordFallenTurn = turn;
        battleTracker.recordDefendedTurns = Math.max(battleTracker.recordDefendedTurns, turn);
        addBattleLog(`${tName}、壮絶な討ち死に！（${aName}の攻撃で ${ev.damage} ダメージ）`, "highlight", turn);
      } else if (target.leader) {
        addBattleLog(`${tName}が ${aName} に討たれた！（${ev.damage} ダメージ）`, "highlight", turn);
      } else if (target.team === "enemy") {
        addBattleLog(`${aName} が ${tName} を撃破！（${ev.damage} ダメージ）`, "highlight", turn);
      } else {
        addBattleLog(`${aName} の攻撃で ${tName} が壊滅！（${ev.damage} ダメージ）`, "damage", turn);
      }
      return;
    }

    if (target.leader && target.team === "player") {
      const crisis = ev.target_hp <= target.maxHp * 0.55 ? "【大将危機】" : "【本隊被弾】";
      addBattleLog(`${crisis}${aName} が ${tName} に ${ev.damage} ダメージ（残HP ${ev.target_hp}）`, "highlight", turn);
    } else if (recTag && (target.tag === recTag || attacker.tag === recTag)) {
      const prefix = target.tag === recTag ? "【殿・奮戦】" : "【殿・反撃】";
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
    playback.stepDuration = playback.mode === "enemy" || autoState.enabled ? 135 : 170;
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
// Zoom & Coordinate Helpers
// =========================================================
function terrainColor(tile) {
  if (tile.bridge) {
    if (tile.visual === "snow_road") return "#9d744d";
    return "#b07b47";
  }
  switch (tile.visual) {
    case "snow": return "#dce7f2";
    case "snow_road": return "#b8c5d1";
    case "snow_hill": return tile.terrain === "Mountain" ? "#8ca2b8" : "#b8cadc";
    case "frozen_rice": return "#8ea8b6";
    case "stream": return "#286599";
    case "lake": return "#15578a";
    case "bandai":
      if (tile.terrain === "Mountain") return "#4a5d4f";
      return tile.height >= 3 ? "#6b7958" : "#788557";
    case "marsh": return "#4d8568";
    case "moat": return "#1b5978";
    case "citadel": return tile.height >= 4 ? "#99a3b3" : "#8893a2";
    case "fort": return "#807a6e";
    case "gate": return "#8f7a5e";
    case "slope": return "#ccb587";
    case "urban": return "#735c50";
    default: break;
  }
  const winter = activeScenario?.theme === "winter";
  switch (tile.terrain) {
    case "Water": return winter ? "#2a6099" : "#236eb8";
    case "Castle": return "#8893a2";
    case "Town": return "#8c6148";
    case "RiceField": return winter ? "#6e8e82" : "#5b9a68";
    case "Terrace": return winter ? "#7f857b" : "#8a7e4a";
    case "Road": return winter ? "#b5aea0" : "#c2ab79";
    case "Mountain": return winter ? "#5f6f78" : "#596a54";
    default: return winter ? "#74868f" : "#466c44";
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
  if (tile.bridge) return activeScenario?.rules?.bridgeName || "橋";
  if (tile.visual && tile.label) return tile.label.replace(/（.*?）/g, "").trim() || tile.label;
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
  if (tile.bridge) return `${activeScenario?.rules?.bridgeName || "橋"} / 移動コスト 1 / 渡河可能`;
  if (tile.terrain === "Water") return `${terrainLabel(tile)} / 進入不可`;

  const traits = [];
  if (tile.escape) {
    const dest = activeScenario?.rules?.escapeDestName;
    const badge = activeScenario?.rules?.escapeBadge || "離脱";
    traits.push(dest ? `${badge}マス（${dest}）` : `${badge}マス`);
  }
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
  const mapW = snapshot?.map?.width ?? 10;
  const scenarioTiles = activeScenario?.map?.tiles ?? null;
  const scenarioUnits = activeScenario?.units ?? [];
  return {
    scenario: snapshot?.scenario ?? uiState.slug,
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
      width: mapW,
      height: snapshot?.map?.height ?? 10,
      tiles: tiles.map((tile) => {
        const tx = tile.x ?? 0;
        const ty = tile.y ?? 0;
        const scTile = scenarioTiles ? scenarioTiles[ty * mapW + tx] : null;
        return {
          x: tx,
          y: ty,
          terrain: tile.terrain ?? "Plain",
          height: tile.height ?? 0,
          cover: Boolean(tile.cover),
          water: Boolean(tile.water),
          bridge: Boolean(tile.bridge),
          escape: Boolean(tile.escape),
          visual: scTile?.visual || "",
          label: scTile?.label || "",
        };
      }),
    },
    units: units.map((unit) => {
      const team = unit.team ?? (unit.clan === 2 ? "enemy" : "player");
      const scUnit =
        scenarioUnits.find((su) => (unit.tag && su.tag === unit.tag) || su.id === unit.id) ?? null;
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
        leader: Boolean(unit.leader),
        name: unit.name ?? "",
        role: unit.role ?? "",
        tag: unit.tag ?? "",
        aiRole: activeAiConfig?.unitAiRoles?.[unit.tag] ?? "general",
        basis: unit.basis ?? "",
        note: unit.note ?? "",
        stats: scUnit?.stats
          ? { ...scUnit.stats }
          : { valor: 70, intellect: 60, leadership: 65 },
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

function executePlayerAttack(target, onComplete = null) {
  if (battleTracker.resolved) return false;
  finishPlaybackImmediately(true);
  const before = snapshotState(getCurrentState());
  const attacker = selectedPlayerUnit(before);
  if (!attacker || !target || !canPlayerAttackTarget(before, target)) {
    soundPlay("ui");
    if (typeof onComplete === "function") onComplete();
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

  const handleDone = () => {
    checkAndHandleOutcome();
    safeRender();
    if (typeof onComplete === "function") onComplete();
  };

  if (bridge.useWasm && bridge.instance) {
    bridge.instance.click_tile(target.x, target.y);
    bridge.instance.attack_selected();
    const after = snapshotState(getCurrentState());
    startEventPlayback(before, after, after.turnEvents, "player", handleDone);
    safeRender();
    return true;
  }

  const localAttacker = state.units.find((u) => u.id === attacker.id);
  const localTarget = state.units.find((u) => u.id === target.id);
  if (!localAttacker || !localTarget) {
    if (typeof onComplete === "function") onComplete();
    return false;
  }
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
  startEventPlayback(before, after, state.turnEvents, "player", handleDone);
  safeRender();
  return true;
}

function executeAbility(abilityId, onComplete = null) {
  if (battleTracker.resolved) return;
  finishPlaybackImmediately(true);
  const before = snapshotState(getCurrentState());
  const actor = selectedPlayerUnit(before);
  if (!actor || actor.acted || before.phase !== "player") {
    soundPlay("ui");
    if (typeof onComplete === "function") onComplete();
    return;
  }

  const handleDone = () => {
    checkAndHandleOutcome();
    safeRender();
    if (typeof onComplete === "function") onComplete();
  };

  const resolveAbilityName = (events) => {
    const abEv = (events ?? []).find((e) => e.type === "ability" && e.name);
    if (abEv) return abEv.name;
    const fromList = abilitiesForUnit(actor, before).find((a) => a.id === (abilityId | 0));
    if (fromList && fromList.name) return fromList.name;
    return "特技";
  };

  const runPlaybackWithCutin = (afterSnap, events) => {
    const beginPlay = () => {
      startEventPlayback(before, afterSnap, events, "player", handleDone);
      safeRender();
    };
    if (isNamedGeneral(actor)) {
      showAbilityCutin(actor, resolveAbilityName(events), {
        isAuto: autoState.enabled,
        onDone: beginPlay,
      });
    } else {
      beginPlay();
    }
  };

  if (bridge.useWasm && bridge.instance && typeof bridge.instance.use_ability === "function") {
    bridge.instance.use_ability(abilityId | 0);
    const after = snapshotState(getCurrentState());
    if (after.turnEvents && after.turnEvents.length > 0) {
      runPlaybackWithCutin(after, after.turnEvents);
    } else {
      addBattleLog(after.message, "system", after.turnNumber);
      soundPlay("ui");
      if (typeof onComplete === "function") onComplete();
    }
    safeRender();
    return;
  }

  const localActor = state.units.find((u) => u.id === actor.id);
  if (!localActor) {
    if (typeof onComplete === "function") onComplete();
    return;
  }
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
  } else if (localActor.job === "Teppo") {
    const targets = state.units.filter((u) => u.team === "enemy" && u.hp > 0 && Math.abs(u.x - localActor.x) + Math.abs(u.y - localActor.y) <= 5);
    targets.sort((a, b) => (Math.abs(a.x - localActor.x) + Math.abs(a.y - localActor.y)) - (Math.abs(b.x - localActor.x) + Math.abs(b.y - localActor.y)));
    if (targets[0]) {
      const dmg = localActor.atk + 8;
      targets[0].hp = Math.max(0, targets[0].hp - dmg);
      localActor.acted = true;
      state.message = `${unitDisplayName(localActor)} の火縄射撃で ${dmg} ダメージ`;
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
    runPlaybackWithCutin(after, state.turnEvents);
  } else {
    soundPlay("ui");
    if (typeof onComplete === "function") onComplete();
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

function findNearestOpenTileLocal(startX, startY, current) {
  const w = current.map.width;
  const h = current.map.height;
  const sx = Math.max(0, Math.min(w - 1, startX));
  const sy = Math.max(0, Math.min(h - 1, startY));
  const queue = [{ x: sx, y: sy }];
  const visited = new Set([`${sx},${sy}`]);
  const dirs = [
    [0, -1],
    [-1, 0],
    [0, 1],
    [1, 0],
  ];
  while (queue.length > 0) {
    const cur = queue.shift();
    const tile = tileAt(current.map, cur.x, cur.y);
    if (tile && tile.terrain !== "Water" && !unitAt(current.units, cur.x, cur.y)) {
      return cur;
    }
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const key = `${nx},${ny}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return null;
}

function spawnReinforcementsForTurn(turn) {
  if (!activeScenario || !Array.isArray(activeScenario.units)) return false;
  if (battleTracker.spawnedTurns.has(turn)) return false;

  const wave = activeScenario.units.filter((u) => (u.spawnTurn ?? 1) === turn);
  if (wave.length === 0) return false;
  battleTracker.spawnedTurns.add(turn);

  let spawnedUnits = [];
  if (
    bridge.useWasm &&
    bridge.instance &&
    typeof bridge.instance.spawn_units_json === "function" &&
    window.srpgScenarioParser?.toWasmReinforcementsJson
  ) {
    const json = window.srpgScenarioParser.toWasmReinforcementsJson(activeScenario, turn);
    const count = bridge.instance.spawn_units_json(json);
    if (count > 0) {
      const updated = getCurrentState();
      const waveIds = new Set(wave.map((u) => u.id));
      spawnedUnits = updated.units.filter((u) => waveIds.has(u.id));
    }
  } else {
    for (const u of wave) {
      if (state.units.some((existing) => existing.id === u.id)) continue;
      const spot = findNearestOpenTileLocal(u.x, u.y, state);
      if (!spot) continue;
      const created = {
        id: u.id,
        clan: u.clan,
        job: u.job,
        x: spot.x,
        y: spot.y,
        color: u.team === "enemy" ? COLORS.enemy : COLORS.player,
        team: u.team,
        mov: u.mov,
        range: u.range,
        hp: u.hp,
        maxHp: u.maxHp,
        atk: u.atk,
        moved: false,
        acted: false,
        leader: Boolean(u.leader),
        name: u.name,
        role: u.role,
        tag: u.tag,
        aiRole: u.aiRole,
        basis: u.basis,
        note: u.note,
        stats: u.stats ? { ...u.stats } : { valor: 70, intellect: 60, leadership: 65 },
      };
      state.units.push(created);
      spawnedUnits.push(created);
    }
  }

  if (spawnedUnits.length === 0) return false;

  const reinfLogs = activeScenario.rules?.reinforcementLogs || {};
  const customLog = reinfLogs[String(turn)] || reinfLogs["*"] || "";
  const leadUnit = spawnedUnits[0];
  const logText =
    customLog ||
    `増援到着！ ${unitDisplayName(leadUnit)}${spawnedUnits.length > 1 ? `ほか${spawnedUnits.length}部隊` : ""}が戦場へ加わった。`;
  addBattleLog(logText, "highlight", turn);

  const cur = getCurrentState();
  for (const su of spawnedUnits) {
    const t = tileAt(cur.map, su.x, su.y);
    if (t) {
      const pos = tileToScreen(t, cur);
      const cx = pos.x + pos.size * 0.5;
      const cy = pos.y + (cur.viewMode === "topdown" ? pos.size * 0.3 : pos.size * 0.1);
      spawnParticles(cx, cy, "#f4c661", 14);
      spawnFloatingText(cx, cy - 16, "援軍到着！", "#fef08a", 1.05);
    }
  }

  showPhaseBanner(`第${turn}ターン — 援軍到着！`, logText, false, 1550);
  soundPlay("cutin");
  lastHudSignature = "";
  return true;
}

function runTurnEnd() {
  if (battleTracker.resolved) return;
  if (playback.active) {
    finishPlaybackImmediately(true);
  }
  const before = snapshotState(getCurrentState());
  if (before.phase !== "player") return;

  const enemyArmy = activeScenario?.enemyArmy || "敵軍";
  const playerArmy = activeScenario?.playerArmy || "自軍";
  showPhaseBanner(`敵フェイズ — ${enemyArmy}`, `第${before.turnNumber}ターン`, true, 950);
  soundPlay("turnStart", false);
  addBattleLog(`第${before.turnNumber}ターン ${enemyArmy}フェイズ開始`, "system", before.turnNumber);

  if (bridge.useWasm && bridge.instance) {
    bridge.instance.end_turn();
  } else {
    runLocalEnemyTurn();
  }

  const after = snapshotState(getCurrentState());
  const onEnemyDone = () => {
    if (checkAndHandleOutcome()) {
      safeRender();
      return;
    }
    const rules = activeScenario?.rules;
    const sub =
      rules?.surviveTurns > 0
        ? `残り ${Math.max(0, rules.surviveTurns - after.turnNumber + 1)} ターンで防衛達成`
        : rules?.maxTurns > 0
          ? `第${after.turnNumber} / ${rules.maxTurns} ターン`
          : `${playerArmy}フェイズ`;
    addBattleLog(`敵フェイズ終了。第${after.turnNumber}ターン ${playerArmy}の行動。`, "system", after.turnNumber);
    const spawnedReinforcements = spawnReinforcementsForTurn(after.turnNumber);
    if (!spawnedReinforcements) {
      showPhaseBanner(`第${after.turnNumber}ターン — ${playerArmy}`, sub, false, 1100);
      soundPlay("turnStart", true);
    }
    if (autoState.cancelPending) {
      autoState.cancelPending = false;
      addBattleLog("手動操作へ切り替わりました。", "system", after.turnNumber);
      lastHudSignature = "";
    } else if (autoState.enabled && uiState.started && !battleTracker.resolved) {
      startAutoPlayerTurn(spawnedReinforcements ? 950 : 620);
    }
    safeRender();
  };

  if (after.turnEvents && after.turnEvents.length > 0) {
    startEventPlayback(before, after, after.turnEvents, "enemy", onEnemyDone);
  } else {
    onEnemyDone();
  }
  safeRender();
}

// =========================================================
// Auto Mode Controller
// =========================================================
function clearAutoTimer() {
  if (autoState.timerId) {
    window.clearTimeout(autoState.timerId);
    autoState.timerId = 0;
  }
}

function stopAutoMode() {
  clearAutoTimer();
  autoState.enabled = false;
  autoState.running = false;
  autoState.cancelPending = false;
  autoState.queue = [];
  autoState.generation += 1;
  lastHudSignature = "";
}

function scheduleAutoWork(fn, delayMs) {
  clearAutoTimer();
  const gen = autoState.generation;
  autoState.timerId = window.setTimeout(() => {
    autoState.timerId = 0;
    if (gen !== autoState.generation) return;
    fn(gen);
  }, delayMs);
}

function requestManualReturn(reason = "入力") {
  if (!autoState.enabled) return false;
  clearAutoTimer();
  autoState.enabled = false;
  autoState.running = false;
  autoState.queue = [];
  autoState.generation += 1;

  const current = getCurrentState();
  const inEnemyPhase =
    (playback.active && playback.mode === "enemy") || current.phase === "enemy";

  if (inEnemyPhase) {
    autoState.cancelPending = true;
    addBattleLog(`自動進行を解除予約しました（${reason}／次の自軍フェイズから手動操作）。`, "system");
  } else {
    autoState.cancelPending = false;
    if (current.interactionMode === "move") {
      if (bridge.useWasm && bridge.instance && typeof bridge.instance.cancel_move === "function") {
        bridge.instance.cancel_move();
      } else {
        state.interactionMode = null;
        state.moveOrigin = null;
      }
    }
    addBattleLog(`自動進行を解除しました（${reason}／手動操作へ切替）。`, "system");
  }
  lastHudSignature = "";
  safeRender();
  return true;
}

function enableAutoMode(options = {}) {
  if (!uiState.started || battleTracker.resolved || !window.srpgAutoAi) return false;
  clearAutoTimer();
  autoState.enabled = true;
  autoState.cancelPending = false;
  autoState.running = false;
  autoState.queue = [];
  autoState.generation += 1;

  const current = getCurrentState();
  if (current.interactionMode === "move") {
    if (bridge.useWasm && bridge.instance && typeof bridge.instance.cancel_move === "function") {
      bridge.instance.cancel_move();
    } else {
      state.interactionMode = null;
      state.moveOrigin = null;
    }
  }

  if (!options.silent) {
    addBattleLog("自動進行を ON にしました（クリック／タップ／キー入力で手動へ戻れます）。", "system");
  }
  lastHudSignature = "";
  safeRender();

  if (!playback.active && getCurrentState().phase === "player") {
    startAutoPlayerTurn(options.delayMs ?? 320);
  }
  return true;
}

function toggleAutoMode() {
  if (!uiState.started || battleTracker.resolved || !window.srpgAutoAi) return;
  soundPlay("ui");
  if (autoState.enabled) {
    requestManualReturn("HUDトグル");
  } else {
    enableAutoMode({ delayMs: 260 });
  }
}

function selectPlayerUnitForAuto(unit) {
  if (!unit) return;
  uiState.faceCardUnitId = unit.id;
  if (bridge.useWasm && bridge.instance) {
    bridge.instance.click_tile(unit.x, unit.y);
  } else {
    state.selectedUnitId = unit.id;
    state.selectedTile = { x: unit.x, y: unit.y };
    state.interactionMode = null;
  }
}

function executeAutoUnitMove(unit, dest, onDone) {
  const before = snapshotState(getCurrentState());
  if (bridge.useWasm && bridge.instance) {
    bridge.instance.begin_move();
    bridge.instance.click_tile(dest.x, dest.y);
    const after = snapshotState(getCurrentState());
    const expanded = window.srpgAutoAi
      ? window.srpgAutoAi.expandMoveEventsToSteps(after.turnEvents, before)
      : after.turnEvents;
    if (expanded && expanded.length > 0) {
      startEventPlayback(before, after, expanded, "player", () => {
        checkAndHandleOutcome();
        safeRender();
        if (typeof onDone === "function") onDone();
      });
    } else {
      checkAndHandleOutcome();
      safeRender();
      if (typeof onDone === "function") onDone();
    }
    safeRender();
    return;
  }

  const localUnit = state.units.find((u) => u.id === unit.id && u.hp > 0);
  if (!localUnit || localUnit.moved) {
    if (typeof onDone === "function") onDone();
    return;
  }
  const fx = localUnit.x;
  const fy = localUnit.y;
  localUnit.x = dest.x;
  localUnit.y = dest.y;
  localUnit.moved = true;
  state.selectedUnitId = localUnit.id;
  state.selectedTile = { x: dest.x, y: dest.y };
  state.interactionMode = null;
  state.moveOrigin = null;
  state.message = `${unitDisplayName(localUnit)} が ${dest.x},${dest.y} へ移動`;
  state.turnEvents = [{ type: "move", unit_id: localUnit.id, from_x: fx, from_y: fy, to_x: dest.x, to_y: dest.y }];
  state.eventSeq += 1;
  const after = snapshotState(state);
  const expanded = window.srpgAutoAi
    ? window.srpgAutoAi.expandMoveEventsToSteps(after.turnEvents, before)
    : after.turnEvents;
  startEventPlayback(before, after, expanded, "player", () => {
    checkAndHandleOutcome();
    safeRender();
    if (typeof onDone === "function") onDone();
  });
  safeRender();
}

function startAutoPlayerTurn(delayMs = 520) {
  if (!autoState.enabled || !uiState.started || battleTracker.resolved || !window.srpgAutoAi) {
    autoState.running = false;
    return;
  }
  const current = getCurrentState();
  if (current.phase !== "player") {
    autoState.running = false;
    return;
  }
  autoState.queue = currentPlayerUnits(current.units)
    .filter((u) => !u.moved || !u.acted)
    .map((u) => u.id);
  autoState.running = true;
  scheduleAutoWork(runNextAutoUnit, delayMs);
}

function runNextAutoUnit(gen) {
  if (gen !== autoState.generation || !autoState.enabled || !uiState.started || battleTracker.resolved) {
    autoState.running = false;
    return;
  }
  if (playback.active) {
    scheduleAutoWork(runNextAutoUnit, 120);
    return;
  }

  let current = getCurrentState();
  if (current.phase !== "player") {
    autoState.running = false;
    return;
  }

  let unit = null;
  while (autoState.queue.length > 0 && !unit) {
    const nextId = autoState.queue.shift();
    const candidate = current.units.find(
      (u) => u.id === nextId && u.team === "player" && u.hp > 0 && (!u.moved || !u.acted)
    );
    if (candidate) unit = candidate;
  }

  if (!unit) {
    autoState.running = false;
    scheduleAutoWork((endGen) => {
      if (endGen !== autoState.generation || !autoState.enabled || !uiState.started || battleTracker.resolved) {
        return;
      }
      if (getCurrentState().phase === "player") {
        runTurnEnd();
      }
    }, 360);
    return;
  }

  selectPlayerUnitForAuto(unit);
  current = getCurrentState();
  const freshUnit = current.units.find((u) => u.id === unit.id && u.hp > 0);
  if (!freshUnit) {
    scheduleAutoWork(runNextAutoUnit, 80);
    return;
  }
  safeRender();

  const plan = window.srpgAutoAi.planUnitTurn(freshUnit, current, activeAiConfig);

  const performActionStep = () => {
    if (gen !== autoState.generation || !autoState.enabled || !uiState.started || battleTracker.resolved) {
      autoState.running = false;
      return;
    }
    if (!plan.action) {
      scheduleAutoWork(runNextAutoUnit, 220);
      return;
    }
    const curAfterMove = getCurrentState();
    const actor = curAfterMove.units.find((u) => u.id === freshUnit.id && u.hp > 0);
    if (!actor || actor.acted || curAfterMove.phase !== "player") {
      scheduleAutoWork(runNextAutoUnit, 180);
      return;
    }
    selectPlayerUnitForAuto(actor);

    const onActionDone = () => {
      if (gen !== autoState.generation || !autoState.enabled || !uiState.started || battleTracker.resolved) {
        autoState.running = false;
        return;
      }
      scheduleAutoWork(runNextAutoUnit, 260);
    };

    if (plan.action.type === "ability") {
      executeAbility(plan.action.abilityId, onActionDone);
      return;
    }
    if (plan.action.type === "attack" && plan.action.target) {
      const latest = getCurrentState();
      const target = latest.units.find(
        (u) => u.id === plan.action.target.id && u.team === "enemy" && u.hp > 0
      );
      if (target && canPlayerAttackTarget(latest, target)) {
        executePlayerAttack(target, onActionDone);
        return;
      }
    }
    scheduleAutoWork(runNextAutoUnit, 180);
  };

  if (plan.moveTo && !freshUnit.moved) {
    executeAutoUnitMove(freshUnit, plan.moveTo, () => {
      if (gen !== autoState.generation || !autoState.enabled || !uiState.started || battleTracker.resolved) {
        autoState.running = false;
        return;
      }
      scheduleAutoWork(() => performActionStep(), 160);
    });
  } else {
    performActionStep();
  }
}

function loadScenarioIntoEngine() {
  if (!activeScenario) return;
  if (bridge.useWasm && bridge.instance && typeof bridge.instance.load_scenario_json === "function") {
    bridge.instance.load_scenario_json(activeWasmJson);
  } else {
    state = buildLocalStateFromScenario(activeScenario);
  }
}

function startBattle(options = {}) {
  if (!activeScenario) return;
  stopAutoMode();
  dismissAbilityCutin(false);
  finishPlaybackImmediately(false);
  clearAttackFx();
  uiState.started = true;
  uiState.unitPanelHidden = false;
  uiState.faceCardHidden = false;

  if (window.srpgSound) {
    window.srpgSound.unlock();
    window.srpgSound.startBgm();
    window.srpgSound.play("turnStart", true);
  }

  loadScenarioIntoEngine();
  if (startOverlay) startOverlay.hidden = true;
  resetBattleTracker();

  const cur = getCurrentState();
  const initialUnit =
    selectedPlayerUnit(cur) ??
    cur.units.find((u) => u.team === "player" && u.leader && u.hp > 0) ??
    cur.units.find((u) => u.team === "player" && u.hp > 0) ??
    null;
  uiState.faceCardUnitId = initialUnit ? initialUnit.id : null;
  if (!uiState.userAdjustedZoom) {
    setZoom(computeAutoZoom(cur.map.width, cur.map.height), false);
  }

  const title = `第1ターン — ${activeScenario.playerArmy}`;
  const sub = options.auto
    ? `自動観戦 — ${activeScenario.date} ${activeScenario.title}`
    : `${activeScenario.date} ${activeScenario.title}`;
  showPhaseBanner(title, sub, false, 1300);

  if (options.auto) {
    addBattleLog("自動進行モードで開戦しました（クリック／タップ／キー入力で手動へ戻れます）。", "highlight", 1);
    enableAutoMode({ silent: true, delayMs: 700 });
  }
  lastHudSignature = "";
  safeRender();
}

function resetCurrentScenario(options = {}) {
  if (!activeScenario) return;
  const keepAuto = typeof options?.auto === "boolean" ? options.auto : autoState.enabled;
  stopAutoMode();
  dismissAbilityCutin(false);
  finishPlaybackImmediately(false);
  clearAttackFx();
  soundPlay("ui");
  if (bridge.useWasm && bridge.instance) {
    bridge.instance.reset();
  } else {
    state = buildLocalStateFromScenario(activeScenario);
  }
  uiState.unitPanelHidden = false;
  uiState.faceCardHidden = false;
  const curAfterReset = getCurrentState();
  const initialUnit =
    selectedPlayerUnit(curAfterReset) ??
    curAfterReset.units.find((u) => u.team === "player" && u.leader && u.hp > 0) ??
    curAfterReset.units.find((u) => u.team === "player" && u.hp > 0) ??
    null;
  uiState.faceCardUnitId = initialUnit ? initialUnit.id : null;
  resetBattleTracker();
  showPhaseBanner(`第1ターン — ${activeScenario.playerArmy}`, keepAuto ? "自動観戦 — 再出陣" : "再出陣", false, 1050);
  if (keepAuto) {
    addBattleLog("自動進行モードで再出陣しました（クリック／タップ／キー入力で手動へ戻れます）。", "highlight", 1);
    enableAutoMode({ silent: true, delayMs: 650 });
  }
  lastHudSignature = "";
  safeRender();
}

function returnToStartScreen() {
  stopAutoMode();
  dismissAbilityCutin(false);
  finishPlaybackImmediately(false);
  hideResultOverlay();
  if (helpOverlay) helpOverlay.hidden = true;
  if (startOverlay) startOverlay.hidden = false;
  uiState.started = false;
  uiState.faceCardUnitId = null;
  soundPlay("ui");
  syncAudioUi();
}

// =========================================================
// Input Handling
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

    if (meta.longPress && unit.team === "player" && current.phase === "player") {
      uiState.unitPanelHidden = false;
      uiState.faceCardUnitId = unit.id;
      uiState.faceCardHidden = false;
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
      uiState.faceCardUnitId = unit.id;
      uiState.faceCardHidden = false;
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

    uiState.unitPanelHidden = false;
    uiState.faceCardUnitId = unit.id;
    uiState.faceCardHidden = false;
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

  const tile = screenToTile(point, current);
  if (!tile) {
    uiState.faceCardUnitId = null;
    safeRender();
    return;
  }

  uiState.unitPanelHidden = false;
  uiState.lastEnemyClickId = null;
  const before = snapshotState(current);
  const wasMoveMode = isMoveMode(current);

  if (bridge.useWasm && bridge.instance) {
    bridge.instance.click_tile(tile.x, tile.y);
    const after = snapshotState(getCurrentState());
    if (wasMoveMode && after.turnEvents && after.turnEvents.some((e) => e.type === "move")) {
      const movedEv = after.turnEvents.find((e) => e.type === "move");
      if (movedEv) uiState.faceCardUnitId = movedEv.unit_id;
      startEventPlayback(before, after, after.turnEvents, "player", () => {
        checkAndHandleOutcome();
        safeRender();
      });
    } else {
      // Clicked an empty tile -> deselect face card
      uiState.faceCardUnitId = null;
      soundPlay("ui");
      checkAndHandleOutcome();
    }
    safeRender();
    return;
  }

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
      uiState.faceCardUnitId = selected.id;
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
  uiState.faceCardUnitId = null;
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
  if (autoState.enabled && uiState.started && !battleTracker.resolved) {
    event.preventDefault();
    soundPlay("ui");
    requestManualReturn(event.pointerType === "touch" ? "タップ" : "クリック");
    return;
  }
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
// Rich Canvas 2D Renderer
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

function drawBackdrop(width, height) {
  const theme = activeScenario?.theme || "autumn";
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  if (theme === "winter") {
    grad.addColorStop(0, "#182638");
    grad.addColorStop(0.45, "#121f2e");
    grad.addColorStop(1, "#0a1019");
  } else if (theme === "summer") {
    grad.addColorStop(0, "#12262e");
    grad.addColorStop(0.45, "#0f1e26");
    grad.addColorStop(1, "#091218");
  } else if (theme === "crimson") {
    grad.addColorStop(0, "#24161e");
    grad.addColorStop(0.45, "#19121b");
    grad.addColorStop(1, "#0b0d14");
  } else if (theme === "mist") {
    grad.addColorStop(0, "#212e3d");
    grad.addColorStop(0.48, "#192430");
    grad.addColorStop(1, "#0f1720");
  } else {
    grad.addColorStop(0, "#142030");
    grad.addColorStop(0.45, "#111b27");
    grad.addColorStop(1, "#0a1017");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.fillStyle =
    theme === "winter"
      ? "rgba(148, 178, 208, 0.16)"
      : theme === "mist"
        ? "rgba(203, 219, 235, 0.16)"
        : "rgba(38, 56, 76, 0.28)";
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
  const vis = tile.visual || "";

  if (tile.terrain === "Water") {
    const phase = ((now * 0.025 + tile.x * 11 + tile.y * 7) % 18) / 18;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
    ctx.closePath();
    ctx.clip();

    if (vis === "moat") {
      // Stone-bordered castle moat
      ctx.strokeStyle = "rgba(203, 213, 225, 0.45)";
      ctx.lineWidth = Math.max(1.4, 2.2 * zoom);
      ctx.stroke();
      ctx.strokeStyle = "rgba(125, 211, 252, 0.35)";
      ctx.lineWidth = Math.max(1, 1.3 * zoom);
      for (let i = -1; i <= 1; i += 1) {
        const ox = (phase - 0.5) * pos.size * 0.2;
        const oy = i * 5.5 * zoom;
        ctx.beginPath();
        ctx.moveTo(cx - 12 * zoom + ox, cy + oy);
        ctx.lineTo(cx + 12 * zoom + ox, cy + oy);
        ctx.stroke();
      }
    } else if (vis === "lake") {
      // Shimmering Lake Inawashiro shoreline
      ctx.fillStyle = "rgba(186, 230, 253, 0.14)";
      ctx.beginPath();
      ctx.ellipse(cx + (phase - 0.5) * 6 * zoom, cy - 2 * zoom, 15 * zoom, 5 * zoom, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(224, 242, 254, 0.52)";
      ctx.lineWidth = Math.max(1, 1.4 * zoom);
      for (let i = -1; i <= 1; i += 1) {
        const ox = Math.sin(now * 0.002 + tile.x + i) * 4 * zoom;
        const oy = i * 5.5 * zoom;
        ctx.beginPath();
        ctx.moveTo(cx - 14 * zoom + ox, cy + oy);
        ctx.quadraticCurveTo(cx + ox, cy + oy - 2.5 * zoom, cx + 14 * zoom + ox, cy + oy);
        ctx.stroke();
      }
    } else if (vis === "stream") {
      // Narrow icy snow-banked stream
      ctx.strokeStyle = "rgba(226, 238, 248, 0.72)";
      ctx.lineWidth = Math.max(2, 3.2 * zoom);
      ctx.stroke();
      ctx.strokeStyle = "rgba(186, 230, 253, 0.65)";
      ctx.lineWidth = Math.max(1, 1.3 * zoom);
      const ox = (phase - 0.5) * pos.size * 0.3;
      ctx.beginPath();
      ctx.moveTo(cx - 13 * zoom - ox, cy + 4 * zoom);
      ctx.quadraticCurveTo(cx - ox, cy - 2 * zoom, cx + 13 * zoom - ox, cy - 4 * zoom);
      ctx.stroke();
    } else {
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
    }
    ctx.restore();
    return;
  }

  if (tile.bridge) {
    ctx.save();
    ctx.fillStyle = "#4b311d";
    const lift = isoLiftPx(tile, zoom);
    ctx.fillRect(polygon[0].x + 5 * zoom, polygon[0].y + 2 * zoom, 3.5 * zoom, lift * 0.85);
    ctx.fillRect(polygon[3].x - 2 * zoom, polygon[3].y + 1 * zoom, 3.5 * zoom, lift * 0.85);
    ctx.fillRect(polygon[2].x - 8 * zoom, polygon[2].y + 2 * zoom, 3.5 * zoom, lift * 0.85);

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

    const railH = 7 * zoom;
    ctx.strokeStyle = vis === "snow_road" ? "#cbd5e1" : "#7c4a22";
    ctx.lineWidth = Math.max(1.5, 2.4 * zoom);
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y - railH);
    ctx.lineTo(polygon[3].x, polygon[3].y - railH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(polygon[1].x, polygon[1].y - railH);
    ctx.lineTo(polygon[2].x, polygon[2].y - railH);
    ctx.stroke();
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
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
    ctx.closePath();
    ctx.clip();

    if (vis === "frozen_rice") {
      ctx.fillStyle = "rgba(226, 240, 250, 0.52)";
      ctx.beginPath();
      ctx.ellipse(cx - 2 * zoom, cy - 1 * zoom, 15 * zoom, 5.5 * zoom, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(100, 128, 148, 0.55)";
      ctx.lineWidth = Math.max(1, 1 * zoom);
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(cx - 14 * zoom, cy + i * 5 * zoom - 3 * zoom);
        ctx.lineTo(cx + 14 * zoom, cy + i * 5 * zoom + 3 * zoom);
        ctx.stroke();
      }
    } else if (vis === "marsh") {
      ctx.fillStyle = "rgba(125, 211, 252, 0.28)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 1 * zoom, 16 * zoom, 6 * zoom, 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Reed tufts
      ctx.strokeStyle = "rgba(30, 82, 52, 0.78)";
      ctx.lineWidth = Math.max(1, 1.3 * zoom);
      for (const ox of [-9, -1, 8]) {
        ctx.beginPath();
        ctx.moveTo(cx + ox * zoom, cy + 3 * zoom);
        ctx.lineTo(cx + (ox - 1.5) * zoom, cy - 4 * zoom);
        ctx.moveTo(cx + ox * zoom, cy + 3 * zoom);
        ctx.lineTo(cx + (ox + 1.8) * zoom, cy - 3.5 * zoom);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = "rgba(186, 235, 255, 0.28)";
      ctx.beginPath();
      ctx.ellipse(cx - 4 * zoom, cy - 1 * zoom, 15 * zoom, 5 * zoom, -0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(38, 92, 48, 0.55)";
      ctx.lineWidth = Math.max(1, 1.1 * zoom);
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(cx - 16 * zoom, cy + i * 4.2 * zoom - 4 * zoom);
        ctx.lineTo(cx + 16 * zoom, cy + i * 4.2 * zoom + 4 * zoom);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  if (vis === "snow" && tile.terrain === "Plain") {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.lineWidth = Math.max(1, 1.4 * zoom);
    ctx.beginPath();
    ctx.moveTo(cx - 12 * zoom, cy + 1 * zoom);
    ctx.quadraticCurveTo(cx, cy - 3 * zoom, cx + 11 * zoom, cy + 2 * zoom);
    ctx.stroke();
    ctx.restore();
  }

  if (tile.terrain === "Terrace") {
    ctx.save();
    ctx.strokeStyle =
      vis === "snow_hill"
        ? "rgba(241, 245, 249, 0.72)"
        : vis === "bandai"
          ? "rgba(42, 56, 44, 0.55)"
          : "rgba(52, 46, 22, 0.42)";
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
    ctx.save();
    if (vis === "slope") {
      // Stepped stone uphill treads
      ctx.strokeStyle = "rgba(92, 74, 46, 0.58)";
      ctx.lineWidth = Math.max(1, 1.6 * zoom);
      for (let i = -2; i <= 2; i += 1) {
        const yOff = i * 3.6 * zoom;
        ctx.beginPath();
        ctx.moveTo(cx - 11 * zoom, cy + yOff - 2 * zoom);
        ctx.lineTo(cx + 11 * zoom, cy + yOff + 2 * zoom);
        ctx.stroke();
      }
    } else if (vis === "snow_road") {
      ctx.strokeStyle = "rgba(100, 116, 139, 0.42)";
      ctx.lineWidth = Math.max(1, 1.5 * zoom);
      ctx.beginPath();
      ctx.moveTo(cx - 9 * zoom, cy - 4 * zoom);
      ctx.lineTo(cx + 9 * zoom, cy + 3 * zoom);
      ctx.moveTo(cx - 6 * zoom, cy - 1 * zoom);
      ctx.lineTo(cx + 11 * zoom, cy + 5 * zoom);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(255, 241, 206, 0.36)";
      ctx.lineWidth = Math.max(1, 2 * zoom);
      ctx.beginPath();
      ctx.moveTo(cx - 10 * zoom, cy - 4 * zoom);
      ctx.lineTo(cx + 10 * zoom, cy + 4 * zoom);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (tile.terrain === "Castle") {
    ctx.save();
    if (vis === "gate") {
      // Castle gatehouse (大手門)
      const gw = 20 * zoom;
      const gh = 11 * zoom;
      ctx.fillStyle = "#4b3828";
      ctx.fillRect(cx - gw * 0.5, cy - gh, gw * 0.25, gh);
      ctx.fillRect(cx + gw * 0.25, cy - gh, gw * 0.25, gh);
      ctx.fillStyle = "#e8e2d3";
      ctx.fillRect(cx - gw * 0.56, cy - gh * 1.45, gw * 1.12, gh * 0.55);
      ctx.fillStyle = "#1f2937";
      ctx.beginPath();
      ctx.moveTo(cx - gw * 0.72, cy - gh * 1.4);
      ctx.lineTo(cx + gw * 0.72, cy - gh * 1.4);
      ctx.lineTo(cx + gw * 0.52, cy - gh * 1.9);
      ctx.lineTo(cx - gw * 0.52, cy - gh * 1.9);
      ctx.closePath();
      ctx.fill();
    } else if (vis === "palisade") {
      // Palisade outwork / Sanadamaru rampart (柵・出丸)
      const pw = 22 * zoom;
      const ph = 10 * zoom;
      ctx.fillStyle = "#6c4829";
      ctx.fillRect(cx - pw * 0.5, cy - ph * 0.85, pw, ph * 0.85);
      ctx.strokeStyle = "#2f1e11";
      ctx.lineWidth = Math.max(1, 1 * zoom);
      for (let i = -2; i <= 2; i += 1) {
        const px = cx + i * (pw * 0.2);
        ctx.beginPath();
        ctx.moveTo(px, cy);
        ctx.lineTo(px, cy - ph * 1.25);
        ctx.stroke();
      }
      ctx.fillStyle = "#b91c1c";
      ctx.fillRect(cx - pw * 0.42, cy - ph * 1.15, pw * 0.84, ph * 0.28);
    } else if (vis === "earthwork") {
      // Field earthwork & stockade (付城・土塁)
      const ew = 20 * zoom;
      const eh = 8 * zoom;
      ctx.fillStyle = "#786248";
      ctx.beginPath();
      ctx.moveTo(cx - ew * 0.56, cy);
      ctx.lineTo(cx - ew * 0.36, cy - eh);
      ctx.lineTo(cx + ew * 0.36, cy - eh);
      ctx.lineTo(cx + ew * 0.56, cy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#4b3828";
      ctx.lineWidth = Math.max(1, 1.1 * zoom);
      ctx.stroke();
    } else if (vis === "fort") {
      // Compact wooden/snow hill fort (小城・山城砦)
      const fw = 16 * zoom;
      const fh = 9 * zoom;
      ctx.fillStyle = "#6e553b";
      ctx.fillRect(cx - fw * 0.5, cy - fh * 1.05, fw, fh);
      ctx.strokeStyle = "#3b2c1d";
      ctx.lineWidth = Math.max(1, 1 * zoom);
      ctx.strokeRect(cx - fw * 0.5, cy - fh * 1.05, fw, fh);
      ctx.fillStyle = activeScenario?.theme === "winter" ? "#e2e8f0" : "#334155";
      ctx.beginPath();
      ctx.moveTo(cx - fw * 0.68, cy - fh * 1.0);
      ctx.lineTo(cx + fw * 0.68, cy - fh * 1.0);
      ctx.lineTo(cx, cy - fh * 1.85);
      ctx.closePath();
      ctx.fill();
    } else {
      // Standard or grand citadel keep (extra tier when height >= 4)
      const isGrand = vis === "citadel" && tile.height >= 4;
      const bw = (isGrand ? 21 : 18) * zoom;
      const bh = (isGrand ? 12 : 11) * zoom;
      ctx.fillStyle = "#e8e3d5";
      ctx.fillRect(cx - bw * 0.5, cy - bh * 1.15, bw, bh);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = Math.max(1, 1 * zoom);
      ctx.strokeRect(cx - bw * 0.5, cy - bh * 1.15, bw, bh);
      ctx.fillStyle = "#263140";
      ctx.beginPath();
      ctx.moveTo(cx - bw * 0.72, cy - bh * 1.1);
      ctx.lineTo(cx + bw * 0.72, cy - bh * 1.1);
      ctx.lineTo(cx + bw * 0.48, cy - bh * 1.55);
      ctx.lineTo(cx - bw * 0.48, cy - bh * 1.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f4efe2";
      ctx.fillRect(cx - bw * 0.34, cy - bh * 2.15, bw * 0.68, bh * 0.65);
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.moveTo(cx - bw * 0.54, cy - bh * 2.1);
      ctx.lineTo(cx + bw * 0.54, cy - bh * 2.1);
      ctx.lineTo(cx, cy - bh * 2.75);
      ctx.closePath();
      ctx.fill();
      if (isGrand) {
        ctx.fillStyle = "#f8f4e8";
        ctx.fillRect(cx - bw * 0.22, cy - bh * 2.95, bw * 0.44, bh * 0.5);
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.moveTo(cx - bw * 0.38, cy - bh * 2.9);
        ctx.lineTo(cx + bw * 0.38, cy - bh * 2.9);
        ctx.lineTo(cx, cy - bh * 3.45);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#facc15";
        ctx.fillRect(cx - 2.6 * zoom, cy - bh * 3.55, 5.2 * zoom, 2.4 * zoom);
      } else {
        ctx.fillStyle = "#facc15";
        ctx.fillRect(cx - 1.5 * zoom, cy - bh * 2.85, 3 * zoom, 2 * zoom);
      }
    }
    ctx.restore();
  } else if (tile.terrain === "Mountain") {
    ctx.save();
    const isBandai = vis === "bandai";
    const isSnow = vis === "snow_hill" || activeScenario?.theme === "winter";
    const peakH = (isBandai ? 22 : 16) * zoom;
    ctx.fillStyle = isSnow ? "#6e8398" : isBandai ? "#3e4e44" : "#485846";
    ctx.beginPath();
    ctx.moveTo(cx - 15 * zoom, cy + 3 * zoom);
    ctx.lineTo(cx - 2 * zoom, cy - peakH);
    ctx.lineTo(cx + 13 * zoom, cy + 3 * zoom);
    ctx.closePath();
    ctx.fill();
    if (isBandai) {
      // Secondary volcanic crag
      ctx.fillStyle = "#526658";
      ctx.beginPath();
      ctx.moveTo(cx - 1 * zoom, cy + 3 * zoom);
      ctx.lineTo(cx + 8 * zoom, cy - 13 * zoom);
      ctx.lineTo(cx + 16 * zoom, cy + 3 * zoom);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = isSnow ? "#f1f5f9" : isBandai ? "#839686" : "#6c7f68";
    ctx.beginPath();
    ctx.moveTo(cx - 6.5 * zoom, cy - peakH * 0.55);
    ctx.lineTo(cx - 2 * zoom, cy - peakH);
    ctx.lineTo(cx + 3.5 * zoom, cy - peakH * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (tile.terrain === "Town") {
    ctx.save();
    if (vis === "urban") {
      // Dense Osaka dark-kawara town blocks
      ctx.fillStyle = "#334155";
      ctx.fillRect(cx - 12 * zoom, cy - 6 * zoom, 11 * zoom, 7 * zoom);
      ctx.fillStyle = "#475569";
      ctx.fillRect(cx + 1 * zoom, cy - 2 * zoom, 11 * zoom, 7 * zoom);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(cx - 11 * zoom, cy - 1 * zoom, 9 * zoom, 2 * zoom);
      ctx.fillRect(cx + 2 * zoom, cy + 3 * zoom, 9 * zoom, 2 * zoom);
    } else if (vis === "snow") {
      // Snow-roofed winter cottages
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.moveTo(cx - 10 * zoom, cy);
      ctx.lineTo(cx - 2 * zoom, cy - 6 * zoom);
      ctx.lineTo(cx + 6 * zoom, cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f1f5f9";
      ctx.beginPath();
      ctx.moveTo(cx - 8 * zoom, cy - 1 * zoom);
      ctx.lineTo(cx - 2 * zoom, cy - 6 * zoom);
      ctx.lineTo(cx + 4 * zoom, cy - 1 * zoom);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.moveTo(cx, cy + 4 * zoom);
      ctx.lineTo(cx + 7 * zoom, cy - 2 * zoom);
      ctx.lineTo(cx + 14 * zoom, cy + 4 * zoom);
      ctx.closePath();
      ctx.fill();
    } else {
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
    }
    ctx.restore();
  } else if (tile.cover && tile.terrain !== "Water") {
    ctx.save();
    if (vis === "snow" || vis === "snow_hill") {
      // Frosted snow-dusted pine tree
      ctx.fillStyle = "#3f3224";
      ctx.fillRect(cx + 8.5 * zoom, cy - 4 * zoom, 2.2 * zoom, 5.5 * zoom);
      ctx.fillStyle = "#1f4f3c";
      ctx.beginPath();
      ctx.moveTo(cx + 3 * zoom, cy - 3 * zoom);
      ctx.lineTo(cx + 9.5 * zoom, cy - 14 * zoom);
      ctx.lineTo(cx + 16 * zoom, cy - 3 * zoom);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f1f5f9";
      ctx.beginPath();
      ctx.moveTo(cx + 6 * zoom, cy - 9 * zoom);
      ctx.lineTo(cx + 9.5 * zoom, cy - 14 * zoom);
      ctx.lineTo(cx + 13 * zoom, cy - 9 * zoom);
      ctx.closePath();
      ctx.fill();
    } else {
      const isMaple = activeScenario?.theme === "autumn" && (tile.x + tile.y) % 2 === 0;
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
    }
    ctx.restore();
  }

  if (tile.escape) {
    const pulse = 0.55 + 0.45 * Math.sin(now * 0.005);
    const badgeText = activeScenario?.rules?.escapeBadge || "離脱";
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

    const tagW = Math.max(30, badgeText.length * 13) * zoom;
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
    ctx.fillText(badgeText, cx, cy - 1.5 * zoom);
    ctx.restore();
  }

  const pCap = activeScenario?.rules?.playerCaptureTiles ?? [];
  const eCap = activeScenario?.rules?.enemyCaptureTiles ?? [];
  const isPlayerCap = pCap.some((pt) => pt.x === tile.x && pt.y === tile.y);
  const isEnemyCap = eCap.some((pt) => pt.x === tile.x && pt.y === tile.y);
  if (isPlayerCap || isEnemyCap) {
    const pulse = 0.55 + 0.45 * Math.sin(now * 0.0045);
    const label = activeScenario?.rules?.captureLabel || "本丸";
    const shortLabel = label.length > 5 ? label.slice(-2) : label;
    const strokeRgb = isEnemyCap ? "96, 165, 250" : "250, 204, 21";
    const textColor = isEnemyCap ? "#bfdbfe" : "#fef08a";
    ctx.save();
    ctx.strokeStyle = `rgba(${strokeRgb}, ${0.55 + 0.38 * pulse})`;
    ctx.lineWidth = Math.max(1.5, 2.2 * zoom);
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
    ctx.closePath();
    ctx.stroke();

    const tagW = Math.max(32, shortLabel.length * 12) * zoom;
    const tagH = 14 * zoom;
    ctx.fillStyle = "rgba(15, 23, 42, 0.86)";
    ctx.strokeStyle = `rgba(${strokeRgb}, 0.92)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    roundedRectPath(cx - tagW / 2, cy - tagH / 2 - 22 * zoom, tagW, tagH, 4 * zoom);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.font = `700 ${Math.max(8, 9 * zoom)}px "GenInterfaceJP", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(shortLabel, cx, cy - 21.5 * zoom);
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

  ctx.fillStyle = leftShade;
  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  ctx.lineTo(polygon[3].x, polygon[3].y);
  ctx.lineTo(polygon[3].x, polygon[3].y + heightPx);
  ctx.lineTo(polygon[0].x, polygon[0].y + heightPx);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = rightShade;
  ctx.beginPath();
  ctx.moveTo(polygon[3].x, polygon[3].y);
  ctx.lineTo(polygon[2].x, polygon[2].y);
  ctx.lineTo(polygon[2].x, polygon[2].y + heightPx);
  ctx.lineTo(polygon[3].x, polygon[3].y + heightPx);
  ctx.closePath();
  ctx.fill();

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

  ctx.fillStyle = topShade;
  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let i = 1; i < 4; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
  ctx.closePath();
  ctx.fill();

  drawIsoTerrainDetail(tile, polygon, pos, zoom, now);

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

  const vis = tile.visual || "";
  if (tile.terrain === "Water") {
    const wave = ((now * 0.02 + tile.x * 9) % 12) / 12;
    if (vis === "moat") {
      ctx.strokeStyle = "rgba(203, 213, 225, 0.5)";
      ctx.lineWidth = Math.max(1.5, 2.2 * zoom);
      ctx.strokeRect(pos.x + 1.5, pos.y + 1.5, size - 3, size - 3);
    }
    ctx.strokeStyle = vis === "lake" ? "rgba(224, 242, 254, 0.55)" : "rgba(186, 230, 253, 0.45)";
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
    ctx.fillStyle = vis === "frozen_rice" ? "rgba(226, 240, 250, 0.45)" : "rgba(186, 235, 255, 0.22)";
    ctx.fillRect(pos.x + 4 * zoom, pos.y + 4 * zoom, size - 8 * zoom, size * 0.42);
  } else if (tile.terrain === "Castle") {
    if (vis === "gate") {
      ctx.fillStyle = "#334155";
      ctx.fillRect(pos.x + size * 0.14, pos.y + size * 0.3, size * 0.72, size * 0.4);
      ctx.fillStyle = "#e8e3d5";
      ctx.fillRect(pos.x + size * 0.24, pos.y + size * 0.36, size * 0.52, size * 0.28);
    } else if (vis === "palisade") {
      ctx.fillStyle = "#6c4829";
      ctx.fillRect(pos.x + size * 0.14, pos.y + size * 0.22, size * 0.72, size * 0.56);
      ctx.fillStyle = "#b91c1c";
      ctx.fillRect(pos.x + size * 0.22, pos.y + size * 0.32, size * 0.56, size * 0.36);
    } else if (vis === "earthwork") {
      ctx.fillStyle = "#786248";
      ctx.fillRect(pos.x + size * 0.18, pos.y + size * 0.24, size * 0.64, size * 0.52);
      ctx.fillStyle = "#5c4934";
      ctx.fillRect(pos.x + size * 0.28, pos.y + size * 0.34, size * 0.44, size * 0.32);
    } else if (vis === "fort") {
      ctx.fillStyle = "#6e553b";
      ctx.fillRect(pos.x + size * 0.22, pos.y + size * 0.22, size * 0.56, size * 0.56);
      ctx.fillStyle = activeScenario?.theme === "winter" ? "#e2e8f0" : "#334155";
      ctx.fillRect(pos.x + size * 0.32, pos.y + size * 0.32, size * 0.36, size * 0.36);
    } else {
      ctx.fillStyle = "#e8e3d5";
      ctx.fillRect(pos.x + size * 0.2, pos.y + size * 0.2, size * 0.6, size * 0.6);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(pos.x + size * 0.3, pos.y + size * 0.3, size * 0.4, size * 0.4);
      if (vis === "citadel" && tile.height >= 4) {
        ctx.fillStyle = "#facc15";
        ctx.fillRect(pos.x + size * 0.43, pos.y + size * 0.43, size * 0.14, size * 0.14);
      }
    }
  } else if (vis === "slope") {
    ctx.strokeStyle = "rgba(92, 74, 46, 0.55)";
    ctx.lineWidth = Math.max(1, 1.5 * zoom);
    for (let i = 1; i <= 4; i += 1) {
      const py = pos.y + (size * i) / 5;
      ctx.beginPath();
      ctx.moveTo(pos.x + 6 * zoom, py);
      ctx.lineTo(pos.x + size - 6 * zoom, py);
      ctx.stroke();
    }
  } else if (vis === "urban") {
    ctx.fillStyle = "#334155";
    ctx.fillRect(pos.x + size * 0.14, pos.y + size * 0.16, size * 0.34, size * 0.32);
    ctx.fillRect(pos.x + size * 0.52, pos.y + size * 0.46, size * 0.34, size * 0.34);
  }

  if (tile.escape) {
    const badgeText = activeScenario?.rules?.escapeBadge || "離脱";
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = Math.max(2, 2.5 * zoom);
    ctx.strokeRect(pos.x + 2, pos.y + 2, size - 4, size - 4);
    ctx.fillStyle = "#fef08a";
    ctx.font = `700 ${Math.max(8, 10 * zoom)}px "GenInterfaceJP", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(badgeText, pos.x + size / 2, pos.y + 13 * zoom);
    ctx.lineWidth = 1;
  }

  const pCap2d = activeScenario?.rules?.playerCaptureTiles ?? [];
  const eCap2d = activeScenario?.rules?.enemyCaptureTiles ?? [];
  const isPlayerCap2d = pCap2d.some((pt) => pt.x === tile.x && pt.y === tile.y);
  const isEnemyCap2d = eCap2d.some((pt) => pt.x === tile.x && pt.y === tile.y);
  if (isPlayerCap2d || isEnemyCap2d) {
    const label = activeScenario?.rules?.captureLabel || "本丸";
    const shortLabel = label.length > 5 ? label.slice(-2) : label;
    ctx.strokeStyle = isEnemyCap2d ? "#60a5fa" : "#facc15";
    ctx.lineWidth = Math.max(2, 2.4 * zoom);
    ctx.strokeRect(pos.x + 2, pos.y + 2, size - 4, size - 4);
    ctx.fillStyle = isEnemyCap2d ? "#bfdbfe" : "#fef08a";
    ctx.font = `700 ${Math.max(8, 9.5 * zoom)}px "GenInterfaceJP", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(shortLabel, pos.x + size / 2, pos.y + 13 * zoom);
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

const TAG_BADGE_MAP = {
  masamune: "政",
  oniwa: "鬼",
  shigezane: "実",
  kagetsuna: "片",
  masakage: "留",
  tsunamoto: "茂",
  hidemune: "秀",
  morikuni: "猪",
  munezane: "白",
  satake: "佐",
  ashina: "蘆",
  yoshihiro: "蘆",
  iwaki: "岩",
  yoshiaki: "最",
  kanagami: "金",
  sase: "瀬",
};

function unitBadgeText(unit) {
  if (unit.tag && TAG_BADGE_MAP[unit.tag]) return TAG_BADGE_MAP[unit.tag];
  if (unit.basis !== "fiction" && unit.name && unit.name.length >= 2) {
    return unit.name[0];
  }
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

  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.beginPath();
  ctx.ellipse(baseX, baseY + 6 * zoom, radius + 2.5 * zoom, 5.2 * zoom, 0, 0, Math.PI * 2);
  ctx.fill();

  if (tilt !== 0) {
    ctx.translate(baseX, baseY + 4 * zoom);
    ctx.rotate(tilt);
    ctx.translate(-baseX, -(baseY + 4 * zoom));
  }

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

  const fcx = (poleX + (isPlayer ? flagX : flagX + flagW)) * 0.5;
  const fcy = poleTopY + flagH * 0.48;
  ctx.fillStyle = "#fde047";
  if (isPlayer) {
    ctx.beginPath();
    ctx.arc(fcx, fcy, 3.1 * zoom, 0.3, Math.PI * 1.7);
    ctx.arc(fcx + 1.1 * zoom, fcy, 2.3 * zoom, Math.PI * 1.65, 0.35, true);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(fcx - 2.6 * zoom, fcy - 2.6 * zoom, 5.2 * zoom, 1.5 * zoom);
    ctx.fillRect(fcx - 2.6 * zoom, fcy - 0.2 * zoom, 5.2 * zoom, 1.5 * zoom);
    ctx.fillRect(fcx - 2.6 * zoom, fcy + 2.2 * zoom, 5.2 * zoom, 1.5 * zoom);
  }

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

  if (unit.tag === "oniwa") {
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(x, y - radius * 0.72, radius * 0.56, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#854d0e";
    ctx.lineWidth = Math.max(1, 1.2 * zoom);
    ctx.stroke();
  } else if (unit.tag === "masamune") {
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = Math.max(1.6, 2.2 * zoom);
    ctx.beginPath();
    ctx.arc(x, y - radius * 1.15, radius * 0.65, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.max(9, 12.5 * zoom)}px "GenInterfaceJP", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(unitBadgeText(unit), x, y + 0.5 * zoom);

  const barW = 32 * zoom;
  const barH = 4.6 * zoom;
  const hpPct = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
  ctx.fillStyle = "rgba(8, 12, 18, 0.82)";
  ctx.fillRect(x - barW / 2 - 1, baseY + 7 * zoom, barW + 2, barH + 2);
  ctx.fillStyle = isPlayer ? (hpPct < 0.35 ? "#f59e0b" : "#34d399") : "#f87171";
  ctx.fillRect(x - barW / 2, baseY + 7 * zoom + 1, barW * hpPct, barH);

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

  drawBackdrop(width, height);
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

  for (const [key, cost] of moveCosts.entries()) {
    const [x, y] = key.split(",").map(Number);
    const tile = tileAt(current.map, x, y);
    if (!tile) continue;
    drawMoveCostLabel(String(cost), tileToScreen(tile, current), current);
  }

  for (let i = visualFx.dyingUnits.length - 1; i >= 0; i -= 1) {
    const d = visualFx.dyingUnits[i];
    const t = (now - d.startedAt) / d.duration;
    if (t >= 1) {
      visualFx.dyingUnits.splice(i, 1);
      continue;
    }
    drawUnit(d.unit, current, now, 1 - t, t * 0.9);
  }

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

  // Subtle ambient winter snowfall for snowy scenarios (e.g., Osaki)
  if (activeScenario?.theme === "winter") {
    ctx.save();
    ctx.fillStyle = "rgba(241, 248, 255, 0.55)";
    for (let i = 0; i < 36; i += 1) {
      const sx = ((i * 97.3 + now * 0.018 * (0.6 + (i % 3) * 0.25) + Math.sin(now * 0.0014 + i) * 18) % (width + 20)) - 10;
      const sy = ((i * 61.7 + now * 0.032 * (0.7 + (i % 4) * 0.18)) % (height + 20)) - 10;
      const r = 1.1 + (i % 3) * 0.65;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Subtle ambient morning mist for misty scenarios (e.g., Domyoji — visual only)
  if (activeScenario?.theme === "mist") {
    ctx.save();
    for (let i = 0; i < 5; i += 1) {
      const drift = ((now * (0.009 + i * 0.0025) + i * 240) % (width + 420)) - 210;
      const my = height * (0.16 + i * 0.17) + Math.sin(now * 0.00055 + i * 1.4) * 14;
      const rx = 180 + (i % 3) * 65;
      const ry = 38 + (i % 2) * 18;
      const mistGrad = ctx.createRadialGradient(drift, my, ry * 0.1, drift, my, rx);
      mistGrad.addColorStop(0, "rgba(226, 238, 248, 0.13)");
      mistGrad.addColorStop(0.55, "rgba(206, 224, 240, 0.06)");
      mistGrad.addColorStop(1, "rgba(206, 224, 240, 0)");
      ctx.fillStyle = mistGrad;
      ctx.beginPath();
      ctx.ellipse(drift, my, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.font = `700 11px "GenInterfaceJP", sans-serif`;
  ctx.textAlign = "center";
  const footerText = `${activeScenario?.title || ""}（${activeScenario?.place || ""}） [${current.viewMode === "isometric" ? "斜め見下ろし" : "真上2D"}]`;
  ctx.fillText(footerText, width * 0.5, height - 10);

  drawHud(rawCurrent);
}

// =========================================================
// HUD & Unit Cards
// =========================================================
let lastHudSignature = "";

function drawHud(current) {
  const playersAlive = currentPlayerUnits(current.units).length;
  const enemiesAlive = currentEnemyUnits(current.units).length;
  const rules = activeScenario?.rules;
  const maxTurnCap = rules?.surviveTurns > 0 ? rules.surviveTurns : rules?.maxTurns || 10;
  const recUnit = rules?.recordUnitTag ? current.units.find((u) => u.tag === rules.recordUnitTag) : null;

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
    fcId: uiState.faceCardUnitId,
    fcH: uiState.faceCardHidden,
    res: battleTracker.resolved,
    rd: battleTracker.recordDefendedTurns,
    auto: autoState.enabled,
    autoP: autoState.cancelPending,
    started: uiState.started,
    units: current.units.map((u) => `${u.id}:${u.hp}:${u.x},${u.y}:${u.moved}:${u.acted}`),
  });
  if (sig === lastHudSignature) return;
  lastHudSignature = sig;

  if (scenarioBadge && activeScenario) {
    scenarioBadge.textContent = activeScenario.year
      ? `${activeScenario.title}（${activeScenario.year}）`
      : activeScenario.title;
  }
  if (turnBadge) {
    turnBadge.textContent = maxTurnCap > 0
      ? `第 ${Math.min(current.turnNumber, maxTurnCap)} / ${maxTurnCap} ターン`
      : `第 ${current.turnNumber} ターン`;
  }
  if (phaseBadge) {
    phaseBadge.className = "phaseBadge";
    if (battleTracker.resolved) {
      phaseBadge.classList.add(battleTracker.outcome?.victory ? "phase-victory" : "phase-defeat");
      phaseBadge.textContent = battleTracker.outcome?.victory ? "勝利" : "敗北";
    } else if (playback.active && playback.mode === "enemy") {
      phaseBadge.classList.add("phase-enemy");
      phaseBadge.textContent = `${activeScenario?.enemyArmy || "敵軍"} 行動中`;
    } else {
      phaseBadge.classList.add("phase-player");
      phaseBadge.textContent = activeScenario?.playerArmy || "自軍";
    }
  }
  if (autoStatusBadge) {
    if (autoState.enabled && uiState.started && !battleTracker.resolved) {
      autoStatusBadge.hidden = false;
      autoStatusBadge.className = "autoBadge";
      autoStatusBadge.textContent = "自動進行中（クリック／キーで手動へ）";
    } else if (autoState.cancelPending && uiState.started && !battleTracker.resolved) {
      autoStatusBadge.hidden = false;
      autoStatusBadge.className = "autoBadge pending";
      autoStatusBadge.textContent = "手動へ切替中（次の自軍フェイズから手動）";
    } else {
      autoStatusBadge.hidden = true;
    }
  }
  if (autoToggleBtn) {
    autoToggleBtn.disabled = !uiState.started || battleTracker.resolved || !window.srpgAutoAi;
    autoToggleBtn.setAttribute("aria-pressed", autoState.enabled ? "true" : "false");
    autoToggleBtn.classList.toggle("is-on", autoState.enabled);
    autoToggleBtn.classList.toggle("is-pending", !autoState.enabled && autoState.cancelPending);
    autoToggleBtn.textContent = autoState.enabled
      ? "自動: ON"
      : autoState.cancelPending
        ? "自動: 解除中"
        : "自動: OFF";
  }

  if (objectiveBanner && activeScenario) {
    if (rules?.surviveTurns > 0) {
      const rem = Math.max(0, rules.surviveTurns - current.turnNumber + 1);
      objectiveBanner.textContent = `目標: ${activeScenario.victoryText}（残り ${rem} ターン）`;
    } else {
      objectiveBanner.textContent = `目標: ${activeScenario.victoryText}`;
    }
  }

  if (objectiveDetailEl && activeScenario) {
    objectiveDetailEl.innerHTML =
      `<strong>勝利:</strong> ${escapeHtml(activeScenario.victoryText)}<br /><strong>敗北:</strong> ${escapeHtml(activeScenario.defeatText)}`;
  }

  if (playerForceLabel) {
    playerForceLabel.textContent = `${activeScenario?.playerArmy || "自軍"} ${playersAlive}部隊`;
  }
  if (enemyForceLabel) {
    enemyForceLabel.textContent = `${activeScenario?.enemyArmy || "敵軍"} ${enemiesAlive}部隊`;
  }

  const hasRecord = Boolean(rules?.recordUnitTag && recUnit);
  if (recordStatusPill) {
    recordStatusPill.hidden = !hasRecord;
    if (hasRecord) {
      const alive = recUnit.hp > 0;
      const shortLabel = rules.recordLabel || recUnit.name;
      recordStatusPill.classList.toggle("fallen", !alive);
      recordStatusPill.textContent = alive
        ? `${shortLabel}: ${battleTracker.recordDefendedTurns}T防衛中 (HP ${recUnit.hp})`
        : `${shortLabel}: ${battleTracker.recordDefendedTurns}T防衛後 討死`;
    }
  }
  if (recordSummaryLine) {
    recordSummaryLine.hidden = !hasRecord;
    if (hasRecord) {
      recordSummaryLine.textContent =
        recUnit.hp > 0
          ? `${rules.recordLabel || recUnit.name}: 防衛 ${battleTracker.recordDefendedTurns} ターン継続中（交戦 ${battleTracker.recordEngagements} 回）`
          : `${rules.recordLabel || recUnit.name}: ${battleTracker.recordDefendedTurns} ターン守り抜いて討死（交戦 ${battleTracker.recordEngagements} 回）`;
    }
  }

  if (viewName) viewName.textContent = current.viewMode === "isometric" ? "斜め見下ろし" : "真上 2D";
  if (turnNumberEl) turnNumberEl.textContent = String(current.turnNumber);
  if (phaseNameEl) {
    phaseNameEl.textContent =
      playback.active && playback.mode === "enemy"
        ? "敵フェイズ"
        : activeScenario?.playerArmy || "自軍";
  }
  const sel = selectedUnitById(current);
  if (selectedUnitEl) selectedUnitEl.textContent = sel ? unitDisplayName(sel) : "なし";
  if (unitCountEl) unitCountEl.textContent = `${playersAlive + enemiesAlive}`;

  if (zoomLabel) zoomLabel.textContent = `${Math.round(currentZoom() * 100)}%`;
  if (zoomRange) zoomRange.value = String(Math.round(currentZoom() * 100));
  if (toggleViewButton) {
    toggleViewButton.textContent = current.viewMode === "isometric" ? "切替: 斜め見下ろし" : "切替: 真上 2D";
  }
  if (endTurnButton) {
    endTurnButton.disabled = battleTracker.resolved || autoState.enabled || current.phase !== "player";
  }
  statusLine.textContent = current.message;

  renderAbilityList(current);
  renderUnitPanel(current);
  renderFaceCard(current);
  updateAttackFxOverlay();
}

function renderStatBarHtml(label, value, kind) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return `
    <div class="statRow">
      <span class="statLabel">${escapeHtml(label)}</span>
      <div class="statBarTrack"><div class="statBarFill stat-${kind}" style="width:${pct}%"></div></div>
      <span class="statVal">${pct}</span>
    </div>
  `;
}

function renderFaceCard(current) {
  if (!unitFaceCard || !faceCardBody || !faceCardActions) return;
  if (!uiState.started || uiState.faceCardHidden || uiState.faceCardUnitId == null) {
    unitFaceCard.hidden = true;
    return;
  }

  const unit = current.units.find((u) => u.id === uiState.faceCardUnitId && u.hp > 0) ?? null;
  if (!unit) {
    unitFaceCard.hidden = true;
    return;
  }

  const isEnemy = unit.team === "enemy";
  const named = isNamedGeneral(unit);
  const hpPct = Math.max(0, Math.min(100, (unit.hp / Math.max(1, unit.maxHp)) * 100));
  const stats = unit.stats || { valor: 70, intellect: 60, leadership: 65 };
  const attackable = isEnemy && canPlayerAttackTarget(current, unit);

  unitFaceCard.hidden = false;
  unitFaceCard.classList.toggle("is-enemy", isEnemy);
  unitFaceCard.classList.toggle("is-player", !isEnemy);
  unitFaceCard.classList.toggle("is-named", named);
  unitFaceCard.classList.toggle("is-troop", !named);

  if (faceCardFaction) {
    const army = isEnemy ? activeScenario?.enemyArmy || "敵軍" : activeScenario?.playerArmy || "自軍";
    faceCardFaction.textContent = named
      ? `${army}・武将`
      : `${army}・${jobLabel(unit.job)}部隊`;
  }

  const statusText = isEnemy
    ? attackable
      ? "射程内・攻撃可"
      : "射程外"
    : unit.moved && unit.acted
      ? "行動済"
      : unit.moved
        ? "移動済・攻撃可"
        : unit.acted
          ? "攻撃済・移動可"
          : "行動可能";

  const portraitHtml = named ? renderPortraitHtml(unit, "card") : "";
  const troopBadgeHtml = !named
    ? `<span class="troopJobPill" title="兵種">${escapeHtml(jobLabel(unit.job))}</span>`
    : "";

  const uTile = tileAt(current.map, unit.x, unit.y);

  faceCardBody.innerHTML = `
    <div class="faceCardTop${named ? " has-portrait" : " no-portrait"}">
      ${portraitHtml}
      <div class="faceCardIdentity">
        <div class="unitHeaderLine">
          ${troopBadgeHtml}
          <span class="unitInfoTitle">${escapeHtml(unitDisplayName(unit))}</span>
          ${basisBadgeHtml(unit.basis)}
        </div>
        ${unit.role ? `<div class="unitRoleTag">${escapeHtml(unit.role)}</div>` : ""}
        <div class="faceCardMetaLine">${escapeHtml(jobLabel(unit.job))} ／ 攻${unit.atk} ・ 移${unit.mov} ・ 射${unit.range}</div>
        <div class="unitHpWrap faceCardHp">
          <div class="unitHpBar"><div class="unitHpFill${hpPct <= 35 ? " low" : ""}" style="width:${hpPct}%"></div></div>
          <div class="unitHpLabel">兵力 ${unit.hp} / ${unit.maxHp}（${statusText}）</div>
        </div>
      </div>
    </div>
    <div class="faceCardStats" title="能力値はゲーム上の表示専用数値">
      ${renderStatBarHtml("武力", stats.valor, "valor")}
      ${renderStatBarHtml("知力", stats.intellect, "intellect")}
      ${renderStatBarHtml("統率", stats.leadership, "leadership")}
    </div>
    ${isEnemy && uTile ? `<div class="unitTerrainBox">地形 (${unit.x},${unit.y}): ${escapeHtml(tileSummary(uTile))}</div>` : ""}
    ${unit.note ? `<div class="unitNote faceCardNote">${escapeHtml(unit.note)}</div>` : ""}
  `;

  if (named) {
    attachPortraitFallbacks(faceCardBody, unit, "card");
  }

  faceCardActions.innerHTML = "";
  if (isEnemy) {
    const atkBtn = document.createElement("button");
    atkBtn.type = "button";
    atkBtn.className = attackable ? "danger" : "secondary";
    atkBtn.textContent = attackable ? "攻撃する" : "射程外";
    atkBtn.disabled = battleTracker.resolved || autoState.enabled || !attackable;
    atkBtn.addEventListener("click", () => executePlayerAttack(unit));
    faceCardActions.appendChild(atkBtn);
    faceCardActions.hidden = false;
  } else {
    faceCardActions.hidden = true;
  }
}

function renderUnitPanel(current) {
  if (!unitInfo || !unitActions) return;
  if (unitCardOverlay) unitCardOverlay.hidden = Boolean(uiState.unitPanelHidden);

  const tile = selectedTileAt(current);
  const playerUnit = selectedPlayerUnit(current);

  if (!uiState.unitPanelHidden) {
    unitInfo.innerHTML = "";
    unitActions.innerHTML = "";

    if (!playerUnit) {
      const empty = document.createElement("div");
      empty.className = "unitInfoBody";
      empty.textContent = "自軍ユニットをタップしてください";
      unitInfo.appendChild(empty);
      if (tile) {
        const selTerrain = document.createElement("div");
        selTerrain.className = "unitTerrainBox";
        selTerrain.textContent = `地形 (${tile.x},${tile.y}): ${tileSummary(tile)}`;
        unitInfo.appendChild(selTerrain);
      }
    } else {
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
          <span class="unitQuickStatus">${statusText}</span>
        </div>
        <div class="unitTerrainBox">現在地 (${playerUnit.x},${playerUnit.y}): ${escapeHtml(tileSummary(pTile))}</div>
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
      moveBtn.disabled = battleTracker.resolved || autoState.enabled || playerUnit.moved || current.phase !== "player";
      moveBtn.addEventListener("click", beginMoveSelection);
      unitActions.appendChild(moveBtn);

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "secondary";
      const canUndo = Boolean(current.moveOrigin);
      cancelBtn.textContent = canUndo ? "移動を戻す" : "キャンセル";
      cancelBtn.disabled = battleTracker.resolved || autoState.enabled || !(isMoveMode(current) || canUndo);
      cancelBtn.addEventListener("click", cancelMoveSelection);
      unitActions.appendChild(cancelBtn);
    }
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
    btn.disabled = battleTracker.resolved || autoState.enabled || unit.acted || current.phase !== "player";
    btn.innerHTML = `<strong>${escapeHtml(ability.name)}</strong><small>射程 ${ability.range} / 消費 ${ability.cost}</small>`;
    btn.addEventListener("click", () => executeAbility(ability.id));
    abilityList.appendChild(btn);
  }
}

// =========================================================
// Audio UI Sync
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
  statusLine.textContent = `エラー: ${message}`;
  console.error("[SRPG Battles] error:", error);
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
if (startBattleBtn) {
  startBattleBtn.addEventListener("click", () => startBattle({ auto: false }));
}
if (startAutoBattleBtn) {
  startAutoBattleBtn.addEventListener("click", () => startBattle({ auto: true }));
}
if (autoToggleBtn) {
  autoToggleBtn.addEventListener("click", toggleAutoMode);
}
if (shareBattleBtn) {
  shareBattleBtn.addEventListener("click", shareCurrentBattle);
}
if (resultShareBtn) {
  resultShareBtn.addEventListener("click", shareCurrentBattle);
}
if (resultCutinSkip) {
  resultCutinSkip.addEventListener("click", showResultSummaryCard);
}
if (resultCutin) {
  resultCutin.addEventListener("click", showResultSummaryCard);
}
if (resultRetryAutoBtn) {
  resultRetryAutoBtn.addEventListener("click", () => {
    hideResultOverlay();
    resetCurrentScenario({ auto: true });
  });
}
if (resultRetryBtn) {
  resultRetryBtn.addEventListener("click", () => {
    hideResultOverlay();
    resetCurrentScenario({ auto: false });
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
if (faceCardClose) {
  faceCardClose.addEventListener("click", () => {
    uiState.faceCardHidden = true;
    soundPlay("ui");
    lastHudSignature = "";
    safeRender();
  });
}
if (abilityCutinOverlay) {
  abilityCutinOverlay.addEventListener("click", (event) => {
    event.stopPropagation();
    dismissAbilityCutin(true);
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
  if (cutinState.active && (event.key === "Escape" || event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    dismissAbilityCutin(true);
    return;
  }
  if (event.key === "Escape") {
    if (helpOverlay && !helpOverlay.hidden) {
      helpOverlay.hidden = true;
      return;
    }
    if (resultCutin && !resultCutin.hidden) {
      showResultSummaryCard();
      return;
    }
    if (autoState.enabled && uiState.started && !battleTracker.resolved) {
      soundPlay("ui");
      requestManualReturn("キー入力");
      return;
    }
    if (getCurrentState().interactionMode === "move" || getCurrentState().moveOrigin) {
      cancelMoveSelection();
    }
  } else if (!uiState.started || battleTracker.resolved) {
    return;
  } else if (
    autoState.enabled &&
    (!helpOverlay || helpOverlay.hidden) &&
    !["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab"].includes(event.key)
  ) {
    soundPlay("ui");
    requestManualReturn("キー入力");
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

async function loadScenarioMarkdown(slug) {
  const mdUrl = new URL(`./scenarios/${slug}.md`, appScriptUrl);
  const resp = await fetch(mdUrl);
  if (!resp.ok) {
    throw new Error(`シナリオファイルが見つかりません: ${slug}.md (${resp.status})`);
  }
  const mdText = await resp.text();
  if (!window.srpgScenarioParser) {
    throw new Error("scenario_parser.js が読み込まれていません");
  }
  const parsed = window.srpgScenarioParser.parseScenarioMarkdown(mdText);
  return {
    parsed,
    wasmJson: window.srpgScenarioParser.toWasmScenarioJson(parsed),
  };
}

window.addEventListener("error", (event) => {
  if (!startupError) showStartupError(event.error ?? event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  if (!startupError) showStartupError(event.reason ?? "unhandled rejection");
});

window.srpgUi = {
  toggleView: toggleViewMode,
  toggleAuto: toggleAutoMode,
  startBattle,
  startAuto: () => startBattle({ auto: true }),
  stopAuto: () => requestManualReturn("API"),
  zoomIn: () => setZoom(uiState.zoom + ZOOM_STEP, true),
  zoomOut: () => setZoom(uiState.zoom - ZOOM_STEP, true),
  zoomReset: () => setZoom(defaultZoom(), false),
  endTurn: runTurnEnd,
  reset: resetCurrentScenario,
  share: shareCurrentBattle,
  getScenario: () => activeScenario,
};

async function boot() {
  syncAudioUi();
  if (startBattleBtn) startBattleBtn.disabled = true;
  if (startAutoBattleBtn) startAutoBattleBtn.disabled = true;

  try {
    const [{ parsed, wasmJson }] = await Promise.all([
      loadScenarioMarkdown(uiState.slug),
      connectBridge().catch((err) => {
        console.warn("[SRPG Battles] WASM fallback to local JS:", err);
      }),
    ]);

    activeScenario = parsed;
    activeWasmJson = wasmJson;
    activeAiConfig = buildAiConfig(parsed);
    state = buildLocalStateFromScenario(parsed);

    populateScenarioUi(parsed);
    loadScenarioIntoEngine();
    resetBattleTracker();

    const cur = getCurrentState();
    setZoom(computeAutoZoom(cur.map.width, cur.map.height), false);

    if (startBattleBtn) startBattleBtn.disabled = false;
    if (startAutoBattleBtn) startAutoBattleBtn.disabled = false;
    if (bootStatus) bootStatus.textContent = `boot: ready (${parsed.slug}, wasm=${bridge.useWasm})`;

    startRenderLoop();

    const params = new URLSearchParams(window.location.search);
    if (params.get("auto") === "1") {
      startBattle({ auto: true });
    }
  } catch (err) {
    showStartupError(err);
  }
}

boot();
