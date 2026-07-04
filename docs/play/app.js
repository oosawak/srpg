const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
const toggleViewButton = document.getElementById("toggleView");
const endTurnButton = document.getElementById("endTurn");
const resetViewButton = document.getElementById("resetView");
const viewName = document.getElementById("viewName");
const turnNumber = document.getElementById("turnNumber");
const phaseName = document.getElementById("phaseName");
const selectedUnit = document.getElementById("selectedUnit");
const unitCount = document.getElementById("unitCount");
const abilityList = document.getElementById("abilityList");
const statusLine = document.createElement("p");

const TILE_SIZE = 72;
const COLORS = {
  player: "#f3d36c",
  enemy: "#78e4ff",
  playerDead: "#75643f",
  enemyDead: "#3d5d6d",
};

statusLine.className = "statusLine";
document.querySelector(".panel").appendChild(statusLine);

const bridge = {
  useWasm: false,
  instance: null,
};

const state = createInitialState();

function createInitialState() {
  return {
    viewMode: "isometric",
    turnNumber: 1,
    phase: "player",
    selectedUnitId: 1,
    message: "自軍を選択してください",
    map: buildDemoMap(),
    units: [
      makeUnit(1, 1, "Ashigaru", 2, 2, COLORS.player, "player", 4, 1, 100, 14),
      makeUnit(2, 1, "Yumi", 1, 5, COLORS.player, "player", 4, 3, 80, 12),
      makeUnit(3, 2, "Teppo", 6, 2, COLORS.enemy, "enemy", 3, 2, 90, 13),
      makeUnit(4, 2, "Ninja", 6, 5, COLORS.enemy, "enemy", 4, 1, 70, 11),
    ],
  };
}

function makeUnit(id, clan, job, x, y, color, team, mov, range, hp, atk) {
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

function normalizeSnapshot(snapshot) {
  const tiles = snapshot?.map?.tiles ?? [];
  const units = snapshot?.units ?? [];

  return {
    viewMode: snapshot?.view_mode ?? state.viewMode,
    turnNumber: snapshot?.turn_number ?? 1,
    phase: snapshot?.phase ?? "player",
    selectedUnitId: snapshot?.selected_unit_id ?? null,
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
      moved: false,
      acted: false,
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
  if (current.viewMode === "topdown") {
    const mapPixelWidth = current.map.width * TILE_SIZE;
    return {
      x: Math.max(24, (canvas.clientWidth - mapPixelWidth) / 2),
      y: 76,
    };
  }

  return {
    x: canvas.clientWidth / 2,
    y: 104,
  };
}

function tileToScreen(tile, current) {
  const origin = viewOrigin(current);
  if (current.viewMode === "topdown") {
    return {
      x: origin.x + tile.x * TILE_SIZE,
      y: origin.y + tile.y * TILE_SIZE,
      size: TILE_SIZE,
    };
  }

  const isoX = (tile.x - tile.y) * (TILE_SIZE / 2);
  const isoY = (tile.x + tile.y) * (TILE_SIZE / 4) - tile.height * (TILE_SIZE / 3);
  return {
    x: origin.x + isoX,
    y: origin.y + isoY,
    size: TILE_SIZE,
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
    } else if (pointInPolygon(point, isoPolygon(pos))) {
      return tile;
    }
  }

  return null;
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
  state.message = `${unit.job} が ${tile.x},${tile.y} へ移動`;
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

function selectedPlayerUnit(current) {
  if (current.selectedUnitId == null) return null;
  return current.units.find((unit) => unit.id === current.selectedUnitId && unit.hp > 0) ?? null;
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
    state.message = `${clickedUnit.job} を選択`;
    return;
  }

  if (!selected) return;

  const moveTiles = reachableTiles(selected, current);
  if (moveTiles.has(`${tile.x},${tile.y}`) && !clickedUnit && !selected.moved) {
    moveUnit(selected, tile, current);
    state.selectedUnitId = selected.id;
    return;
  }

  if (clickedUnit && clickedUnit.team === "enemy") {
    const attackable = attackableUnits(selected, current);
    if (attackable.some((unit) => unit.id === clickedUnit.id) && !selected.acted) {
      attackUnit(selected, clickedUnit);
      if (currentEnemyUnits(current.units).every((unit) => unit.hp <= 0)) {
        state.phase = "victory";
        state.message = "勝利";
        state.selectedUnitId = null;
        return;
      }
      if (selected.moved || selected.acted) {
        state.message += " / ターン終了可能";
      }
      return;
    }
  }

  state.message = "移動先または攻撃対象を選択してください";
}

function handleCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const point = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
  const current = getCurrentState();
  const tile = screenToTile(point, current);
  if (!tile) return;
  if (bridge.useWasm && bridge.instance) {
    bridge.instance.click_tile(tile.x, tile.y);
    render();
    return;
  }
  if (state.phase !== "player") return;
  handlePlayerClick(tile, state);
  render();
}

function terrainBadge(tile) {
  if (tile.water) return "水";
  if (tile.cover) return "隠";
  return "";
}

