const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
const toggleViewButton = document.getElementById("toggleView");
const toggleBoxButton = document.getElementById("toggleBox");
const zoomOutButton = document.getElementById("zoomOut");
const zoomResetButton = document.getElementById("zoomReset");
const zoomInButton = document.getElementById("zoomIn");
const zoomRange = document.getElementById("zoomRange");
const zoomLabel = document.getElementById("zoomLabel");
const endTurnButton = document.getElementById("endTurn");
const resetViewButton = document.getElementById("resetView");
const viewName = document.getElementById("viewName");
const turnNumber = document.getElementById("turnNumber");
const phaseName = document.getElementById("phaseName");
const selectedUnit = document.getElementById("selectedUnit");
const unitCount = document.getElementById("unitCount");
const abilityList = document.getElementById("abilityList");
const unitInfo = document.getElementById("unitInfo");
const unitActions = document.getElementById("unitActions");
const unitCardOverlay = document.querySelector(".unitCardOverlay");
const bootStatus = document.getElementById("bootStatus");
const inputProbe = document.getElementById("inputProbe");
const statusLine = document.createElement("p");

const TILE_SIZE = 72;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.25;
const ZOOM_STEP = 0.05;
const COLORS = {
  player: "#f3d36c",
  enemy: "#78e4ff",
  playerDead: "#75643f",
  enemyDead: "#3d5d6d",
};

statusLine.className = "statusLine";
document.querySelector(".panel").appendChild(statusLine);
if (bootStatus) bootStatus.textContent = "boot: app.js loaded";

const bridge = {
  useWasm: false,
  instance: null,
};

const frame = {
  unitHitboxes: [],
};

const uiState = {
  boxMode: "open",
  zoom: window.matchMedia("(max-width: 768px)").matches ? 0.75 : 1,
};

const state = createInitialState();
let startupError = null;
const DEBUG = true;
const animation = {
  active: false,
  startedAt: 0,
  duration: 320,
  unitPaths: new Map(),
  rafId: 0,
};

function createInitialState() {
  return {
    viewMode: "isometric",
    turnNumber: 1,
    phase: "player",
    selectedUnitId: 1,
    selectedTile: { x: 2, y: 2 },
    interactionMode: null,
    moveOrigin: null,
    message: "自軍を選択してください",
    map: buildDemoMap(),
    units: [
      makeUnit(1, 1, "Ashigaru", 2, 2, COLORS.player, "player", 4, 1, 100, 14, true),
      makeUnit(2, 1, "Yumi", 1, 5, COLORS.player, "player", 4, 3, 80, 12),
      makeUnit(3, 2, "Teppo", 6, 2, COLORS.enemy, "enemy", 3, 2, 90, 13, true),
      makeUnit(4, 2, "Ninja", 6, 5, COLORS.enemy, "enemy", 4, 1, 70, 11),
    ],
  };
}

function makeUnit(id, clan, job, x, y, color, team, mov, range, hp, atk, leader = false) {
  return {
    id,
    clan,
    job,
    x,
    y,
    color,
    team,
    mov,
    range,
    hp,
    maxHp: hp,
    atk,
    moved: false,
    acted: false,
    leader,
  };
}

function resetGame() {
  const fresh = createInitialState();
  Object.assign(state, fresh);
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
        tile = {
          terrain: "Terrace",
          height: x - 4 + Math.floor(y / 2),
          cover: x === 6,
          water: false,
        };
      } else if (x === 1 && y === 1) {
        tile = { terrain: "Castle", height: 3, cover: true, water: false };
      } else if (x <= 2 && y <= 2) {
        tile = {
          terrain: "Town",
          height: y === 2 ? 1 : 0,
          cover: x % 2 === 0 && y % 2 === 0,
          water: false,
        };
      } else {
        tile = {
          terrain: "Plain",
          height: 0,
          cover: (x + y) % 3 === 0,
          water: false,
        };
      }

      tiles.push({ x, y, ...tile });
    }
  }

  return { width, height, tiles };
}

function terrainColor(tile) {
  switch (tile.terrain) {
    case "Castle":
      return tile.height > 0 ? "#939da9" : "#7d8794";
    case "Town":
      return "#7b5844";
    case "RiceField":
      return "#4e97db";
    case "Terrace":
      return "#82744d";
    case "Road":
      return "#ae9b71";
    default:
      return "#355438";
  }
}

function terrainCost(tile) {
  switch (tile.terrain) {
    case "Road":
      return 1;
    case "Town":
      return 2;
    case "Castle":
      return 2;
    case "RiceField":
      return 3;
    case "Terrace":
      return 2;
    case "Plain":
      return 1;
    default:
      return 2;
  }
}

function tileStroke(tile) {
  if (tile.water) return "rgba(204, 236, 255, 0.35)";
  if (tile.cover) return "rgba(255, 255, 255, 0.18)";
  return "rgba(0, 0, 0, 0.32)";
}

function terrainLabel(terrain) {
  switch (terrain) {
    case "Castle":
      return "城";
    case "Town":
      return "城下町";
    case "RiceField":
      return "田んぼ";
    case "Terrace":
      return "段々畑";
    case "Road":
      return "道";
    default:
      return "平地";
  }
}

function tileSummary(tile) {
  if (!tile) return "タイル情報なし";

  const traits = [];
  if (tile.cover) traits.push("遮蔽あり");
  if (tile.water) traits.push("水地");
  if (tile.height > 0) traits.push(`高さ +${tile.height}`);

  return `${terrainLabel(tile.terrain)} / 移動コスト ${terrainCost(tile)}${traits.length > 0 ? ` / ${traits.join(" / ")}` : ""}`;
}

function clampZoom(value) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value));
}

function setZoom(value) {
  uiState.zoom = clampZoom(value);
  if (zoomRange) {
    zoomRange.value = String(Math.round(uiState.zoom * 100));
  }
  if (zoomLabel) {
    zoomLabel.textContent = `${Math.round(uiState.zoom * 100)}%`;
  }
  safeRender();
}

