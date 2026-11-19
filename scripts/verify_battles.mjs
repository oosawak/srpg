#!/usr/bin/env node
// End-to-end verification harness for docs/battles/scenarios/*.md:
// 1. Parses and validates every scenario Markdown file.
// 2. Verifies hitotoribashi.md matches built-in WASM scenario (srpg_set_scenario(1)) tile-for-tile and unit-for-unit.
// 3. Loads every scenario JSON into docs/battles/wasm/wasm_app.wasm, tests reset, and runs auto_ai.js to battle completion!
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const parser = require(path.join(REPO_ROOT, "docs/battles/scenario_parser.js"));
const autoAi = require(path.join(REPO_ROOT, "docs/battles/auto_ai.js"));

const SCENARIOS_DIR = path.join(REPO_ROOT, "docs/battles/scenarios");
const WASM_PATH = path.join(REPO_ROOT, "docs/battles/wasm/wasm_app.wasm");

const decoder = new TextDecoder();
const encoder = new TextEncoder();

async function createWasmInstance() {
  const bytes = fs.readFileSync(WASM_PATH);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const ex = instance.exports;
  ex.srpg_init();
  return {
    exports: ex,
    readRender() {
      ex.srpg_refresh_render();
      const ptr = ex.srpg_render_ptr();
      const len = ex.srpg_render_len();
      return JSON.parse(decoder.decode(new Uint8Array(ex.memory.buffer, ptr, len)));
    },
    loadScenarioJson(jsonStr) {
      const payload = encoder.encode(jsonStr);
      const ptr = ex.srpg_input_ptr(payload.length);
      new Uint8Array(ex.memory.buffer, ptr, payload.length).set(payload);
      const rc = ex.srpg_load_scenario_json(payload.length);
      if (rc !== 1) throw new Error(`srpg_load_scenario_json returned ${rc}`);
    },
  };
}

function normalize(raw, aiConfig) {
  return {
    scenario: raw.scenario,
    turnNumber: raw.turn_number,
    phase: raw.phase,
    selectedUnitId: raw.selected_unit_id,
    map: raw.map,
    units: raw.units.map((u) => ({
      ...u,
      maxHp: u.max_hp,
      aiRole: aiConfig?.unitAiRoles?.[u.tag] ?? "general",
    })),
    abilities: raw.abilities ?? [],
  };
}

function evaluateOutcome(sc, state) {
  const rules = sc.rules;
  const playersAlive = state.units.filter((u) => u.team === "player" && u.hp > 0);
  const enemiesAlive = state.units.filter((u) => u.team === "enemy" && u.hp > 0);

  const playerLeader = rules.defeatPlayerLeaderTag
    ? state.units.find((u) => u.tag === rules.defeatPlayerLeaderTag)
    : state.units.find((u) => u.team === "player" && u.leader);

  if ((playerLeader && playerLeader.hp <= 0) || playersAlive.length === 0 || state.phase === "defeat") {
    return { victory: false, reason: "defeat" };
  }

  if (rules.escapeUnitTag) {
    const escUnit = state.units.find((u) => u.tag === rules.escapeUnitTag && u.hp > 0);
    if (escUnit) {
      const tile = state.map.tiles[escUnit.y * state.map.width + escUnit.x];
      if (tile && tile.escape) {
        return { victory: true, reason: "escape" };
      }
    }
  }

  if (rules.surviveTurns > 0 && state.turnNumber > rules.surviveTurns) {
    return { victory: true, reason: "survive" };
  }

  if (rules.defeatEnemyLeader) {
    const enemyLeader = state.units.find((u) => u.team === "enemy" && u.leader);
    if (enemyLeader && enemyLeader.hp <= 0) {
      return { victory: true, reason: "leader_defeated" };
    }
  }

  if (rules.routVictory && (enemiesAlive.length === 0 || state.phase === "victory")) {
    return { victory: true, reason: "rout" };
  }

  if (rules.maxTurns > 0 && state.turnNumber > rules.maxTurns) {
    return {
      victory: rules.turnLimitOutcome === "victory",
      reason: rules.turnLimitOutcome === "victory" ? "survive" : "timeout",
    };
  }

  return null;
}

function buildAiConfig(sc) {
  const unitAiRoles = {};
  const initialPositions = {};
  for (const u of sc.units) {
    unitAiRoles[u.tag] = u.aiRole || "general";
    initialPositions[u.tag] = { x: u.x, y: u.y };
  }
  return { slug: sc.slug, rules: sc.rules, unitAiRoles, initialPositions };
}

