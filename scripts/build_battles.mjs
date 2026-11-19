#!/usr/bin/env node
// Generates docs/battles/scenarios/manifest.json, docs/battles/index.html,
// and docs/battles/<slug>/index.html purely from docs/battles/scenarios/*.md.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const parser = require("../docs/battles/scenario_parser.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const BATTLES_DIR = path.join(REPO_ROOT, "docs", "battles");
const SCENARIOS_DIR = path.join(BATTLES_DIR, "scenarios");
const SITE_BASE = "https://oosawak.github.io/srpg/battles";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderBattlePageHtml(sc) {
  const pageUrl = `${SITE_BASE}/${sc.slug}/`;
  const pageTitle = `${sc.title}（${sc.year}） — 政宗の戦場 SRPG`;
  const ogDesc = `${sc.date}・${sc.place}。${sc.forces}。${sc.overview}`.slice(0, 180);
  const ogImage = sc.keyart
    ? `${SITE_BASE}/${sc.keyart.replace(/^\.\.\//, "")}`
    : `${SITE_BASE}/assets/hitotoribashi-keyart.webp`;

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(ogDesc)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(ogDesc)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(ogDesc)}" />
    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
    <link rel="stylesheet" href="../engine.css" />
    <link rel="stylesheet" href="../style.css" />
  </head>
  <body data-scenario-slug="${escapeHtml(sc.slug)}">
    <main class="shell">
      <header class="hudHeader" aria-label="合戦状況">
        <div class="hudPrimary">
          <div class="hudTitleGroup">
            <a class="hudBackLink" href="../" title="合戦一覧へ戻る">← 合戦一覧</a>
            <span id="scenarioBadge" class="scenarioBadge">${escapeHtml(sc.title)}</span>
            <span id="turnBadge" class="turnBadge">第 1 / ${sc.rules.maxTurns} ターン</span>
            <span id="phaseBadge" class="phaseBadge phase-player">${escapeHtml(sc.playerArmy)}</span>
            <span id="autoStatusBadge" class="autoBadge" hidden aria-live="polite">自動進行中（クリック／キーで手動へ）</span>
          </div>
          <div id="objectiveBanner" class="objectiveBanner">
            目標: ${escapeHtml(sc.victoryText)}
          </div>
        </div>
        <div class="hudCounters">
          <div class="forcePill force-player">
            <span class="forceDot"></span>
            <span id="playerForceLabel">${escapeHtml(sc.playerArmy)}</span>
          </div>
          <div class="forcePill force-enemy">
            <span class="forceDot"></span>
            <span id="enemyForceLabel">${escapeHtml(sc.enemyArmy)}</span>
          </div>
          <div id="recordStatusPill" class="forcePill force-oniwa" hidden></div>
        </div>
        <div class="hudTools">
          <label class="zoomControl" for="zoomRange" title="拡大縮小">
            <span id="zoomLabel">100%</span>
            <input id="zoomRange" type="range" min="30" max="200" step="5" value="100" />
          </label>
          <button id="autoToggle" class="iconBtn autoToggleBtn" type="button" aria-pressed="false" title="自動進行のオン/オフ">自動: OFF</button>
          <button id="muteToggle" class="iconBtn" type="button" aria-pressed="false" title="音のオン/オフ">🔊 音</button>
          <button id="shareBattle" class="iconBtn" type="button" title="この合戦のURLを共有">共有</button>
          <button id="helpOpen" class="iconBtn" type="button" title="操作一覧">？操作</button>
          <button id="titleReturn" class="iconBtn" type="button" title="開始画面へ戻る">幕舎</button>
        </div>
      </header>

      <section class="board">
        <div class="canvasWrap" id="canvasWrap">
          <div class="gameControls">
            <button id="toggleView" class="primary" type="button" onclick="window.srpgUi && window.srpgUi.toggleView()">切替: 斜め見下ろし</button>
            <button id="endTurn" class="accent" type="button" onclick="window.srpgUi && window.srpgUi.endTurn()">ターン終了</button>
            <button id="resetView" class="secondary" type="button" onclick="window.srpgUi && window.srpgUi.reset()">やり直し</button>
          </div>

          <div id="phaseBanner" class="phaseBanner" hidden aria-live="polite">
            <div id="phaseBannerSub" class="phaseBannerSub"></div>
            <div id="phaseBannerTitle" class="phaseBannerTitle"></div>
          </div>

          <div class="unitCard unitCardOverlay" id="playerUnitCardOverlay" hidden>
            <h3 class="unitCardHeader">
              <span>操作・地形情報</span>
              <button id="unitPanelClose" class="unitPanelClose" type="button" aria-label="情報ウィンドウを閉じる">✕</button>
            </h3>
            <div id="unitInfo" class="unitInfo">ユニットをクリックしてください</div>
            <div id="unitActions" class="unitActions"></div>
          </div>

          <aside class="unitCard faceCardOverlay" id="unitFaceCard" hidden aria-label="武将・部隊カード">
            <div class="unitCardHeader faceCardHeader">
              <span id="faceCardFaction" class="faceCardFaction">武将情報</span>
              <button id="faceCardClose" class="unitPanelClose" type="button" aria-label="顔カードを閉じる">✕</button>
            </div>
            <div id="faceCardBody" class="faceCardBody"></div>
            <div id="faceCardActions" class="unitActions"></div>
          </aside>

          <div id="attackFxOverlay" class="attackFxOverlay" hidden></div>

          <div id="abilityCutinOverlay" class="abilityCutinOverlay" hidden role="status" aria-live="polite" title="タップ／クリックでスキップ">
            <div class="abilityCutinBand">
              <div id="abilityCutinPortrait" class="abilityCutinPortrait"></div>
              <div class="abilityCutinText">
                <div id="abilityCutinSub" class="abilityCutinSub"></div>
                <div id="abilityCutinName" class="abilityCutinName"></div>
                <div class="abilityCutinHint">タップ／クリックでスキップ</div>
              </div>
            </div>
          </div>

          <div class="unitCard abilityCardOverlay" id="abilityCardOverlay">
            <h3 class="unitCardHeader">
              <span>アビリティ</span>
            </h3>
            <div id="abilityList" class="abilityList"></div>
          </div>

          <canvas id="mapCanvas" width="960" height="720" aria-label="合戦マップ"></canvas>
        </div>

        <aside class="panel">
          <section class="panelSection objectiveCard">
            <h2>勝敗条件</h2>
            <p id="objectiveDetail" class="objectiveDetail">
              <strong>勝利:</strong> ${escapeHtml(sc.victoryText)}<br />
              <strong>敗北:</strong> ${escapeHtml(sc.defeatText)}
            </p>
            <div id="recordSummaryLine" class="oniwaSummaryLine" hidden></div>
          </section>

          <section class="panelSection battleLogSection">
            <div class="sectionHead">
              <h2>戦況ログ</h2>
              <span id="logCount" class="logCount">0件</span>
            </div>
            <ul id="battleLog" class="battleLog" aria-live="polite"></ul>
          </section>

          <section class="panelSection statusDetailsSection">
            <h2>戦場情報</h2>
            <dl class="stats">
              <div><dt>視点</dt><dd id="viewName">斜め見下ろし</dd></div>
              <div><dt>ターン</dt><dd id="turnNumber">1</dd></div>
              <div><dt>フェーズ</dt><dd id="phaseName">${escapeHtml(sc.playerArmy)}</dd></div>
              <div><dt>選択中</dt><dd id="selectedUnit">-</dd></div>
              <div><dt>残存数</dt><dd id="unitCount">${sc.units.length}</dd></div>
            </dl>
            <div id="bootStatus" class="bootStatus" hidden>booting...</div>
            <div id="inputProbe" class="bootStatus" hidden>input: none</div>
          </section>

          <section class="panelSection legend">
            <h3>地形凡例</h3>
            <ul id="terrainLegendList"></ul>
          </section>

          <section class="panelSection basisLegend">
            <h3>種別の印と出典</h3>
            <p class="basisDesc">
              <span class="basisBadge basis-fact">史実</span>
              <span class="basisBadge basis-legend">伝承</span>
              <span class="basisBadge basis-fiction">創作</span>
              は内容の種別の目安です。合戦の骨格と主要武将は本『伊達の国』および既存資料に基づき、模式部隊と盤面配置はゲーム用の創作です。
            </p>
            <a
              id="panelBookLink"
              class="bookLinkInline"
              href="${escapeHtml(sc.bookUrl || "#")}"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${escapeHtml(sc.bookChapter || "『伊達の国』")}を読む ↗
            </a>
          </section>
        </aside>
      </section>
    </main>

    <!-- 開始画面オーバーレイ -->
    <div id="startOverlay" class="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="startTitle">
      <div class="startCard">
        <div id="startArtWrap" class="startArtWrap ${sc.keyart ? "has-image" : `theme-banner theme-${escapeHtml(sc.theme || "autumn")}`}">
          <img id="startArtImg" class="startArt" width="800" height="533"${sc.keyart ? ` src="${escapeHtml(sc.keyart)}" alt="${escapeHtml(sc.title)} キーアート"` : ` hidden alt=""`} />
          <div id="startArtEmblem" class="startArtEmblem" aria-hidden="true">${escapeHtml(sc.year ? String(sc.year) : "")}</div>
          <div class="startArtScrim"></div>
          <div class="startArtCaption">
            <p id="startEyebrow" class="startEyebrow">${escapeHtml(sc.date)} ${escapeHtml(sc.place)}</p>
            <h1 id="startTitle">${escapeHtml(sc.title)}</h1>
            <p id="startSubtitle" class="startSubtitle">${escapeHtml(sc.forces)}</p>
          </div>
        </div>

        <div class="startBody">
          <div class="startGrid">
            <div class="startBlock">
              <h2>合戦の概況</h2>
              <p id="startOverview">${escapeHtml(sc.overview)}</p>
              <div class="startBookRow">
                <a
                  id="startBookLink"
                  class="bookLinkBtn"
                  href="${escapeHtml(sc.bookUrl || "#")}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📖 本${escapeHtml(sc.bookChapter || "『伊達の国』")}を読む ↗
                </a>
                <span class="startBasisNote">
                  <span class="basisBadge basis-fact">史実</span>
                  <span class="basisBadge basis-legend">伝承</span>
                  <span class="basisBadge basis-fiction">創作</span>
                  盤面は模式図
                </span>
              </div>
            </div>

            <div class="startBlock">
              <h2>勝敗条件と操作</h2>
              <ul id="startRulesList" class="startRules"></ul>
              <div class="startAudioRow">
                <label class="audioToggle">
                  <input id="startMuteCheck" type="checkbox" />
                  <span>音をミュートする</span>
                </label>
                <label class="volumeControl" for="startVolumeRange">
                  <span>音量</span>
                  <input id="startVolumeRange" type="range" min="0" max="100" step="5" value="65" />
                  <span id="startVolumeLabel">65%</span>
                </label>
              </div>
            </div>
          </div>

          <div class="startActions">
            <button id="startBattleBtn" class="primary startMainBtn" type="button">
              出陣 — ${escapeHtml(sc.title)}
            </button>
            <button id="startAutoBattleBtn" class="accent startAutoBtn" type="button">
              自動で見る
            </button>
            <a class="hudBackLink" href="../" style="padding: 12px 18px; font-size: 13px;">
              ← 合戦一覧へ戻る
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- 決着カットイン＆結果サマリーオーバーレイ -->
    <div id="resultOverlay" class="modalOverlay" hidden role="dialog" aria-modal="true" aria-labelledby="resultTitle">
      <div id="resultCutin" class="resultCutin" hidden>
        <p id="resultCutinSub" class="resultCutinSub"></p>
        <h2 id="resultCutinTitle" class="resultCutinTitle"></h2>
        <button id="resultCutinSkip" class="secondary resultSkipBtn" type="button">結果を見る</button>
      </div>

      <div id="resultCard" class="resultCard" hidden>
        <p id="resultEyebrow" class="resultEyebrow">合戦決着</p>
        <h2 id="resultTitle"></h2>
        <p id="resultLead" class="resultLead"></p>

        <dl class="resultStats">
          <div>
            <dt>経過ターン</dt>
            <dd id="resTurns">-</dd>
          </div>
          <div>
            <dt id="resRecordLabel">防衛記録</dt>
            <dd id="resRecordValue">-</dd>
          </div>
          <div>
            <dt id="resPlayerLabel">自軍 残存</dt>
            <dd id="resPlayerAlive">-</dd>
          </div>
          <div>
            <dt id="resEnemyLabel">敵軍 残存</dt>
            <dd id="resEnemyAlive">-</dd>
          </div>
        </dl>

        <div id="resRoster" class="resRoster"></div>

        <div id="resultBookBox" class="resultBookBox">
          <p id="resultBookDesc"></p>
          <a
            id="resultBookLink"
            class="bookLinkBtn"
            href="${escapeHtml(sc.bookUrl || "#")}"
            target="_blank"
            rel="noopener noreferrer"
          >
            📖 本${escapeHtml(sc.bookChapter || "『伊達の国』")}へ ↗
          </a>
        </div>

        <div class="resultActions">
          <button id="resultShareBtn" class="secondary" type="button">この合戦を共有</button>
          <button id="resultRetryAuto" class="accent" type="button">もう一度自動で見る</button>
          <button id="resultRetry" class="primary" type="button">もう一度出陣</button>
          <button id="resultToTitle" class="secondary" type="button">開始画面へ戻る</button>
        </div>
      </div>
    </div>

    <!-- 操作ヘルプモーダル -->
    <div id="helpOverlay" class="modalOverlay" hidden role="dialog" aria-modal="true" aria-labelledby="helpTitle">
      <div class="helpCard">
        <div class="helpHeader">
          <h2 id="helpTitle">操作一覧・戦場の見方</h2>
          <button id="helpClose" class="unitPanelClose" type="button" aria-label="閉じる">✕</button>
        </div>
        <div class="helpGrid">
          <div>
            <h3>マウス・タップ操作</h3>
            <ul>
              <li><strong>味方をタップ/クリック:</strong> 部隊情報と地形効果を表示</li>
              <li><strong>「移動」ボタン（または味方を長押し）:</strong> 移動範囲（青マス）を表示し、青マスをタップで移動</li>
              <li><strong>「移動を戻す」:</strong> 攻撃前なら移動をやり直し可能</li>
              <li><strong>赤い敵をタップ→「攻撃」（または再タップ/長押し）:</strong> 射程内の敵を攻撃</li>
              <li><strong>アビリティ:</strong> 軍師の「陣形変更」（周囲回復）、足軽の「押し込み」、弓隊の「曲射」、鉄砲隊の「火縄チャージ」など</li>
              <li><strong>「ターン終了」:</strong> 敵軍フェイズへ進める</li>
              <li><strong>「自動: ON/OFF」:</strong> 両軍をAIで自動進行。実行中でもクリック／タップ／キー入力で手動へ復帰</li>
            </ul>
          </div>
          <div>
            <h3>キーボード操作（PC）</h3>
            <ul>
              <li><strong>M:</strong> 選択中ユニットの移動開始</li>
              <li><strong>Esc:</strong> 移動キャンセル／モーダルを閉じる</li>
              <li><strong>E:</strong> ターン終了</li>
              <li><strong>V:</strong> 斜め見下ろし／真上2D切替</li>
              <li><strong>H / ?:</strong> この操作一覧を開く</li>
            </ul>
            <h3>音量設定</h3>
            <div class="startAudioRow">
              <label class="audioToggle">
                <input id="helpMuteCheck" type="checkbox" />
                <span>ミュート</span>
              </label>
              <label class="volumeControl" for="helpVolumeRange">
                <span>音量</span>
                <input id="helpVolumeRange" type="range" min="0" max="100" step="5" value="65" />
                <span id="helpVolumeLabel">65%</span>
              </label>
            </div>
          </div>
        </div>
        <div class="helpFooter">
          <button id="helpCloseBtn" class="primary" type="button">戦場へ戻る</button>
        </div>
      </div>
    </div>

    <div id="shareToast" class="shareToast" hidden role="status" aria-live="polite"></div>

    <script src="../scenario_parser.js"></script>
    <script src="../wasm_bridge.js"></script>
    <script src="../sound.js"></script>
    <script src="../auto_ai.js"></script>
    <script src="../app.js"></script>
  </body>