function adjustZoom(delta) {
  setZoom(uiState.zoom + delta);
}

function currentZoom() {
  return clampZoom(uiState.zoom);
}

function tileAt(map, x, y) {
  return map.tiles.find((tile) => tile.x === x && tile.y === y) ?? null;
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

function getCurrentState() {
  if (bridge.useWasm && bridge.instance) {
    const raw = bridge.instance.get_render_data();
    try {
      return normalizeSnapshot(JSON.parse(raw));
    } catch {
      return state;
    }
  }

  return state;
}

function snapshotState(current) {
  return {
    viewMode: current.viewMode,
    turnNumber: current.turnNumber,
    phase: current.phase,
    selectedUnitId: current.selectedUnitId,
    selectedTile: current.selectedTile ? { ...current.selectedTile } : null,
    interactionMode: current.interactionMode ?? null,
    message: current.message,
    map: current.map,
    units: current.units.map((unit) => ({ ...unit })),
  };
}

function startUnitAnimation(fromState, toState) {
  const unitPaths = new Map();
  for (const unit of toState.units) {
    const prev = fromState.units.find((candidate) => candidate.id === unit.id);
    if (!prev || (prev.x === unit.x && prev.y === unit.y)) continue;

    const fromTile = tileAt(fromState.map, prev.x, prev.y);
    const toTile = tileAt(toState.map, unit.x, unit.y);
    if (!fromTile || !toTile) continue;

    unitPaths.set(unit.id, {
      from: tileToScreen(fromTile, fromState),
      to: tileToScreen(toTile, toState),
    });
  }

  if (unitPaths.size === 0) {
    animation.active = false;
    animation.unitPaths = new Map();
    if (animation.rafId) {
      cancelAnimationFrame(animation.rafId);
      animation.rafId = 0;
    }
    return false;
  }

  animation.active = true;
  animation.startedAt = performance.now();
  animation.unitPaths = unitPaths;
  debugLog("animation started", {
    movedUnits: [...unitPaths.keys()],
  });
  if (!animation.rafId) {
    animation.rafId = requestAnimationFrame(function animateFrame() {
      animation.rafId = 0;
      if (!animation.active) return;
      safeRender();
      if (animation.active) {
        animation.rafId = requestAnimationFrame(animateFrame);
      }
    });
  }
  return true;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function animatedUnitPosition(unit, current, t) {
  const path = animation.unitPaths.get(unit.id);
  if (!path) return null;

  return {
    x: path.from.x + (path.to.x - path.from.x) * t,
    y: path.from.y + (path.to.y - path.from.y) * t,
  };
}

function animationProgress() {
  if (!animation.active) return 1;

  const elapsed = performance.now() - animation.startedAt;
  const t = Math.max(0, Math.min(1, elapsed / animation.duration));
  if (t >= 1) {
    animation.active = false;
    animation.unitPaths = new Map();
    debugLog("animation complete");
  }
  return easeOutCubic(t);
}

function animatedStateFor(current) {
  if (!animation.active) return current;
  return current;
}

function normalizeSnapshot(snapshot) {
  const tiles = snapshot?.map?.tiles ?? [];
  const units = snapshot?.units ?? [];

  return {
    viewMode: snapshot?.view_mode ?? state.viewMode,
    turnNumber: snapshot?.turn_number ?? 1,
    phase: snapshot?.phase ?? "player",
    selectedUnitId: snapshot?.selected_unit_id ?? null,
    interactionMode: snapshot?.interaction_mode ?? null,
    selectedTile: snapshot?.selected_tile ?? null,
    message: snapshot?.message ?? "wasm bridge connected",
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
      })),
    },
    units: units.map((unit) => ({
      id: unit.id ?? 0,
      clan: unit.clan ?? 0,
      job: unit.job ?? "Ashigaru",
      x: unit.x ?? 0,
      y: unit.y ?? 0,
      color: unit.clan === 2 ? COLORS.enemy : COLORS.player,
      team: unit.clan === 2 ? "enemy" : "player",
      mov: 4,
      range: 1,
      hp: 100,
      maxHp: 100,
      atk: 10,
      moved: Boolean(unit.moved),
      acted: Boolean(unit.acted),
      leader: Boolean(unit.leader ?? (unit.id === 1 || unit.id === 3)),
    })),
    moveTiles: (snapshot?.move_tiles ?? []).map((tile) => `${tile.x},${tile.y}`),
    attackTiles: (snapshot?.attack_tiles ?? []).map((tile) => `${tile.x},${tile.y}`),
    selectedTile: snapshot?.selected_tile ?? null,
    isPlayerTurn: Boolean(snapshot?.is_player_turn),
    unitCount: snapshot?.unit_count ?? units.length,
    abilities: snapshot?.abilities ?? [],
  };
}

function viewOrigin(current) {
  const zoom = currentZoom();
  if (current.viewMode === "topdown") {
    const mapPixelWidth = current.map.width * TILE_SIZE * zoom;
    return {
      x: Math.max(24, (canvas.clientWidth - mapPixelWidth) / 2),
      y: Math.max(40, 76 * zoom),
    };
  }

  return {
    x: canvas.clientWidth / 2,
    y: Math.max(48, 104 * zoom),
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
  const isoY = (tile.x + tile.y) * (size / 4) - tile.height * (size / 3);
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
    const da = current.viewMode === "isometric" ? a.x + a.y + a.height : a.y;
    const db = current.viewMode === "isometric" ? b.x + b.y + b.height : b.y;
    return db - da;
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
    } else if (hitIsoTile(point, pos, tile.height)) {
      return tile;
    }
  }

  return null;
}

function hitIsoTile(point, pos, height) {
  return pointInPolygon(point, isoPolygon(pos));
}