function drawTopDownTile(tile, pos, current, overlays) {
  const size = pos.size;
  ctx.fillStyle = terrainColor(tile);
  ctx.fillRect(pos.x, pos.y, size - 2, size - 2);
  ctx.strokeStyle = tileStroke(tile);
  ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, size - 2, size - 2);

  const key = `${tile.x},${tile.y}`;
  if (overlays.move.has(key)) {
    ctx.fillStyle = "rgba(89, 177, 255, 0.35)";
    ctx.fillRect(pos.x, pos.y, size - 2, size - 2);
  }
  if (overlays.attack.has(key)) {
    ctx.fillStyle = "rgba(255, 103, 103, 0.35)";
    ctx.fillRect(pos.x, pos.y, size - 2, size - 2);
  }
  if (current.selectedTileKey === key) {
    ctx.fillStyle = "rgba(255, 214, 102, 0.35)";
    ctx.fillRect(pos.x, pos.y, size - 2, size - 2);
  }

  if (tile.height > 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(String(tile.height), pos.x + 8, pos.y + 18);
  }

  if (terrainBadge(tile)) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.54)";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(terrainBadge(tile), pos.x + size - 10, pos.y + size - 10);
  }
}

function drawIsoTile(tile, pos, current, overlays) {
  const size = pos.size;
  const polygon = isoPolygon(pos);
  const key = `${tile.x},${tile.y}`;

  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let i = 1; i < polygon.length; i += 1) {
    ctx.lineTo(polygon[i].x, polygon[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = terrainColor(tile);
  ctx.fill();
  ctx.strokeStyle = tileStroke(tile);
  ctx.stroke();

  if (overlays.move.has(key)) {
    ctx.fillStyle = "rgba(89, 177, 255, 0.32)";
    ctx.fill();
  }
  if (overlays.attack.has(key)) {
    ctx.fillStyle = "rgba(255, 103, 103, 0.28)";
    ctx.fill();
  }
  if (current.selectedTileKey === key) {
    ctx.fillStyle = "rgba(255, 214, 102, 0.28)";
    ctx.fill();
  }

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

function drawUnit(unit, current) {
  if (unit.hp <= 0) return;
  const tile = tileAt(current.map, unit.x, unit.y);
  if (!tile) return;

  const pos = tileToScreen(tile, current);
  const x = current.viewMode === "topdown" ? pos.x + pos.size / 2 - 1 : pos.x + pos.size / 2;
  const y =
    current.viewMode === "topdown" ? pos.y + pos.size / 2 + 2 : pos.y + pos.size * 0.88;
  const radius = current.viewMode === "topdown" ? 12 : 10;

  ctx.beginPath();
  ctx.fillStyle = unit.color;
  ctx.arc(x, y - 12, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = unit.team === "player" ? "rgba(0, 0, 0, 0.55)" : "rgba(255, 255, 255, 0.35)";
  ctx.stroke();

  if (state.selectedUnitId === unit.id) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 214, 102, 0.95)";
    ctx.lineWidth = 3;
    ctx.arc(x, y - 12, radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  ctx.fillStyle = "#08111b";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(unit.id), x, y - 8);

  const barW = 30;
  const hpPct = unit.hp / unit.maxHp;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(x - barW / 2, y + 4, barW, 5);
  ctx.fillStyle = unit.team === "player" ? "#83ffb7" : "#ff8b8b";
  ctx.fillRect(x - barW / 2, y + 4, barW * hpPct, 5);
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
  toggleViewButton.textContent =
    current.viewMode === "isometric" ? "切替: 斜め見下ろし" : "切替: 真上 2D";
  statusLine.textContent = bridge.useWasm ? `wasm bridge connected / ${current.message}` : current.message;
  endTurnButton.disabled = !current.isPlayerTurn && current.phase !== "player";
  renderAbilityList(current);
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
      if (bridge.useWasm && bridge.instance && typeof bridge.instance.use_ability === "function") {
        bridge.instance.use_ability(ability.id | 0);
        render();
        return;
      }

      state.message = `${ability.name} は wasm 側で処理します`;
      render();
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
  if (!selected || current.phase !== "player") {
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

  const tiles = [...current.map.tiles].sort((a, b) => {
    const da = current.viewMode === "isometric" ? a.x + a.y + a.height : a.y;
    const db = current.viewMode === "isometric" ? b.x + b.y + b.height : b.y;
    return da - db;
  });
  const overlays = overlaysForCurrentState(current);
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

  current.units.forEach((unit) => drawUnit(unit, current));

  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.font = "600 14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    current.viewMode === "isometric" ? "FFT style isometric view" : "Top-down tactical view",
    20,
    height - 20
  );

  drawHud(current);
}

function toggleViewMode() {
  if (bridge.useWasm && bridge.instance) {
    bridge.instance.toggle_view();
    render();
    return;
  }

  state.viewMode = state.viewMode === "isometric" ? "topdown" : "isometric";
  state.message = state.viewMode === "isometric" ? "斜め見下ろしへ切替" : "真上 2D へ切替";
  render();
}

function runTurnEnd() {
  if (bridge.useWasm && bridge.instance) {
    bridge.instance.end_turn();
    render();
    return;
  }
  endPlayerTurn();
  render();
}

toggleViewButton.addEventListener("click", toggleViewMode);
endTurnButton.addEventListener("click", runTurnEnd);
resetViewButton.addEventListener("click", () => {
  if (bridge.useWasm && bridge.instance) {
    bridge.instance.reset();
    render();
    return;
  }

  resetGame();
  render();
});

canvas.addEventListener("click", handleCanvasClick);

window.addEventListener("resize", render);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !bridge.useWasm) {
    state.selectedUnitId = null;
    state.message = "選択解除";
    render();
  }
  if (event.key === "Enter" && !bridge.useWasm) {
    runTurnEnd();
  }
  if (event.key === "v" || event.key === "V") {
    toggleViewMode();
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

render();
connectBridge().finally(() => render());