</html>
`;
}

function renderIndexPageHtml(scenarios) {
  const cardsHtml = scenarios
    .map((sc) => {
      const hasArt = Boolean(sc.keyart);
      const artPath = hasArt ? `./${sc.keyart.replace(/^\.\.\//, "")}` : "";
      const topStyle = hasArt ? ` style="background-image:url('${escapeHtml(artPath)}')"` : "";
      const topClass = hasArt ? "battleCardTop has-keyart" : "battleCardTop";
      const playerCount = sc.units.filter((u) => u.team === "player").length;
      const enemyCount = sc.units.filter((u) => u.team === "enemy").length;
      const bookRow = sc.bookUrl
        ? `<a class="bookLinkInline" href="${escapeHtml(sc.bookUrl)}" target="_blank" rel="noopener noreferrer">📖 ${escapeHtml(sc.bookChapter || "『伊達の国』")} ↗</a>`
        : "";

      return `        <article class="battleCard">
          <div class="${topClass}"${topStyle}>
            <span class="battleYearPill">${escapeHtml(sc.year ? `${sc.year}年` : sc.date)}</span>
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
              <span class="battleCardChip">最大 ${sc.rules.maxTurns}T</span>
            </div>
            ${bookRow}
            <div class="battleCardActions">
              <a class="battlePlayLink" href="./${escapeHtml(sc.slug)}/">出陣する →</a>
              <a class="battleAutoLink" href="./${escapeHtml(sc.slug)}/?auto=1">自動で見る</a>
            </div>
          </div>
        </article>`;
    })
    .join("\n");

  const ogDesc = `伊達政宗の主要合戦を1合戦＝1Markdownファイルで再現する戦国SRPG「政宗の戦場」セット（全${scenarios.length}本）。本『伊達の国』各章と連動。`;

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>政宗の戦場 — 戦国SRPG 合戦一覧</title>
    <meta name="description" content="${escapeHtml(ogDesc)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="政宗の戦場 — 戦国SRPG 合戦一覧" />
    <meta property="og:description" content="${escapeHtml(ogDesc)}" />
    <meta property="og:url" content="${SITE_BASE}/" />
    <meta property="og:image" content="${SITE_BASE}/assets/hitotoribashi-keyart.webp" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="canonical" href="${SITE_BASE}/" />
    <link rel="stylesheet" href="./engine.css" />
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="portalShell">
      <header class="portalHero">
        <p class="portalEyebrow">DATE MASAMUNE TACTICAL ARCHIVE</p>
        <h1>政宗の戦場 — 合戦シナリオ一覧</h1>
        <p class="portalLead">
          本『伊達の国』の各章とつながる伊達政宗の主要合戦を、<strong>1合戦＝1 Markdownファイル</strong>のシナリオ定義と Rust/WASM エンジンで遊べる戦国SRPGです。各合戦は固有URLでそのまま共有でき、手動操作にも「自動で見る」観戦にも対応しています。
        </p>
        <div class="portalMetaRow">
          <span id="portalCountBadge" class="portalCountBadge">収録合戦 ${scenarios.length} 本</span>
          <span class="startBasisNote">
            <span class="basisBadge basis-fact">史実</span>
            <span class="basisBadge basis-legend">伝承</span>
            <span class="basisBadge basis-fiction">創作</span>
            資料に無い武将名は創作せず、模式部隊・地形模式化を明記
          </span>
        </div>
      </header>

      <section id="battleCardGrid" class="battleCardGrid" aria-label="合戦一覧">