function reachableTiles(unit, current) {
  const queue = [{ x: unit.x, y: unit.y, cost: 0 }];
  const best = new Map();
  best.set(`${unit.x},${unit.y}`, 0);

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const node = queue.shift();
    const dirs = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];

    for (const [dx, dy] of dirs) {
      const x = node.x + dx;
      const y = node.y + dy;
      const tile = tileAt(current.map, x, y);
      if (!tile) continue;

      const occupied = unitAt(current.units, x, y);
      if (occupied && occupied.id !== unit.id) continue;

      const nextCost = node.cost + terrainCost(tile);
      const key = `${x},${y}`;
      if (nextCost > unit.mov) continue;
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
    const dist = Math.abs(target.x - unit.x) + Math.abs(target.y - unit.y);
    return dist <= unit.range;
  });
}

function moveUnit(unit, tile, current) {
  unit.x = tile.x;
  unit.y = tile.y;
  unit.moved = true;
  state.selectedTile = { x: tile.x, y: tile.y };
  state.moveOrigin = null;
  state.message = `${unit.job} が ${tile.x},${tile.y} へ移動`;
  debugLog("moveUnit", { unitId: unit.id, job: unit.job, x: tile.x, y: tile.y });
}

function damageUnit(target, amount) {
  target.hp = Math.max(0, target.hp - amount);
}

function attackUnit(attacker, target) {
  damageUnit(target, attacker.atk);
  attacker.acted = true;
  state.message = `${attacker.job} が ${target.job} に ${attacker.atk} ダメージ`;
  if (target.hp <= 0) {
    state.message += " / 撃破";
  }
}

function unitBadgeText(unit) {
  switch (unit.job) {
    case "Ashigaru":
      return "足";
    case "Yumi":
      return "弓";
    case "Teppo":
      return "鉄";
    case "Ninja":
      return "忍";
    case "Strategist":
      return "軍";
    default:
      return String(unit.id);
  }
}

function selectedPlayerUnit(current) {
  if (current.selectedUnitId == null) return null;
  return current.units.find((unit) => unit.id === current.selectedUnitId && unit.hp > 0) ?? null;
}

function selectedUnitById(current) {
  if (current.selectedUnitId == null) return null;
  return current.units.find((unit) => unit.id === current.selectedUnitId && unit.hp > 0) ?? null;
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
  if (!target || target.team !== "enemy") return false;
  const attacker = selectedPlayerUnit(current);
  if (!attacker || attacker.acted || attacker.hp <= 0 || current.phase !== "player") return false;
  const dist = Math.abs(target.x - attacker.x) + Math.abs(target.y - attacker.y);
  return dist <= attacker.range;
}

function attackSelectedTarget(current = state) {
  const attacker = selectedPlayerUnit(current);
  const target = selectedTileUnit(current);
  if (!attacker || !target || target.team !== "enemy") return false;
  if (!canPlayerAttackTarget(current, target)) {
    state.message = "攻撃範囲外です";
    safeRender();
    return false;
  }

  attackUnit(attacker, target);
  state.selectedTile = { x: target.x, y: target.y };
  state.moveOrigin = null;
  safeRender();
  return true;
}

function abilitiesForCurrent(current) {
  if (Array.isArray(current.abilities) && current.abilities.length > 0) {
    return current.abilities;
  }

  const selected = selectedPlayerUnit(current);
  if (!selected) return [];

  switch (selected.job) {
    case "Ashigaru":
      return [{ id: 0, name: "押し込み", range: 1, cost: 2 }];
    case "Yumi":
      return [{ id: 0, name: "曲射", range: 4, cost: 3 }];
    case "Teppo":
      return [{ id: 0, name: "火縄チャージ", range: 5, cost: 4 }];
    case "Ninja":
      return [{ id: 0, name: "煙玉", range: 0, cost: 2 }];
    case "Strategist":
      return [{ id: 0, name: "陣形変更", range: 2, cost: 3 }];
    default:
      return [];
  }
}

function selectFirstPlayerUnit() {
  const first = currentPlayerUnits(state.units)[0] ?? null;
  state.selectedUnitId = first ? first.id : null;
  state.interactionMode = null;
  state.selectedTile = first ? { x: first.x, y: first.y } : null;
  state.moveOrigin = null;
}

function startPlayerTurn() {
  for (const unit of state.units) {
    if (unit.team === "player") {
      unit.moved = false;
      unit.acted = false;
    }
  }
  state.phase = "player";
  state.message = "自軍の行動です";
  selectFirstPlayerUnit();
}