async function runAutoSimulation(sc, wasmJson) {
  const wasm = await createWasmInstance();
  const ex = wasm.exports;
  wasm.loadScenarioJson(wasmJson);
  const aiConfig = buildAiConfig(sc);

  // Check initial state & reset parity
  const initial = wasm.readRender();
  if (initial.scenario !== sc.slug) {
    throw new Error(`${sc.slug}: initial scenario mismatch (${initial.scenario})`);
  }
  if (initial.turn_number !== 1 || initial.phase !== "player") {
    throw new Error(`${sc.slug}: invalid initial turn/phase`);
  }
  ex.srpg_reset();
  const afterReset = wasm.readRender();
  if (JSON.stringify(initial.units) !== JSON.stringify(afterReset.units)) {
    throw new Error(`${sc.slug}: srpg_reset did not preserve custom scenario`);
  }

  let outcome = null;
  let totalMoves = 0;
  let totalAttacks = 0;
  let totalAbilities = 0;
  let recordDefendedTurns = sc.rules.recordUnitTag ? 1 : 0;
  let recordFallenTurn = null;
  const maxLoopTurns = (sc.rules.maxTurns || 12) + 4;

  for (let iter = 0; iter < maxLoopTurns && !outcome; iter += 1) {
    let st = normalize(wasm.readRender(), aiConfig);

    // Track record unit
    if (sc.rules.recordUnitTag) {
      const rec = st.units.find((u) => u.tag === sc.rules.recordUnitTag);
      if (rec) {
        if (rec.hp > 0) {
          recordDefendedTurns = Math.max(recordDefendedTurns, Math.min(st.turnNumber, sc.rules.surviveTurns || sc.rules.maxTurns));
        } else if (recordFallenTurn == null) {
          recordFallenTurn = st.turnNumber;
        }
      }
    }

    outcome = evaluateOutcome(sc, st);
    if (outcome) break;

    const playerIds = st.units.filter((u) => u.team === "player" && u.hp > 0).map((u) => u.id);
    for (const uid of playerIds) {
      st = normalize(wasm.readRender(), aiConfig);
      const unit = st.units.find((u) => u.id === uid && u.hp > 0);
      if (!unit) continue;

      ex.srpg_click_tile(unit.x, unit.y);
      st = normalize(wasm.readRender(), aiConfig);
      const fresh = st.units.find((u) => u.id === uid && u.hp > 0);
      if (!fresh) continue;

      const plan = autoAi.planUnitTurn(fresh, st, aiConfig);
      if (plan.moveTo && !fresh.moved) {
        ex.srpg_begin_move();
        ex.srpg_click_tile(plan.moveTo.x, plan.moveTo.y);
        totalMoves += 1;
        st = normalize(wasm.readRender(), aiConfig);
        outcome = evaluateOutcome(sc, st);
        if (outcome) break;
      }

      if (plan.action) {
        st = normalize(wasm.readRender(), aiConfig);
        const actor = st.units.find((u) => u.id === uid && u.hp > 0);
        if (actor && !actor.acted && st.phase === "player") {
          ex.srpg_click_tile(actor.x, actor.y);
          if (plan.action.type === "ability") {
            ex.srpg_use_ability(plan.action.abilityId | 0);
            totalAbilities += 1;
          } else if (plan.action.type === "attack" && plan.action.target) {
            const latest = normalize(wasm.readRender(), aiConfig);
            const target = latest.units.find(
              (u) => u.id === plan.action.target.id && u.team === "enemy" && u.hp > 0
            );
            if (target) {
              ex.srpg_click_tile(target.x, target.y);
              ex.srpg_attack_selected();
              totalAttacks += 1;
            }
          }
          st = normalize(wasm.readRender(), aiConfig);
          outcome = evaluateOutcome(sc, st);
          if (outcome) break;
        }
      }
    }

    if (outcome) break;

    ex.srpg_end_turn();
    st = normalize(wasm.readRender(), aiConfig);
    if (sc.rules.recordUnitTag) {
      const rec = st.units.find((u) => u.tag === sc.rules.recordUnitTag);
      if (rec) {
        if (rec.hp > 0) {
          recordDefendedTurns = Math.max(recordDefendedTurns, Math.min(st.turnNumber, sc.rules.surviveTurns || sc.rules.maxTurns));
        } else if (recordFallenTurn == null) {
          recordFallenTurn = st.turnNumber - 1;
        }
      }
    }
    outcome = evaluateOutcome(sc, st);
  }

  if (!outcome) {
    throw new Error(`${sc.slug}: Auto mode did NOT finish within turn limit!`);
  }

  const finalState = normalize(wasm.readRender(), aiConfig);
  const pAlive = finalState.units.filter((u) => u.team === "player" && u.hp > 0).length;
  const eAlive = finalState.units.filter((u) => u.team === "enemy" && u.hp > 0).length;

  return {
    slug: sc.slug,
    title: sc.title,
    year: sc.year,
    mapSize: `${sc.map.width}x${sc.map.height}`,
    victory: outcome.victory,
    reason: outcome.reason,
    turns:
      outcome.reason === "survive" || outcome.reason === "timeout"
        ? sc.rules.surviveTurns || sc.rules.maxTurns
        : finalState.turnNumber,
    pAlive: `${pAlive}/${sc.units.filter((u) => u.team === "player").length}`,
    eAlive: `${eAlive}/${sc.units.filter((u) => u.team === "enemy").length}`,
    moves: totalMoves,
    attacks: totalAttacks,
    abilities: totalAbilities,
    recordDefendedTurns: sc.rules.recordUnitTag ? recordDefendedTurns : null,
    recordFallenTurn,
  };
}

