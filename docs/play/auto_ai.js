// Pure role-based player AI & 1-tile move expansion for SRPG Auto Mode.
// Works both in browser (window.srpgAutoAi) and Node.js (module.exports) for WASM integration testing.
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

  // Dijkstra reachable tiles matching wasm_app::GameState::reachable_tiles
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

  // Reconstruct 1-tile-at-a-time grid path from start to dest within reachable map (or shortest valid path)
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

    // Fallback: unconstrained shortest non-water path
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

  // Expand a multi-tile player move event into 1-tile step events for enemy-style playback
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

  // Reverse multi-source Dijkstra: remaining movement cost from any tile (x,y) to reach targets.
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

  function pickBestAttackTarget(attacker, pos, enemies, anchor = null) {
    const inRange = enemies.filter((e) => manhattan(pos.x, pos.y, e.x, e.y) <= attacker.range);
    if (inRange.length === 0) return null;
    inRange.sort((a, b) => {
      const aKill = a.hp <= attacker.atk ? 0 : 1;
      const bKill = b.hp <= attacker.atk ? 0 : 1;
      if (aKill !== bKill) return aKill - bKill;
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

  // Role 1: 伊達政宗 — 北端の離脱マスへ最短経路で進む。移動を優先し、攻撃は隣接した敵への通常攻撃のみ。
  function planMasamuneTurn(unit, state) {
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
      // Immediate escape check
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
            y: cand.y,
            enemyDist,
            cover: tile?.cover ? 1 : 0,
            isCurrent: cand.x === unit.x && cand.y === unit.y,
          };
        });

        scored.sort((a, b) => {
          if (Math.abs(a.pathDist - b.pathDist) > 1e-6) return a.pathDist - b.pathDist;
          if (a.y !== b.y) return a.y - b.y;
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

    // If Masamune reached an escape tile, victory triggers right after move.
    if (finalTile && finalTile.escape) {
      return { role: "masamune", moveTo, action: null };
    }

    // Attack ONLY adjacent enemies with normal attack (no chasing, no offensive abilities).
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

    return { role: "masamune", moveTo, action };
  }

  // Role 2: 鬼庭良直 — 人取橋の南詰め付近に留まり、射程内の敵を攻撃。2マス以上は追わない。
  function planOniwaTurn(unit, state) {
    const anchor = findBridgeSouthAnchor(state, unit);
    const enemies = aliveEnemies(state);
    const reach = computeReachableMap(unit, state);

    // Strict patrol zone: Manhattan distance <= 1 from south end of Hitotoribashi (never chase >= 2 tiles)
    const allowedTiles = reach.tiles.filter((cand) => manhattan(cand.x, cand.y, anchor.x, anchor.y) <= 1);

    let chosenTile = { x: unit.x, y: unit.y };
    if (!unit.moved) {
      if (allowedTiles.length === 0) {
        // If somehow displaced far from the bridge (e.g. after manual play), march back toward bridge south end
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
        // Prefer tiles in allowed zone that can attack an enemy, strongly prioritizing holding anchor / bridge
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
          // No enemy within range of the bridge patrol zone: hold anchor (south end of bridge)
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
            return (a.x === unit.x && a.y === unit.y) ? -1 : 1;
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

    return { role: "oniwa", moveTo, action };
  }

  // Role 3: 伊達成実・その他の伊達軍・従来デモ配置 — 最寄りの敵へ接近して攻撃。HP3割以下で回復系アビリティがあれば使用。
  function planGeneralTurn(unit, state) {
    const enemies = aliveEnemies(state);
    if (enemies.length === 0) {
      return { role: "general", moveTo: null, action: null };
    }

    const reach = computeReachableMap(unit, state);
    const maxHp = unit.maxHp ?? unit.max_hp ?? unit.hp ?? 1;
    const isLowHp = maxHp > 0 && unit.hp * 10 <= maxHp * 3;
    const healAbility = !unit.acted ? findHealAbility(unit, state) : null;

    if (isLowHp && healAbility) {
      // Optional defensive/support positioning before using healing ability
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

    // Check if any reachable tile lets this unit attack an enemy
    const attackOptions = [];
    if (!unit.acted) {
      for (const cand of reach.tiles) {
        const target = pickBestAttackTarget(unit, cand, enemies);
        if (!target) continue;
        const tile = tileAt(state.map, cand.x, cand.y);
        const targetDist = manhattan(cand.x, cand.y, target.x, target.y);
        const minEnemyDist = nearestEnemyDistance(cand, enemies);
        attackOptions.push({
          cand,
          target,
          canKill: target.hp <= unit.atk ? 1 : 0,
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
        role: "general",
        moveTo,
        action: { type: "attack", target: best.target },
      };
    }

    // Otherwise approach the nearest enemy using terrain-aware shortest path
    if (unit.moved) {
      return { role: "general", moveTo: null, action: null };
    }

    const distToEnemy = computeDistanceField(
      enemies.map((e) => ({ x: e.x, y: e.y })),
      state,
      unit.id,
      { allyPenalty: 1.5, enemyPenalty: 4.0, preferUnoccupiedTargets: false }
    );

    const approachOptions = reach.tiles.map((cand) => {
      const tile = tileAt(state.map, cand.x, cand.y);
      return {
        cand,
        pathDist: distToEnemy.get(tileKey(cand.x, cand.y)) ?? Infinity,
        manhDist: nearestEnemyDistance(cand, enemies),
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

    return { role: "general", moveTo, action: null };
  }

  function planUnitTurn(unit, state) {
    if (!unit || unit.hp <= 0 || unit.team !== "player") {
      return { role: "none", moveTo: null, action: null };
    }
    if (unit.tag === "masamune") {
      return planMasamuneTurn(unit, state);
    }
    if (unit.tag === "oniwa") {
      return planOniwaTurn(unit, state);
    }
    return planGeneralTurn(unit, state);
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