function endPlayerTurn() {
  if (state.phase !== "player") return;
  state.phase = "enemy";
  state.message = "敵の行動中";
  state.selectedUnitId = null;
  state.interactionMode = null;
  state.selectedTile = null;
  state.moveOrigin = null;
  runEnemyTurn();
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

    const dirs = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];

    for (const [dx, dy] of dirs) {
      const x = node.x + dx;
      const y = node.y + dy;
      const tile = tileAt(current.map, x, y);
      if (!tile) continue;

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

function runEnemyTurn() {
  const current = state;
  const players = currentPlayerUnits(current.units);
  const enemies = currentEnemyUnits(current.units);

  for (const enemy of enemies) {
    if (players.length === 0) break;

    let nearest = players[0];
    let nearestDistance = Math.abs(nearest.x - enemy.x) + Math.abs(nearest.y - enemy.y);
    for (const candidate of players.slice(1)) {
      const distance = Math.abs(candidate.x - enemy.x) + Math.abs(candidate.y - enemy.y);
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }

    let steps = enemy.mov;
    while (steps > 0) {
      const next = shortestPathStep({ x: enemy.x, y: enemy.y }, nearest, current, enemy.id);
      if (!next || (next.x === enemy.x && next.y === enemy.y)) break;
      if (unitAt(current.units, next.x, next.y) && !(next.x === nearest.x && next.y === nearest.y)) break;
      enemy.x = next.x;
      enemy.y = next.y;
      steps -= 1;
    }

    const dist = Math.abs(nearest.x - enemy.x) + Math.abs(nearest.y - enemy.y);
    if (dist <= enemy.range) {
      damageUnit(nearest, enemy.atk);
      state.message = `${enemy.job} が ${nearest.job} に ${enemy.atk} ダメージ`;
      if (nearest.hp <= 0) {
        state.message += " / 撃破";
      }
    }
  }

  state.turnNumber += 1;
  startPlayerTurn();
  if (currentPlayerUnits(state.units).length === 0) {
    state.phase = "gameover";
    state.message = "敗北";
    state.selectedUnitId = null;
  }
}

function handlePlayerClick(tile, current) {
  const selected = selectedPlayerUnit(current);
  const clickedUnit = unitAt(current.units, tile.x, tile.y);

  if (clickedUnit && clickedUnit.team === "player") {
    state.selectedUnitId = clickedUnit.id;
    state.interactionMode = null;
    state.selectedTile = { x: tile.x, y: tile.y };
    state.moveOrigin = null;
    state.message = `${clickedUnit.job} を選択`;
    return;
  }

  if (clickedUnit && clickedUnit.team === "enemy") {
    const sameTile = Boolean(current.selectedTile && current.selectedTile.x === tile.x && current.selectedTile.y === tile.y);
    state.selectedTile = { x: tile.x, y: tile.y };
    if (selected && sameTile && canPlayerAttackTarget(current, clickedUnit)) {
      attackUnit(selected, clickedUnit);
      state.moveOrigin = null;
      state.message = `${selected.job} が ${clickedUnit.job} を攻撃`;
    } else {
      state.message = `${clickedUnit.job} を確認`;
    }
    return;
  }

  if (!selected) return;

  if (!isMoveMode(current)) {
    state.selectedTile = { x: tile.x, y: tile.y };
    state.message = "移動は『移動』ボタンから開始してください";
    return;
  }

  const moveTiles = reachableTiles(selected, current);
  if (moveTiles.has(`${tile.x},${tile.y}`) && !clickedUnit && !selected.moved) {
    debugLog("handlePlayerClick move accepted", {
      selectedUnitId: selected.id,
      target: { x: tile.x, y: tile.y },
    });
    moveUnit(selected, tile, current);
    state.selectedUnitId = selected.id;
    state.interactionMode = null;
    state.selectedTile = { x: tile.x, y: tile.y };
    return;
  }

  state.selectedTile = { x: tile.x, y: tile.y };
  state.message = "移動先を選択してください";
}

function handleCanvasClick(event) {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const point = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
  const current = getCurrentState();
  markInput(`${event.type} on ${describeTarget(event)}`);
  debugLog("canvas input", {
    type: event.type,
    target: describeTarget(event),
    point: { x: Math.round(point.x), y: Math.round(point.y) },
    phase: current.phase,
    viewMode: current.viewMode,
    wasm: bridge.useWasm,
  });
  statusLine.textContent = `クリック: ${Math.round(point.x)}, ${Math.round(point.y)}`;
  const hitUnit = hitTestUnit(point, current);
  if (hitUnit) {
    debugLog("canvas hit unit", { unitId: hitUnit.id, tileX: hitUnit.tileX, tileY: hitUnit.tileY });
    if (bridge.useWasm && bridge.instance) {
      bridge.instance.click_tile(hitUnit.tileX, hitUnit.tileY);
      debugLog("canvas forwarded unit click to wasm");
      safeRender();
      return;
    }

    if (state.phase !== "player") {
      debugLog("canvas ignored unit click because phase is not player", state.phase);
      return;
    }
    handlePlayerClick({ x: hitUnit.tileX, y: hitUnit.tileY }, state);
    debugLog("canvas handled unit click locally");
    safeRender();
    return;
  }

  const tile = screenToTile(point, current);
  if (!tile) {
    debugLog("canvas click outside map");
    if (!bridge.useWasm) {
      state.message = "マップ外をクリックしました";
      safeRender();
    }
    return;
  }
  debugLog("canvas hit tile", { x: tile.x, y: tile.y, terrain: tile.terrain });
  if (bridge.useWasm && bridge.instance) {
    bridge.instance.click_tile(tile.x, tile.y);
    debugLog("canvas forwarded tile click to wasm");
    safeRender();
    return;
  }
  if (state.phase !== "player") {
    debugLog("canvas ignored tile click because phase is not player", state.phase);
    return;
  }
  handlePlayerClick(tile, state);
  debugLog("canvas handled tile click locally");
  safeRender();
}

function terrainBadge(tile) {
  if (tile.water) return "水";
  if (tile.cover) return "隠";
  return "";
}

function shadeColor(hex, percent) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const mix = (channel) => Math.max(0, Math.min(255, Math.round(channel + (255 - channel) * percent)));
  const darken = (channel) => Math.max(0, Math.min(255, Math.round(channel * (1 + percent))));
  const rr = percent >= 0 ? mix(r) : darken(r);
  const gg = percent >= 0 ? mix(g) : darken(g);
  const bb = percent >= 0 ? mix(b) : darken(b);
  return `rgb(${rr}, ${gg}, ${bb})`;
}

function overlayColor(key, current, overlays) {
  if (current.selectedTileKey === key) return "rgba(255, 214, 102, 0.24)";
  if (overlays.attack.has(key)) return "rgba(255, 103, 103, 0.24)";
  if (overlays.move.has(key)) return "rgba(89, 177, 255, 0.28)";
  return null;
}

