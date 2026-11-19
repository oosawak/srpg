// Role-based + generic player AI & 1-tile move expansion for SRPG Auto Mode.
// Works both in browser (window.srpgAutoAi) and Node.js (module.exports).
(function initSrpgAutoAi(globalScope) {
  const DIRS = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  function tileKey(x, y) {
    return `${x},${y}`;
  }

  function manhattan(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  function tileAt(map, x, y) {
    if (!map || !Array.isArray(map.tiles)) return null;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
    return map.tiles[y * map.width + x] ?? map.tiles.find((t) => t.x === x && t.y === y) ?? null;
  }

  function terrainCost(tile) {
    if (!tile) return 99;
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

  function unitAt(units, x, y) {
    return (units ?? []).find((u) => u.hp > 0 && u.x === x && u.y === y) ?? null;
  }

  function aliveEnemies(state) {
    return (state.units ?? []).filter((u) => u.team === "enemy" && u.hp > 0);
  }

  function alivePlayers(state) {
    return (state.units ?? []).filter((u) => u.team === "player" && u.hp > 0);
  }

  function abilitiesForJob(job) {
    switch (job) {
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

  function findHealAbility(unit, state) {
    if (!unit) return null;
    const list =
      state &&
      state.selectedUnitId === unit.id &&
      Array.isArray(state.abilities) &&
      state.abilities.length > 0
        ? state.abilities
        : abilitiesForJob(unit.job);
    for (const ability of list) {
      const name = String(ability.name ?? "");
      if (name.includes("陣形変更") || name.includes("回復")) {
        return ability;
      }
    }
    return null;
  }

  function computeReachableMap(unit, state) {
    const startKey = tileKey(unit.x, unit.y);
    const costs = new Map([[startKey, 0]]);
    const prev = new Map();
    const tiles = [{ x: unit.x, y: unit.y, cost: 0 }];

    if (!unit || unit.hp <= 0 || unit.moved) {
      return { costs, prev, tiles };
    }

    const queue = [{ x: unit.x, y: unit.y, cost: 0 }];
    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const node = queue.shift();
      const nodeKey = tileKey(node.x, node.y);
      if (node.cost > (costs.get(nodeKey) ?? Infinity)) continue;

      for (const [dx, dy] of DIRS) {
        const nx = node.x + dx;
        const ny = node.y + dy;
        const tile = tileAt(state.map, nx, ny);
        if (!tile || tile.terrain === "Water") continue;
        const occupied = unitAt(state.units, nx, ny);
        if (occupied && occupied.id !== unit.id) continue;
        const nextCost = node.cost + terrainCost(tile);
        if (nextCost > unit.mov) continue;
        const key = tileKey(nx, ny);
        if (nextCost < (costs.get(key) ?? Infinity)) {
          costs.set(key, nextCost);
          prev.set(key, nodeKey);
          queue.push({ x: nx, y: ny, cost: nextCost });
        }
      }
    }

    for (const [key, cost] of costs.entries()) {
      if (key === startKey) continue;
      const [x, y] = key.split(",").map(Number);
      tiles.push({ x, y, cost });
    }
    return { costs, prev, tiles };
  }

  function findGridPath(unit, from, to, state) {
    if (!from || !to) return [];
    if (from.x === to.x && from.y === to.y) return [];

    const reach = computeReachableMap({ ...unit, x: from.x, y: from.y, moved: false }, state);
    const destKey = tileKey(to.x, to.y);
    const startKey = tileKey(from.x, from.y);
    if (reach.prev.has(destKey)) {
      const steps = [];
      let cursor = destKey;
      let guard = 0;
      while (cursor && cursor !== startKey && guard < 64) {
        const [x, y] = cursor.split(",").map(Number);
        steps.push({ x, y });
        cursor = reach.prev.get(cursor);
        guard += 1;
      }
      steps.reverse();
      return steps;
    }

    const queue = [{ x: from.x, y: from.y, cost: 0 }];
    const costs = new Map([[startKey, 0]]);
    const prev = new Map();
    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const node = queue.shift();
      if (node.x === to.x && node.y === to.y) break;
      for (const [dx, dy] of DIRS) {
        const nx = node.x + dx;
        const ny = node.y + dy;
        const tile = tileAt(state.map, nx, ny);
        if (!tile || tile.terrain === "Water") continue;
        const occupied = unitAt(state.units, nx, ny);
        if (occupied && occupied.id !== unit.id && !(nx === to.x && ny === to.y)) continue;
        const nextCost = node.cost + terrainCost(tile);
        const key = tileKey(nx, ny);
        if (nextCost < (costs.get(key) ?? Infinity)) {
          costs.set(key, nextCost);
          prev.set(key, tileKey(node.x, node.y));
          queue.push({ x: nx, y: ny, cost: nextCost });
        }
      }
    }
    if (!prev.has(destKey)) return [{ x: to.x, y: to.y }];
    const steps = [];
    let cursor = destKey;
    let guard = 0;
    while (cursor && cursor !== startKey && guard < 64) {
      const [x, y] = cursor.split(",").map(Number);
      steps.push({ x, y });
      cursor = prev.get(cursor);
      guard += 1;
    }
    steps.reverse();
    return steps;
  }

  function expandMoveEventsToSteps(events, beforeState) {
    const expanded = [];
    for (const ev of events ?? []) {
      if (ev.type !== "move") {
        expanded.push(ev);
        continue;
      }
      const dist = manhattan(ev.from_x, ev.from_y, ev.to_x, ev.to_y);
      if (dist <= 1) {
        expanded.push(ev);
        continue;
      }
      const mover = (beforeState?.units ?? []).find((u) => u.id === ev.unit_id);
      if (!mover) {
        expanded.push(ev);
        continue;
      }
      const path = findGridPath(
        mover,
        { x: ev.from_x, y: ev.from_y },
        { x: ev.to_x, y: ev.to_y },
        beforeState
      );
      if (path.length === 0) {
        expanded.push(ev);
        continue;
      }
      let curX = ev.from_x;
      let curY = ev.from_y;
      for (const step of path) {
        expanded.push({
          type: "move",
          unit_id: ev.unit_id,
          from_x: curX,
          from_y: curY,
          to_x: step.x,
          to_y: step.y,
        });
        curX = step.x;
        curY = step.y;
      }
    }
    return expanded;
  }

  function computeDistanceField(targets, state, moverId, options = {}) {
    const { allyPenalty = 1.5, enemyPenalty = 6.0, preferUnoccupiedTargets = false } = options;
    const dist = new Map();
    const queue = [];

    for (const target of targets) {
      const tile = tileAt(state.map, target.x, target.y);
      if (!tile || tile.terrain === "Water") continue;
      let initCost = 0;
      if (preferUnoccupiedTargets) {
        const occ = unitAt(state.units, target.x, target.y);
        if (occ && occ.id !== moverId) {
          initCost = occ.team === "player" ? allyPenalty * 2 : enemyPenalty;
        }
      }
      const k = tileKey(target.x, target.y);
      if (initCost < (dist.get(k) ?? Infinity)) {
        dist.set(k, initCost);
        queue.push({ x: target.x, y: target.y, cost: initCost });
      }
    }

    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const cur = queue.shift();
      const curKey = tileKey(cur.x, cur.y);
      if (cur.cost > (dist.get(curKey) ?? Infinity)) continue;

      const curTile = tileAt(state.map, cur.x, cur.y);
      if (!curTile || curTile.terrain === "Water") continue;

      let stepCostIntoCur = terrainCost(curTile);
      const occ = unitAt(state.units, cur.x, cur.y);
      if (occ && occ.id !== moverId) {
        stepCostIntoCur += occ.team === "player" ? allyPenalty : enemyPenalty;
      }

      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const nTile = tileAt(state.map, nx, ny);
        if (!nTile || nTile.terrain === "Water") continue;
        const nextCost = cur.cost + stepCostIntoCur;
        const nKey = tileKey(nx, ny);
        if (nextCost < (dist.get(nKey) ?? Infinity)) {
          dist.set(nKey, nextCost);
          queue.push({ x: nx, y: ny, cost: nextCost });
        }
      }
    }

    return dist;
  }

  function findBridgeSouthAnchor(state, fallbackUnit) {
    const bridgeTiles = (state.map?.tiles ?? []).filter((t) => t.bridge);
    if (bridgeTiles.length === 0) {
      return fallbackUnit ? { x: fallbackUnit.x, y: fallbackUnit.y } : { x: 4, y: 6 };
    }
    bridgeTiles.sort((a, b) => {
      if (b.y !== a.y) return b.y - a.y;
      if (fallbackUnit) {
        return (
          manhattan(a.x, a.y, fallbackUnit.x, fallbackUnit.y) -
          manhattan(b.x, b.y, fallbackUnit.x, fallbackUnit.y)
        );
      }
      return a.x - b.x;
    });
    return { x: bridgeTiles[0].x, y: bridgeTiles[0].y };
  }

  function pickBestAttackTarget(attacker, pos, enemies, anchor = null, preferLeader = false) {
    const inRange = enemies.filter((e) => manhattan(pos.x, pos.y, e.x, e.y) <= attacker.range);
    if (inRange.length === 0) return null;
    inRange.sort((a, b) => {
      const aKill = a.hp <= attacker.atk ? 0 : 1;
      const bKill = b.hp <= attacker.atk ? 0 : 1;
      if (aKill !== bKill) return aKill - bKill;
      if (preferLeader && Boolean(b.leader) !== Boolean(a.leader)) {
        return b.leader ? 1 : -1;
      }
      if (aKill === 0 && b.atk !== a.atk) return b.atk - a.atk;
      if (a.hp !== b.hp) return a.hp - b.hp;
      if (anchor) {
        const da = manhattan(a.x, a.y, anchor.x, anchor.y);
        const db = manhattan(b.x, b.y, anchor.x, anchor.y);
        if (da !== db) return da - db;
      }
      const distA = manhattan(pos.x, pos.y, a.x, a.y);
      const distB = manhattan(pos.x, pos.y, b.x, b.y);
      if (distA !== distB) return distA - distB;
      return a.id - b.id;
    });
    return inRange[0];
  }

  function nearestEnemyDistance(pos, enemies) {
    let best = Infinity;
    for (const e of enemies) {
      const d = manhattan(pos.x, pos.y, e.x, e.y);
      if (d < best) best = d;
    }
    return best;
  }

  // Role: escape — shortest path toward escape tiles; only attack adjacent enemies
  function planEscapeTurn(unit, state) {
    const escapeTiles = (state.map?.tiles ?? []).filter((t) => t.escape);
    if (escapeTiles.length === 0) {
      return planGeneralTurn(unit, state);
    }

    const enemies = aliveEnemies(state);
    const reach = computeReachableMap(unit, state);
    const distToEscape = computeDistanceField(escapeTiles, state, unit.id, {
      allyPenalty: 2.0,
      enemyPenalty: 8.0,
      preferUnoccupiedTargets: true,
    });

    let chosenTile = { x: unit.x, y: unit.y };
    if (!unit.moved) {
      const reachableEscapes = reach.tiles.filter((cand) => {
        const t = tileAt(state.map, cand.x, cand.y);
        return Boolean(t && t.escape);
      });
      if (reachableEscapes.length > 0) {
        reachableEscapes.sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x);
        chosenTile = { x: reachableEscapes[0].x, y: reachableEscapes[0].y };
      } else {
        const scored = reach.tiles.map((cand) => {
          const tile = tileAt(state.map, cand.x, cand.y);
          const pathDist = distToEscape.get(tileKey(cand.x, cand.y)) ?? Infinity;
          let minManh = Infinity;
          for (const et of escapeTiles) {
            const d = manhattan(cand.x, cand.y, et.x, et.y);
            if (d < minManh) minManh = d;
          }
          const enemyDist = enemies.length > 0 ? nearestEnemyDistance(cand, enemies) : 99;
          return {
            cand,
            pathDist,
            minManh,
            enemyDist,
            cover: tile?.cover ? 1 : 0,
            isCurrent: cand.x === unit.x && cand.y === unit.y,
          };
        });

        scored.sort((a, b) => {
          if (Math.abs(a.pathDist - b.pathDist) > 1e-6) return a.pathDist - b.pathDist;
          if (a.minManh !== b.minManh) return a.minManh - b.minManh;
          if (b.enemyDist !== a.enemyDist) return b.enemyDist - a.enemyDist;
          if (b.cover !== a.cover) return b.cover - a.cover;
          return a.isCurrent ? -1 : b.isCurrent ? 1 : 0;
        });

        if (scored.length > 0) {
          chosenTile = { x: scored[0].cand.x, y: scored[0].cand.y };
        }
      }
    }

    const moveTo =
      chosenTile.x === unit.x && chosenTile.y === unit.y ? null : { x: chosenTile.x, y: chosenTile.y };
    const finalPos = moveTo ?? { x: unit.x, y: unit.y };
    const finalTile = tileAt(state.map, finalPos.x, finalPos.y);

    if (finalTile && finalTile.escape) {
      return { role: "escape", moveTo, action: null };
    }

    let action = null;
    if (!unit.acted) {
      const adjacentEnemies = enemies.filter(
        (e) => manhattan(finalPos.x, finalPos.y, e.x, e.y) === 1 && 1 <= unit.range
      );
      const target = pickBestAttackTarget(unit, finalPos, adjacentEnemies);
      if (target) {
        action = { type: "attack", target };
      }
    }

    return { role: "escape", moveTo, action };
  }

  // Role: hold_bridge — stay within 1 tile of bridge south anchor
  function planHoldBridgeTurn(unit, state) {
    const anchor = findBridgeSouthAnchor(state, unit);
    const enemies = aliveEnemies(state);
    const reach = computeReachableMap(unit, state);
    const allowedTiles = reach.tiles.filter((cand) => manhattan(cand.x, cand.y, anchor.x, anchor.y) <= 1);

    let chosenTile = { x: unit.x, y: unit.y };
    if (!unit.moved) {
      if (allowedTiles.length === 0) {
        const distToAnchor = computeDistanceField([anchor], state, unit.id);
        const candidates = [...reach.tiles].sort((a, b) => {
          const da = distToAnchor.get(tileKey(a.x, a.y)) ?? Infinity;
          const db = distToAnchor.get(tileKey(b.x, b.y)) ?? Infinity;
          if (Math.abs(da - db) > 1e-6) return da - db;
          return manhattan(a.x, a.y, anchor.x, anchor.y) - manhattan(b.x, b.y, anchor.x, anchor.y);
        });
        if (candidates[0]) {
          chosenTile = { x: candidates[0].x, y: candidates[0].y };
        }
      } else {
        const attackCandidates = [];
        for (const cand of allowedTiles) {
          const target = !unit.acted ? pickBestAttackTarget(unit, cand, enemies, anchor) : null;
          if (target) {
            const tile = tileAt(state.map, cand.x, cand.y);
            attackCandidates.push({
              cand,
              target,
              anchorDist: manhattan(cand.x, cand.y, anchor.x, anchor.y),
              isBridge: tile?.bridge ? 1 : 0,
              canKill: target.hp <= unit.atk ? 1 : 0,
              targetHp: target.hp,
              isCurrent: cand.x === unit.x && cand.y === unit.y ? 1 : 0,
            });
          }
        }

        if (attackCandidates.length > 0) {
          attackCandidates.sort((a, b) => {
            if (a.anchorDist !== b.anchorDist) return a.anchorDist - b.anchorDist;
            if (b.isBridge !== a.isBridge) return b.isBridge - a.isBridge;
            if (b.canKill !== a.canKill) return b.canKill - a.canKill;
            if (a.targetHp !== b.targetHp) return a.targetHp - b.targetHp;
            return b.isCurrent - a.isCurrent;
          });
          chosenTile = { x: attackCandidates[0].cand.x, y: attackCandidates[0].cand.y };
        } else {
          allowedTiles.sort((a, b) => {
            const da = manhattan(a.x, a.y, anchor.x, anchor.y);
            const db = manhattan(b.x, b.y, anchor.x, anchor.y);
            if (da !== db) return da - db;
            const ta = tileAt(state.map, a.x, a.y);
            const tb = tileAt(state.map, b.x, b.y);
            if ((tb?.bridge ? 1 : 0) !== (ta?.bridge ? 1 : 0)) {
              return (tb?.bridge ? 1 : 0) - (ta?.bridge ? 1 : 0);
            }
            const ea = nearestEnemyDistance(a, enemies);
            const eb = nearestEnemyDistance(b, enemies);
            if (ea !== eb) return ea - eb;
            return a.x === unit.x && a.y === unit.y ? -1 : 1;
          });
          chosenTile = { x: allowedTiles[0].x, y: allowedTiles[0].y };
        }
      }
    }

    const moveTo =
      chosenTile.x === unit.x && chosenTile.y === unit.y ? null : { x: chosenTile.x, y: chosenTile.y };
    const finalPos = moveTo ?? { x: unit.x, y: unit.y };

    let action = null;
    if (!unit.acted) {
      const target = pickBestAttackTarget(unit, finalPos, enemies, anchor);
      if (target) {
        action = { type: "attack", target };
      }
    }

    return { role: "hold_bridge", moveTo, action };
  }

  // Role: hold_pos — defensive posture around starting position (within 2 tiles)
  function planHoldPosTurn(unit, state, anchorPos) {
    const anchor = anchorPos ?? { x: unit.x, y: unit.y };
    const enemies = aliveEnemies(state);
    if (enemies.length === 0) return { role: "hold_pos", moveTo: null, action: null };

    const reach = computeReachableMap(unit, state);
    const maxHp = unit.maxHp ?? unit.max_hp ?? unit.hp ?? 1;
    const isLowHp = maxHp > 0 && unit.hp * 10 <= maxHp * 3;
    const healAbility = !unit.acted ? findHealAbility(unit, state) : null;
    if (isLowHp && healAbility) {
      return {
        role: "hold_pos_heal",
        moveTo: null,
        action: { type: "ability", abilityId: healAbility.id, name: healAbility.name },
      };
    }

    const allowed = reach.tiles.filter((c) => manhattan(c.x, c.y, anchor.x, anchor.y) <= 2);
    const pool = allowed.length > 0 ? allowed : reach.tiles;

    const attackOptions = [];
    if (!unit.acted) {
      for (const cand of pool) {
        const target = pickBestAttackTarget(unit, cand, enemies, anchor);
        if (!target) continue;
        const tile = tileAt(state.map, cand.x, cand.y);
        attackOptions.push({
          cand,
          target,
          canKill: target.hp <= unit.atk ? 1 : 0,
          cover: tile?.cover ? 1 : 0,
          anchorDist: manhattan(cand.x, cand.y, anchor.x, anchor.y),
          targetHp: target.hp,
        });
      }
    }

    if (attackOptions.length > 0) {
      attackOptions.sort(
        (a, b) =>
          b.canKill - a.canKill ||
          b.cover - a.cover ||
          a.anchorDist - b.anchorDist ||
          a.targetHp - b.targetHp
      );
      const best = attackOptions[0];
      const moveTo =
        best.cand.x === unit.x && best.cand.y === unit.y ? null : { x: best.cand.x, y: best.cand.y };
      return { role: "hold_pos", moveTo, action: { type: "attack", target: best.target } };
    }

    // Hold best defensive tile near anchor
    pool.sort((a, b) => {
      const ta = tileAt(state.map, a.x, a.y);
      const tb = tileAt(state.map, b.x, b.y);
      const ca = (ta?.cover ? 2 : 0) + (ta?.height ?? 0);
      const cb = (tb?.cover ? 2 : 0) + (tb?.height ?? 0);
      if (cb !== ca) return cb - ca;
      return manhattan(a.x, a.y, anchor.x, anchor.y) - manhattan(b.x, b.y, anchor.x, anchor.y);
    });
    const best = pool[0];
    const moveTo =
      !best || (best.x === unit.x && best.y === unit.y) ? null : { x: best.x, y: best.y };
    return { role: "hold_pos", moveTo, action: null };
  }

  // Role: general (and flank) — approach enemies, attack best target, heal at <=30% HP
  function planGeneralTurn(unit, state, options = {}) {
    const preferLeader = Boolean(options.preferLeader);
    const captureTiles = Array.isArray(options.captureTiles) ? options.captureTiles : [];
    const enemies = aliveEnemies(state);
    if (enemies.length === 0 && captureTiles.length === 0) {
      return { role: preferLeader ? "flank" : "general", moveTo: null, action: null };
    }

    const reach = computeReachableMap(unit, state);

    // Immediate capture win check: if a player capture objective tile is reachable right now, take it!
    if (captureTiles.length > 0 && !unit.moved) {
      const captureSet = new Set(captureTiles.map((c) => tileKey(c.x, c.y)));
      const directCapture = reach.tiles.find(
        (cand) => captureSet.has(tileKey(cand.x, cand.y)) && !(cand.x === unit.x && cand.y === unit.y)
      );
      if (directCapture) {
        return {
          role: "capture",
          moveTo: { x: directCapture.x, y: directCapture.y },
          action: null,
        };
      }
    }

    if (enemies.length === 0) {
      return { role: preferLeader ? "flank" : "general", moveTo: null, action: null };
    }
    const maxHp = unit.maxHp ?? unit.max_hp ?? unit.hp ?? 1;
    const isLowHp = maxHp > 0 && unit.hp * 10 <= maxHp * 3;
    const healAbility = !unit.acted ? findHealAbility(unit, state) : null;

    if (isLowHp && healAbility) {
      let chosenTile = { x: unit.x, y: unit.y };
      if (!unit.moved && reach.tiles.length > 1) {
        const allies = alivePlayers(state);
        const healRange = healAbility.range ?? 2;
        const candidates = reach.tiles.map((cand) => {
          const tile = tileAt(state.map, cand.x, cand.y);
          const woundedInRange = allies.filter(
            (a) => a.hp < (a.maxHp ?? a.max_hp ?? a.hp) && manhattan(cand.x, cand.y, a.x, a.y) <= healRange
          ).length;
          return {
            cand,
            woundedInRange,
            enemyDist: nearestEnemyDistance(cand, enemies),
            cover: tile?.cover ? 1 : 0,
            isCurrent: cand.x === unit.x && cand.y === unit.y ? 1 : 0,
          };
        });
        candidates.sort((a, b) => {
          if (b.woundedInRange !== a.woundedInRange) return b.woundedInRange - a.woundedInRange;
          if (b.enemyDist !== a.enemyDist) return b.enemyDist - a.enemyDist;
          if (b.cover !== a.cover) return b.cover - a.cover;
          return b.isCurrent - a.isCurrent;
        });
        if (candidates[0]) {
          chosenTile = { x: candidates[0].cand.x, y: candidates[0].cand.y };
        }
      }
      const moveTo =
        chosenTile.x === unit.x && chosenTile.y === unit.y ? null : { x: chosenTile.x, y: chosenTile.y };
      return {
        role: "general_heal",
        moveTo,
        action: { type: "ability", abilityId: healAbility.id, name: healAbility.name },
      };
    }

    const attackOptions = [];
    if (!unit.acted) {
      for (const cand of reach.tiles) {
        const target = pickBestAttackTarget(unit, cand, enemies, null, preferLeader);
        if (!target) continue;
        const tile = tileAt(state.map, cand.x, cand.y);
        const targetDist = manhattan(cand.x, cand.y, target.x, target.y);
        const minEnemyDist = nearestEnemyDistance(cand, enemies);
        attackOptions.push({
          cand,
          target,
          canKill: target.hp <= unit.atk ? 1 : 0,
          isLeaderTarget: target.leader ? 1 : 0,
          targetHp: target.hp,
          rangedSafety: unit.range > 1 ? Math.min(unit.range, minEnemyDist) : 0,
          targetDist,
          cover: tile?.cover ? 1 : 0,
          height: tile?.height ?? 0,
          isBridge: tile?.bridge ? 1 : 0,
          moveCost: cand.cost,
          isCurrent: cand.x === unit.x && cand.y === unit.y ? 1 : 0,
        });
      }
    }

    if (attackOptions.length > 0) {
      attackOptions.sort((a, b) => {
        if (b.canKill !== a.canKill) return b.canKill - a.canKill;
        if (preferLeader && b.isLeaderTarget !== a.isLeaderTarget) return b.isLeaderTarget - a.isLeaderTarget;
        if (a.targetHp !== b.targetHp) return a.targetHp - b.targetHp;
        if (unit.range > 1 && b.rangedSafety !== a.rangedSafety) return b.rangedSafety - a.rangedSafety;
        if (b.cover !== a.cover) return b.cover - a.cover;
        if (b.height !== a.height) return b.height - a.height;
        if (b.isBridge !== a.isBridge) return b.isBridge - a.isBridge;
        if (b.isCurrent !== a.isCurrent) return b.isCurrent - a.isCurrent;
        return a.moveCost - b.moveCost;
      });
      const best = attackOptions[0];
      const moveTo =
        best.cand.x === unit.x && best.cand.y === unit.y ? null : { x: best.cand.x, y: best.cand.y };
      return {
        role: preferLeader ? "flank" : "general",
        moveTo,
        action: { type: "attack", target: best.target },
      };
    }

    if (unit.moved) {
      return { role: preferLeader ? "flank" : "general", moveTo: null, action: null };
    }

    const enemyLeader = enemies.find((e) => e.leader);
    const primaryTargets =
      preferLeader && enemyLeader
        ? [{ x: enemyLeader.x, y: enemyLeader.y }]
        : enemies.map((e) => ({ x: e.x, y: e.y }));

    const distToEnemy = computeDistanceField(primaryTargets, state, unit.id, {
      allyPenalty: 1.5,
      enemyPenalty: 4.0,
      preferUnoccupiedTargets: false,
    });

    const approachOptions = reach.tiles.map((cand) => {
      const tile = tileAt(state.map, cand.x, cand.y);
      const targetRef = preferLeader && enemyLeader ? [enemyLeader] : enemies;
      return {
        cand,
        pathDist: distToEnemy.get(tileKey(cand.x, cand.y)) ?? Infinity,
        manhDist: nearestEnemyDistance(cand, targetRef),
        cover: tile?.cover ? 1 : 0,
        isCurrent: cand.x === unit.x && cand.y === unit.y ? 1 : 0,
      };
    });

    approachOptions.sort((a, b) => {
      if (Math.abs(a.pathDist - b.pathDist) > 1e-6) return a.pathDist - b.pathDist;
      if (a.manhDist !== b.manhDist) return a.manhDist - b.manhDist;
      if (b.cover !== a.cover) return b.cover - a.cover;
      return b.isCurrent - a.isCurrent;
    });

    const best = approachOptions[0];
    const moveTo =
      !best || (best.cand.x === unit.x && best.cand.y === unit.y)
        ? null
        : { x: best.cand.x, y: best.cand.y };

    return { role: preferLeader ? "flank" : "general", moveTo, action: null };
  }

  function resolveUnitRole(unit, scenarioConfig) {
    if (unit.aiRole && unit.aiRole !== "general") return unit.aiRole;
    if (scenarioConfig?.unitAiRoles && unit.tag) {
      const mapped = scenarioConfig.unitAiRoles[unit.tag];
      if (mapped && mapped !== "general") return mapped;
    }
    if (scenarioConfig?.rules?.escapeUnitTag && unit.tag === scenarioConfig.rules.escapeUnitTag) {
      return "escape";
    }
    if (!scenarioConfig) {
      if (unit.tag === "masamune") return "escape";
      if (unit.tag === "oniwa") return "hold_bridge";
    }
    return "general";
  }

  function planUnitTurn(unit, state, scenarioConfig = null) {
    if (!unit || unit.hp <= 0 || unit.team !== "player") {
      return { role: "none", moveTo: null, action: null };
    }
    const aiRole = resolveUnitRole(unit, scenarioConfig);
    if (aiRole === "escape") {
      return planEscapeTurn(unit, state);
    }
    if (aiRole === "hold_bridge") {
      return planHoldBridgeTurn(unit, state);
    }
    if (aiRole === "hold_pos") {
      const anchor = scenarioConfig?.initialPositions?.[unit.tag] ?? { x: unit.x, y: unit.y };
      return planHoldPosTurn(unit, state, anchor);
    }
    const captureTiles = scenarioConfig?.rules?.playerCaptureTiles ?? [];
    if (aiRole === "flank") {
      return planGeneralTurn(unit, state, { preferLeader: true, captureTiles });
    }
    return planGeneralTurn(unit, state, {
      preferLeader: Boolean(scenarioConfig?.rules?.defeatEnemyLeader),
      captureTiles,
    });
  }

  const api = {
    planUnitTurn,
    expandMoveEventsToSteps,
    computeReachableMap,
    computeDistanceField,
    findGridPath,
    findBridgeSouthAnchor,
    findHealAbility,
    terrainCost,
    manhattan,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (globalScope) {
    globalScope.srpgAutoAi = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