${cardsHtml}
      </section>

      <footer class="portalFooter">
        <span>一覧は <code>docs/battles/scenarios/*.md</code> から自動生成されています。</span>
        <span>
          <a href="../play/">現行の人取橋ページ（docs/play/）を見る</a>
          ／
          <a href="https://oosawak.github.io/date-no-kuni/" target="_blank" rel="noopener noreferrer">本『伊達の国』へ ↗</a>
        </span>
      </footer>
    </main>

    <script src="./scenario_parser.js"></script>
    <script src="./index.js"></script>
  </body>
</html>
`;
}

function main() {
  const files = fs
    .readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const scenarios = [];
  for (const file of files) {
    const mdText = fs.readFileSync(path.join(SCENARIOS_DIR, file), "utf8");
    const sc = parser.parseScenarioMarkdown(mdText);
    sc._file = file;
    scenarios.push(sc);
  }

  scenarios.sort((a, b) => a.order - b.order || a.year - b.year || a.slug.localeCompare(b.slug));

  // 1. Write manifest.json
  const manifest = {
    generated_from: "docs/battles/scenarios/*.md",
    count: scenarios.length,
    files: scenarios.map((sc) => sc._file),
    slugs: scenarios.map((sc) => sc.slug),
  };
  fs.writeFileSync(
    path.join(SCENARIOS_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );

  // 2. Write docs/battles/index.html
  fs.writeFileSync(path.join(BATTLES_DIR, "index.html"), renderIndexPageHtml(scenarios), "utf8");

  // 3. Write docs/battles/<slug>/index.html for each scenario
  for (const sc of scenarios) {
    const outDir = path.join(BATTLES_DIR, sc.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), renderBattlePageHtml(sc), "utf8");
  }

  console.log(`Generated battles portal + ${scenarios.length} battle page(s): ${scenarios.map((s) => s.slug).join(", ")}`);
}

main();