function drawTopDownTile(tile, pos, current, overlays) {
  const zoom = pos.size / TILE_SIZE;
  const size = pos.size - Math.max(2, Math.round(2 * zoom));
  const heightPx = (10 + Math.max(0, tile.height) * 6) * zoom;
  const key = `${tile.x},${tile.y}`;
  const base = terrainColor(tile);
  const side = shadeColor(base, -0.26);
  const side2 = shadeColor(base, -0.15);
  const top = { x: pos.x, y: pos.y };
  const overlay = overlayColor(key, current, overlays);

  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(top.x, top.y + size);
  ctx.lineTo(top.x + size, top.y + size);
  ctx.lineTo(top.x + size, top.y + size + heightPx);
  ctx.lineTo(top.x, top.y + size + heightPx);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = side2;
  ctx.beginPath();
  ctx.moveTo(top.x + size, top.y);
  ctx.lineTo(top.x + size, top.y + size);
  ctx.lineTo(top.x + size, top.y + size + heightPx);
  ctx.lineTo(top.x + size + heightPx * 0.55, top.y + size + heightPx * 0.4);
  ctx.lineTo(top.x + size + heightPx * 0.55, top.y + heightPx * 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = base;
  ctx.fillRect(top.x, top.y, size, size);

  if (overlay) {
    ctx.fillStyle = overlay;
    ctx.fillRect(top.x, top.y, size, size);
  }

  ctx.strokeStyle = tileStroke(tile);
  ctx.strokeRect(top.x + 0.5, top.y + 0.5, size, size);

  if (heightPx > 10) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.fillRect(top.x, top.y + size - 6 * zoom, size, 6 * zoom);
  }

  if (tile.height > 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.font = `bold ${Math.max(9, 13 * zoom)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(String(tile.height), top.x + 8 * zoom, top.y + 18 * zoom);
  }

  if (terrainBadge(tile)) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.54)";
    ctx.font = `bold ${Math.max(8, 11 * zoom)}px sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(terrainBadge(tile), top.x + size - 10 * zoom, top.y + size - 10 * zoom);
  }
}

function drawIsoTile(tile, pos, current, overlays) {
  const size = pos.size;
  const polygon = isoPolygon(pos);
  const key = `${tile.x},${tile.y}`;
  const base = terrainColor(tile);
  const leftShade = shadeColor(base, -0.24);
  const rightShade = shadeColor(base, -0.14);
  const topShade = shadeColor(base, 0.06);
  const zoom = pos.size / TILE_SIZE;
  const heightPx = (11 + Math.max(0, tile.height) * 8) * zoom;
  const overlay = overlayColor(key, current, overlays);

  if (uiState.boxMode === "closed") {
    ctx.fillStyle = shadeColor(base, -0.34);
    ctx.beginPath();
    ctx.moveTo(polygon[3].x, polygon[3].y);
    ctx.lineTo(polygon[2].x, polygon[2].y);
    ctx.lineTo(polygon[2].x, polygon[2].y + heightPx);
    ctx.lineTo(polygon[3].x, polygon[3].y + heightPx);
    ctx.closePath();
    ctx.fill();
  }

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
  ctx.moveTo(polygon[1].x, polygon[1].y);
  ctx.lineTo(polygon[2].x, polygon[2].y);
  ctx.lineTo(polygon[2].x, polygon[2].y + heightPx);
  ctx.lineTo(polygon[1].x, polygon[1].y + heightPx);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = topShade;
  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let i = 1; i < polygon.length; i += 1) {
    ctx.lineTo(polygon[i].x, polygon[i].y);
  }
  ctx.closePath();
  ctx.fill();

  if (overlay) {
    ctx.fillStyle = overlay;
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i += 1) {
      ctx.lineTo(polygon[i].x, polygon[i].y);
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let i = 1; i < polygon.length; i += 1) {
    ctx.lineTo(polygon[i].x, polygon[i].y);
  }
  ctx.closePath();
  ctx.strokeStyle = tileStroke(tile);
  ctx.stroke();

  if (tile.height > 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.beginPath();
    ctx.moveTo(polygon[1].x, polygon[1].y + 2);
    ctx.lineTo(polygon[2].x - 4, polygon[2].y - 2);
    ctx.lineTo(polygon[3].x, polygon[3].y - 2);
    ctx.lineTo(polygon[0].x + 4, polygon[0].y - 2);
    ctx.closePath();
    ctx.fill();
  }
}