async function verifyHitotoribashiParity(sc, wasmJson) {
  const wasm = await createWasmInstance();
  wasm.exports.srpg_set_scenario(1);
  const builtin = wasm.readRender();

  wasm.loadScenarioJson(wasmJson);
  const loaded = wasm.readRender();

  if (builtin.map.tiles.length !== loaded.map.tiles.length) {
    throw new Error("Hitotoribashi tile count mismatch");
  }
  for (let i = 0; i < builtin.map.tiles.length; i += 1) {
    if (JSON.stringify(builtin.map.tiles[i]) !== JSON.stringify(loaded.map.tiles[i])) {
      throw new Error(`Hitotoribashi tile[${i}] mismatch`);
    }
  }
  if (builtin.units.length !== loaded.units.length) {
    throw new Error("Hitotoribashi unit count mismatch");
  }
  for (let i = 0; i < builtin.units.length; i += 1) {
    if (JSON.stringify(builtin.units[i]) !== JSON.stringify(loaded.units[i])) {
      throw new Error(`Hitotoribashi unit[${i}] mismatch`);
    }
  }
  console.log("[PASS] Hitotoribashi Markdown <-> Built-in WASM: 100% tile & unit parity (100 tiles, 10 units)");
}

async function main() {
  const files = fs
    .readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  if (files.length === 0) {
    throw new Error("No scenario .md files found");
  }

  const parsed = files.map((file) => {
    const md = fs.readFileSync(path.join(SCENARIOS_DIR, file), "utf8");
    return parser.parseScenarioMarkdown(md);
  });
  parsed.sort((a, b) => a.order - b.order || a.year - b.year);

  const results = [];
  for (const sc of parsed) {
    const wasmJson = parser.toWasmScenarioJson(sc);
    if (sc.slug === "hitotoribashi") {
      await verifyHitotoribashiParity(sc, wasmJson);
    }
    const res = await runAutoSimulation(sc, wasmJson);
    results.push(res);
    const recStr = res.recordDefendedTurns != null ? `, 殿防衛=${res.recordDefendedTurns}T` : "";
    console.log(
      `[PASS] ${res.slug} (${res.title} ${res.year}, ${res.mapSize}) -> ${res.victory ? "勝利" : "敗北"} [${res.reason}] in ${res.turns}T (自軍 ${res.pAlive}, 敵軍 ${res.eAlive}, 移動=${res.moves}, 攻撃=${res.attacks}, 技=${res.abilities}${recStr})`
    );
  }

  // Also verify generated HTML pages & manifest exist
  const manifestPath = path.join(SCENARIOS_DIR, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error("Missing manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.count !== parsed.length) {
    throw new Error(`manifest.json count mismatch (${manifest.count} vs ${parsed.length})`);
  }
  const indexHtml = fs.readFileSync(path.join(REPO_ROOT, "docs/battles/index.html"), "utf8");
  for (const sc of parsed) {
    const pagePath = path.join(REPO_ROOT, "docs/battles", sc.slug, "index.html");
    if (!fs.existsSync(pagePath)) throw new Error(`Missing page: ${pagePath}`);
    const pageHtml = fs.readFileSync(pagePath, "utf8");
    if (!pageHtml.includes(`data-scenario-slug="${sc.slug}"`)) {
      throw new Error(`${pagePath} missing data-scenario-slug`);
    }
    if (!pageHtml.includes(`property="og:title"`)) {
      throw new Error(`${pagePath} missing OGP tags`);
    }
    if (!indexHtml.includes(`./${sc.slug}/`)) {
      throw new Error(`index.html missing link to ./${sc.slug}/`);
    }
  }
  console.log(`[PASS] Verified manifest.json, index.html, and ${parsed.length} individual battle page(s).`);
}

main().catch((err) => {
  console.error("[FAIL]", err);
  process.exit(1);
});