function drawUnit(unit, current, progress = 1) {
  if (unit.hp <= 0) return;
  const tile = tileAt(current.map, unit.x, unit.y);
  if (!tile) return;

  const path = animation.active ? animation.unitPaths.get(unit.id) : null;
  const pos = path
    ? {
        x: path.from.x + (path.to.x - path.from.x) * progress,
        y: path.from.y + (path.to.y - path.from.y) * progress,
        size: TILE_SIZE,
      }
    : tileToScreen(tile, current);
  const zoom = pos.size / TILE_SIZE;
  const x = current.viewMode === "topdown" ? pos.x + pos.size / 2 - 1 : pos.x + pos.size / 2;
  const y = path
    ? pos.y + 11 * zoom
    : current.viewMode === "topdown"
      ? pos.y + 14 * zoom - Math.max(0, tile.height) * 1.5 * zoom
      : pos.y + 11 * zoom - Math.max(0, tile.height) * 4.5 * zoom;
  const radius = (current.viewMode === "topdown" ? 12 : 10) * zoom;
  frame.unitHitboxes.push({
    id: unit.id,
    tileX: unit.x,
    tileY: unit.y,
    x,
    y,
    radius: radius + 10,
  });

  ctx.beginPath();
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.ellipse(x, y + 11 * zoom, radius + 3 * zoom, 5 * zoom, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = unit.color;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = unit.team === "player" ? "rgba(0, 0, 0, 0.55)" : "rgba(255, 255, 255, 0.35)";
  ctx.stroke();

  if (unit.leader) {
    ctx.beginPath();
    ctx.strokeStyle = unit.team === "player" ? "rgba(255, 214, 102, 0.95)" : "rgba(120, 228, 255, 0.95)";
    ctx.lineWidth = 3;
    ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  ctx.fillStyle = "#08111b";
  ctx.font = `bold ${Math.max(9, 13 * zoom)}px "Noto Sans JP", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(unitBadgeText(unit), x, y + 4 * zoom);

  const barW = 30 * zoom;
  const hpPct = unit.hp / unit.maxHp;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(x - barW / 2, y + 11 * zoom, barW, 5 * zoom);
  ctx.fillStyle = unit.team === "player" ? "#83ffb7" : "#ff8b8b";
  ctx.fillRect(x - barW / 2, y + 11 * zoom, barW * hpPct, 5 * zoom);
}

function hitTestUnit(point, current) {
  let best = null;
  let bestDist = Infinity;

  for (const hit of frame.unitHitboxes) {
    const dx = point.x - hit.x;
    const dy = point.y - hit.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= hit.radius && dist < bestDist) {
      const unit = unitAt(current.units, hit.tileX, hit.tileY);
      if (!unit || unit.hp <= 0) continue;
      best = { ...hit, unit };
      bestDist = dist;
    }
  }

  return best;
}

function selectedTileKey(current) {
  if (current.selectedTile) {
    return `${current.selectedTile.x},${current.selectedTile.y}`;
  }
  const selected = selectedPlayerUnit(current);
  return selected ? `${selected.x},${selected.y}` : null;
}

function drawHud(current) {
  viewName.textContent = current.viewMode;
  turnNumber.textContent = String(current.turnNumber);
  phaseName.textContent = current.phase;
  selectedUnit.textContent = current.selectedUnitId ?? "なし";
  unitCount.textContent = String(current.unitCount ?? current.units.filter((unit) => unit.hp > 0).length);
  if (zoomLabel) {
    zoomLabel.textContent = `${Math.round(currentZoom() * 100)}%`;
  }
  if (zoomRange) {
    zoomRange.value = String(Math.round(currentZoom() * 100));
  }
  toggleViewButton.textContent =
    current.viewMode === "isometric" ? "切替: 斜め見下ろし" : "切替: 真上 2D";
  if (toggleBoxButton) {
    toggleBoxButton.textContent = uiState.boxMode === "closed" ? "箱: 閉じる" : "箱: 開く";
  }
  statusLine.textContent = bridge.useWasm ? `wasm bridge connected / ${current.message}` : current.message;
  endTurnButton.disabled = !current.isPlayerTurn && current.phase !== "player";
  renderAbilityList(current);
  renderUnitPanel(current);
}

function renderUnitPanel(current) {
  if (!unitInfo || !unitActions) return;

  const unit = selectedPlayerUnit(current);
  const tile = selectedTileAt(current);
  const tileUnit = selectedTileUnit(current);
  if (unitCardOverlay) {
    unitCardOverlay.classList.toggle("unitCardOverlayEnemy", Boolean(tileUnit && tileUnit.team === "enemy" && !unit));
  }
  unitInfo.innerHTML = "";
  unitActions.innerHTML = "";

  if (!unit) {
    const empty = document.createElement("div");
    empty.className = "statusLine";
    empty.textContent = "ユニットをタップしてください";
    unitInfo.appendChild(empty);
  } else {
    const title = document.createElement("div");
    title.className = "unitInfoTitle";
    title.textContent = `${unit.job}${unit.leader ? " / 部隊長" : ""}`;
    unitInfo.appendChild(title);

    const summary = document.createElement("div");
    summary.className = "unitInfoBody";
    summary.textContent = `${unit.team === "player" ? "自軍" : "敵軍"} / HP ${unit.hp}/${unit.maxHp} / 移動 ${unit.mov} / 射程 ${unit.range}`;
    unitInfo.appendChild(summary);

    const coords = document.createElement("div");
    coords.className = "unitInfoBody";
    coords.textContent = `位置 ${unit.x}, ${unit.y}`;
    unitInfo.appendChild(coords);
  }

  const tileTitle = document.createElement("div");
  tileTitle.className = "unitInfoTitle";
  tileTitle.textContent = tileUnit ? "タイル / ユニット" : "タイル";
  unitInfo.appendChild(tileTitle);

  const tileSummaryLine = document.createElement("div");
  tileSummaryLine.className = "unitInfoBody";
  if (tile) {
    tileSummaryLine.textContent = `${terrainLabel(tile.terrain)} / 座標 ${tile.x}, ${tile.y}`;
  } else {
    tileSummaryLine.textContent = "タイル未選択";
  }
  unitInfo.appendChild(tileSummaryLine);

  if (tile) {
    const tileDetail = document.createElement("div");
    tileDetail.className = "unitInfoBody";
    tileDetail.textContent = tileSummary(tile);
    unitInfo.appendChild(tileDetail);
  }

  if (tileUnit && tileUnit.team === "enemy") {
    const enemyTitle = document.createElement("div");
    enemyTitle.className = "unitInfoTitle";
    enemyTitle.textContent = `${tileUnit.job}${tileUnit.leader ? " / 部隊長" : ""}`;
    unitInfo.appendChild(enemyTitle);

    const enemySummary = document.createElement("div");
    enemySummary.className = "unitInfoBody";
    enemySummary.textContent = `敵軍 / HP ${tileUnit.hp}/${tileUnit.maxHp} / 位置 ${tileUnit.x}, ${tileUnit.y}`;
    unitInfo.appendChild(enemySummary);
  }

  if (tileUnit && tileUnit.team === "enemy" && unit && canPlayerAttackTarget(current, tileUnit)) {
    const attackButton = document.createElement("button");
    attackButton.type = "button";
    attackButton.className = "primary";
    attackButton.textContent = "攻撃";
    attackButton.addEventListener("click", () => {
      if (bridge.useWasm && bridge.instance && typeof bridge.instance.attack_selected === "function") {
        bridge.instance.attack_selected();
        safeRender();
        return;
      }
      attackSelectedTarget(state);
    });
    unitActions.appendChild(attackButton);
  }

  if (tileUnit && tileUnit.team === "enemy") {
    const hint = document.createElement("div");
    hint.className = "statusLine";
    hint.textContent = canPlayerAttackTarget(current, tileUnit) ? "攻撃可能です" : "射程外です";
    unitActions.appendChild(hint);
  }

  if (!unit) {
    return;
  }

  const moveButton = document.createElement("button");
  moveButton.type = "button";
  moveButton.className = "secondary";
  moveButton.textContent = isMoveMode(current) ? "移動選択中" : "移動";
  moveButton.disabled = unit.moved || current.phase !== "player";
  moveButton.addEventListener("click", () => {
    if (bridge.useWasm && bridge.instance && typeof bridge.instance.begin_move === "function") {
      bridge.instance.begin_move();
      safeRender();
      return;
    }
    beginMoveSelection();
  });
  unitActions.appendChild(moveButton);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "secondary";
  cancelButton.textContent = "キャンセル";
  cancelButton.disabled = !isMoveMode(current);
  cancelButton.addEventListener("click", () => {
    if (bridge.useWasm && bridge.instance && typeof bridge.instance.cancel_move === "function") {
      bridge.instance.cancel_move();
      safeRender();
      return;
    }
    cancelMoveSelection();
  });
  unitActions.appendChild(cancelButton);
}

function showStartupError(error) {
  startupError = error;
  const message = error instanceof Error ? error.message : String(error);
  statusLine.textContent = `JS error: ${message}`;
  if (error instanceof Error) {
    console.error("[SRPG] startup/render error", error.message, error.stack);
  } else {
    console.error("[SRPG] startup/render error", error);
  }
}

function debugLog(...args) {
  if (DEBUG) {
    console.log("[SRPG]", ...args);
  }
}

function markInput(eventName) {
  if (inputProbe) {
    inputProbe.textContent = `input: ${eventName}`;
  }
}

function describeTarget(event) {
  const target = event.target;
  if (!target) return "unknown";
  if (target.id) return `#${target.id}`;
  if (target.tagName) return target.tagName.toLowerCase();
  return "unknown";
}

function safeRender() {
  if (startupError) return;
  try {
    debugLog("render start");
    render();
    debugLog("render complete");
  } catch (error) {
    showStartupError(error);
  }
}

function renderAbilityList(current) {
  const abilities = abilitiesForCurrent(current);
  abilityList.innerHTML = "";

  if (abilities.length === 0) {
    const empty = document.createElement("div");
    empty.className = "statusLine";
    empty.textContent = "選択中のユニットにアビリティはありません";
    abilityList.appendChild(empty);
    return;
  }

  for (const ability of abilities) {
    const button = document.createElement("button");
    button.className = "abilityButton";
    button.type = "button";
    button.innerHTML = `<strong>${ability.name}</strong><small>射程 ${ability.range} / 消費 ${ability.cost}</small>`;
    button.addEventListener("click", () => {
      debugLog("ability button click", { id: ability.id, name: ability.name });
      if (bridge.useWasm && bridge.instance && typeof bridge.instance.use_ability === "function") {
        bridge.instance.use_ability(ability.id | 0);
        debugLog("ability forwarded to wasm", { id: ability.id, name: ability.name });
        safeRender();
        return;
      }

      state.message = `${ability.name} は wasm 側で処理します`;
      debugLog("ability local fallback", { id: ability.id, name: ability.name });
      safeRender();
    });
    abilityList.appendChild(button);
  }
}

function overlaysForCurrentState(current) {
  if (Array.isArray(current.moveTiles) || Array.isArray(current.attackTiles)) {
    return {
      move: new Set(current.moveTiles ?? []),
      attack: new Set(current.attackTiles ?? []),
    };
  }

  const move = new Set();
  const attack = new Set();
  const selected = selectedPlayerUnit(current);
  if (!selected || current.phase !== "player" || !isMoveMode(current)) {
    return { move, attack };
  }

  if (!selected.moved) {
    const reachable = reachableTiles(selected, current);
    for (const key of reachable.keys()) {
      if (key !== `${selected.x},${selected.y}`) move.add(key);
    }
  }

  if (!selected.acted) {
    for (const target of attackableUnits(selected, current)) {
      attack.add(`${target.x},${target.y}`);
    }
  }

  return { move, attack };
}

function moveCostsForCurrentState(current) {
  const costs = new Map();
  const selected = selectedPlayerUnit(current);
  if (!selected || current.phase !== "player" || selected.moved || !isMoveMode(current)) {
    return costs;
  }

  const reachable = reachableTiles(selected, current);
  for (const [key, cost] of reachable.entries()) {
    if (key === `${selected.x},${selected.y}`) continue;
    costs.set(key, cost);
  }

  return costs;
}

function tileCenter(pos, current) {
  if (current.viewMode === "topdown") {
    return {
      x: pos.x + pos.size / 2,
      y: pos.y + pos.size / 2,
    };
  }

  return {
    x: pos.x + pos.size / 2,
    y: pos.y + pos.size * 0.24,
  };
}

function drawMoveCostLabel(text, pos, current) {
  const center = tileCenter(pos, current);
  const zoom = pos.size / TILE_SIZE;
  const isTopo = current.viewMode === "topdown";
  const width = (isTopo ? 22 : 24) * zoom;
  const height = (isTopo ? 18 : 20) * zoom;

  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = "rgba(7, 12, 18, 0.28)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundedRectPath(center.x - width / 2, center.y - height / 2, width, height, 8 * zoom);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.74)";
  ctx.font = `700 ${Math.max(9, 12 * zoom)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, center.x, center.y + 0.5);
  ctx.restore();
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

function render() {
  const current = getCurrentState();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0a1017";
  ctx.fillRect(0, 0, width, height);
  frame.unitHitboxes = [];

  const tiles = [...current.map.tiles].sort((a, b) => {
    const da = current.viewMode === "isometric" ? a.x + a.y + a.height : a.y;
    const db = current.viewMode === "isometric" ? b.x + b.y + b.height : b.y;
    return da - db;
  });
  const overlays = overlaysForCurrentState(current);
  const moveCosts = moveCostsForCurrentState(current);
  const selectedKey = selectedTileKey(current);
  const renderState = { ...current, selectedTileKey: selectedKey };

  for (const tile of tiles) {
    const pos = tileToScreen(tile, current);
    if (current.viewMode === "topdown") {
      drawTopDownTile(tile, pos, renderState, overlays);
    } else {
      drawIsoTile(tile, pos, renderState, overlays);
    }
  }

  for (const [key, cost] of moveCosts.entries()) {
    const [x, y] = key.split(",").map(Number);
    const tile = tileAt(current.map, x, y);
    if (!tile) continue;
    const pos = tileToScreen(tile, current);
    drawMoveCostLabel(String(cost), pos, current);
  }

  current.units.forEach((unit) => drawUnit(unit, current));

  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.font = "600 14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    current.viewMode === "isometric" ? "斜め見下ろしビュー" : "真上 2D ビュー",
    20,
    height - 20
  );

  drawHud(current);
}

function toggleViewMode() {
  debugLog("toggleView requested", { wasm: bridge.useWasm, viewMode: getCurrentState().viewMode });
  if (bridge.useWasm && bridge.instance) {
    bridge.instance.toggle_view();
    debugLog("toggleView forwarded to wasm");
    safeRender();
    return;
  }

  state.viewMode = state.viewMode === "isometric" ? "topdown" : "isometric";
  state.message = state.viewMode === "isometric" ? "斜め見下ろしへ切替" : "真上 2D へ切替";
  debugLog("toggleView handled locally", { viewMode: state.viewMode });
  safeRender();
}

function toggleBoxMode() {
  debugLog("toggleBox requested", { boxMode: uiState.boxMode });
  uiState.boxMode = uiState.boxMode === "open" ? "closed" : "open";
  state.message = uiState.boxMode === "open" ? "箱を開いた表示" : "箱を閉じた表示";
  safeRender();
}

function zoomIn() {
  adjustZoom(ZOOM_STEP);
}

function zoomOut() {
  adjustZoom(-ZOOM_STEP);
}

function zoomReset() {
  setZoom(window.matchMedia("(max-width: 768px)").matches ? 0.75 : 1);
}

if (zoomRange) {
  zoomRange.value = String(Math.round(uiState.zoom * 100));
  zoomRange.addEventListener("input", () => {
    const value = Number.parseInt(zoomRange.value, 10) / 100;
    setZoom(value);
  });
}

function beginMoveSelection() {
  const selected = selectedPlayerUnit(state);
  if (!selected || state.phase !== "player" || selected.moved) {
    state.message = "移動できる自軍ユニットを選択してください";
    safeRender();
    return;
  }

  state.interactionMode = "move";
  state.selectedUnitId = selected.id;
  state.selectedTile = { x: selected.x, y: selected.y };
  state.moveOrigin = {
    unitId: selected.id,
    x: selected.x,
    y: selected.y,
    moved: selected.moved,
  };
  state.message = `${selected.job} の移動先を選択してください`;
  safeRender();
}

function cancelMoveSelection() {
  if (state.moveOrigin) {
    const unit = state.units.find((candidate) => candidate.id === state.moveOrigin.unitId);
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

function runTurnEnd() {
  debugLog("endTurn requested", { wasm: bridge.useWasm, phase: getCurrentState().phase });
  if (bridge.useWasm && bridge.instance) {
    bridge.instance.end_turn();
    debugLog("endTurn forwarded to wasm");
    safeRender();
    return;
  }
  endPlayerTurn();
  debugLog("endTurn handled locally", { phase: state.phase });
  safeRender();
}

toggleViewButton.addEventListener("click", toggleViewMode);
if (toggleBoxButton) toggleBoxButton.addEventListener("click", toggleBoxMode);
endTurnButton.addEventListener("click", runTurnEnd);
resetViewButton.addEventListener("click", () => {
  try {
    debugLog("reset button click", { wasm: bridge.useWasm });
    if (bridge.useWasm && bridge.instance) {
      bridge.instance.reset();
      debugLog("reset forwarded to wasm");
      safeRender();
      return;
    }

    resetGame();
    debugLog("reset handled locally");
    safeRender();
  } catch (error) {
    showStartupError(error);
  }
});

canvas.addEventListener("pointerdown", handleCanvasClick);

window.addEventListener("resize", safeRender);

window.addEventListener("keydown", (event) => {
  try {
    if (event.key === "Escape") {
      if (getCurrentState().interactionMode === "move") {
        if (bridge.useWasm && bridge.instance && typeof bridge.instance.cancel_move === "function") {
          bridge.instance.cancel_move();
        } else {
          cancelMoveSelection();
        }
        safeRender();
      } else if (!bridge.useWasm) {
        state.selectedUnitId = null;
        state.message = "選択解除";
        safeRender();
      }
    }
    if (event.key === "Enter" && !bridge.useWasm) {
      runTurnEnd();
    }
    if (event.key === "v" || event.key === "V") {
      toggleViewMode();
    }
  } catch (error) {
    showStartupError(error);
  }
});

async function connectBridge() {
  debugLog("connectBridge start");
  if (window.srpgGame && typeof window.srpgGame.get_render_data === "function") {
    bridge.instance = window.srpgGame;
    bridge.useWasm = true;
    debugLog("connectBridge using existing bridge");
    return;
  }

  if (window.createSrpgGame) {
    const instance = await window.createSrpgGame();
    if (instance && typeof instance.get_render_data === "function") {
      bridge.instance = instance;
      bridge.useWasm = true;
      debugLog("connectBridge loaded wasm bridge");
    }
  }
}

window.addEventListener("error", (event) => {
  if (!startupError) {
    showStartupError(event.error ?? event.message);
  }
});

window.addEventListener("unhandledrejection", (event) => {
  if (!startupError) {
    showStartupError(event.reason ?? "unhandled rejection");
  }
});

window.addEventListener(
  "pointerdown",
  (event) => {
    const target = describeTarget(event);
    markInput(`window:${event.type} on ${target}`);
    debugLog("window pointerdown", { target });
  },
  true
);

window.addEventListener(
  "click",
  (event) => {
    const target = describeTarget(event);
    markInput(`window:${event.type} on ${target}`);
    debugLog("window click", { target });
  },
  true
);

debugLog("boot sequence start");
safeRender();
connectBridge()
  .catch((error) => {
    if (!startupError) {
      showStartupError(error);
    }
  })
  .finally(() => {
    debugLog("boot sequence complete");
    safeRender();
  });

window.srpgUi = {
  toggleView: toggleViewMode,
  toggleBox: toggleBoxMode,
  zoomIn,
  zoomOut,
  zoomReset,
  endTurn: runTurnEnd,
  reset: () => {
    if (bridge.useWasm && bridge.instance) {
      bridge.instance.reset();
      safeRender();
      return;
    }

    resetGame();
    safeRender();
  },
};
