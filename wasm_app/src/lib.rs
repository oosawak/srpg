use core::fmt::Write;
use srpg_core::{Job, Map, Terrain, Tile, ViewMode};
use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};

mod scenario_json;

type UnitId = u32;

#[derive(Clone, Copy, PartialEq, Eq)]
enum ScenarioKind {
    Demo,
    Hitotoribashi,
    Custom,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Team {
    Player,
    Enemy,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Phase {
    Player,
    Enemy,
    Victory,
    Defeat,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum InteractionMode {
    Move,
}

#[derive(Clone)]
struct UnitState {
    id: UnitId,
    clan: u32,
    job: Job,
    team: Team,
    x: i32,
    y: i32,
    hp: i32,
    max_hp: i32,
    atk: i32,
    mov: i32,
    range: i32,
    moved: bool,
    acted: bool,
    leader: bool,
    name: String,
    role: String,
    tag: String,
    basis: String,
    note: String,
}

#[derive(Clone)]
enum TurnEvent {
    Move {
        unit_id: UnitId,
        from_x: i32,
        from_y: i32,
        to_x: i32,
        to_y: i32,
    },
    Attack {
        attacker_id: UnitId,
        target_id: UnitId,
        damage: i32,
        killed: bool,
        target_hp: i32,
    },
    Ability {
        unit_id: UnitId,
        name: &'static str,
        target_id: Option<UnitId>,
        damage: i32,
        healed: i32,
    },
}

#[derive(Clone)]
struct AbilityView {
    id: u32,
    name: &'static str,
    range: i32,
    cost: i32,
}

struct GameState {
    scenario: ScenarioKind,
    scenario_slug: String,
    custom_scenario_json: Option<String>,
    bridge_label: String,
    escape_label: String,
    view_mode: ViewMode,
    turn_number: u32,
    phase: Phase,
    selected_unit_id: Option<UnitId>,
    selected_tile: Option<(i32, i32)>,
    interaction_mode: Option<InteractionMode>,
    move_origin: Option<(UnitId, i32, i32, bool)>,
    message: String,
    map: Map,
    bridge_tiles: HashSet<(i32, i32)>,
    escape_tiles: HashSet<(i32, i32)>,
    units: Vec<UnitState>,
    turn_events: Vec<TurnEvent>,
    event_seq: u32,
    render_buffer: String,
}

static GAME: OnceLock<Mutex<GameState>> = OnceLock::new();
static INPUT_BUF: OnceLock<Mutex<Vec<u8>>> = OnceLock::new();

fn input_buf_cell() -> &'static Mutex<Vec<u8>> {
    INPUT_BUF.get_or_init(|| Mutex::new(Vec::new()))
}

#[no_mangle]
pub extern "C" fn srpg_init() {
    let _ = game_cell();
}

#[no_mangle]
pub extern "C" fn srpg_input_ptr(len: usize) -> *mut u8 {
    let mut buf = input_buf_cell()
        .lock()
        .unwrap_or_else(|poison| poison.into_inner());
    buf.resize(len, 0);
    buf.as_mut_ptr()
}

#[no_mangle]
pub extern "C" fn srpg_load_scenario_json(len: usize) -> i32 {
    let raw = {
        let buf = input_buf_cell()
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        if len > buf.len() {
            return -1;
        }
        match core::str::from_utf8(&buf[..len]) {
            Ok(s) => s.to_string(),
            Err(_) => return -2,
        }
    };
    let parsed = match scenario_json::parse_scenario_json(&raw) {
        Ok(p) => p,
        Err(_) => return -3,
    };
    with_game_mut(|game| {
        let view_mode = game.view_mode;
        *game = GameState::from_parsed_scenario(parsed, raw);
        game.view_mode = view_mode;
        game.refresh_render();
    });
    1
}

#[no_mangle]
pub extern "C" fn srpg_reset() {
    with_game_mut(|game| {
        let scenario = game.scenario;
        let view_mode = game.view_mode;
        if scenario == ScenarioKind::Custom {
            if let Some(raw) = game.custom_scenario_json.clone() {
                if let Ok(parsed) = scenario_json::parse_scenario_json(&raw) {
                    *game = GameState::from_parsed_scenario(parsed, raw);
                    game.view_mode = view_mode;
                    game.refresh_render();
                    return;
                }
            }
        }
        *game = GameState::new_for_scenario(scenario);
        game.view_mode = view_mode;
        game.refresh_render();
    });
}

#[no_mangle]
pub extern "C" fn srpg_set_scenario(scenario_id: u32) {
    with_game_mut(|game| {
        let scenario = match scenario_id {
            1 => ScenarioKind::Hitotoribashi,
            _ => ScenarioKind::Demo,
        };
        let view_mode = game.view_mode;
        *game = GameState::new_for_scenario(scenario);
        game.view_mode = view_mode;
        game.refresh_render();
    });
}

#[no_mangle]
pub extern "C" fn srpg_toggle_view() {
    with_game_mut(|game| {
        game.view_mode = match game.view_mode {
            ViewMode::Isometric => ViewMode::TopDown,
            ViewMode::TopDown => ViewMode::Isometric,
        };
        game.message = if matches!(game.view_mode, ViewMode::Isometric) {
            "斜め見下ろしへ切替".to_string()
        } else {
            "真上 2D へ切替".to_string()
        };
        game.refresh_render();
    });
}

#[no_mangle]
pub extern "C" fn srpg_end_turn() {
    with_game_mut(|game| {
        if matches!(game.phase, Phase::Player) {
            game.end_player_turn();
        }
    });
}

#[no_mangle]
pub extern "C" fn srpg_begin_move() {
    with_game_mut(|game| {
        game.begin_move_selection();
        game.refresh_render();
    });
}

#[no_mangle]
pub extern "C" fn srpg_cancel_move() {
    with_game_mut(|game| {
        game.cancel_move_selection();
        game.refresh_render();
    });
}

#[no_mangle]
pub extern "C" fn srpg_attack_selected() {
    with_game_mut(|game| {
        game.attack_selected_tile();
        game.refresh_render();
    });
}

#[no_mangle]
pub extern "C" fn srpg_click_tile(x: i32, y: i32) {
    with_game_mut(|game| {
        game.handle_click(x, y);
        game.refresh_render();
    });
}

#[no_mangle]
pub extern "C" fn srpg_use_ability(index: u32) {
    with_game_mut(|game| {
        game.use_ability(index);
        game.refresh_render();
    });
}

#[no_mangle]
pub extern "C" fn srpg_refresh_render() {
    with_game_mut(|game| game.refresh_render());
}

#[no_mangle]
pub extern "C" fn srpg_render_ptr() -> *const u8 {
    with_game(|game| game.render_buffer.as_ptr()).unwrap_or(core::ptr::null())
}

#[no_mangle]
pub extern "C" fn srpg_render_len() -> usize {
    with_game(|game| game.render_buffer.len()).unwrap_or(0)
}

fn with_game_mut<F: FnOnce(&mut GameState)>(f: F) {
    let lock = game_cell().lock().unwrap_or_else(|poison| poison.into_inner());
    let mut game = lock;
    f(&mut game);
}

fn with_game<R, F: FnOnce(&GameState) -> R>(f: F) -> Option<R> {
    let lock = GAME.get()?;
    let guard = lock.lock().unwrap_or_else(|poison| poison.into_inner());
    Some(f(&guard))
}

fn game_cell() -> &'static Mutex<GameState> {
    GAME.get_or_init(|| Mutex::new(GameState::new()))
}

impl GameState {
    fn new() -> Self {
        Self::new_for_scenario(ScenarioKind::Hitotoribashi)
    }

    fn new_for_scenario(scenario: ScenarioKind) -> Self {
        let (map, bridge_tiles, escape_tiles, units, message, initial_tile) = match scenario {
            ScenarioKind::Demo => {
                let map = build_demo_map();
                let units = vec![
                    UnitState::new(1, 1, Job::Ashigaru, Team::Player, 2, 2, 100, 14, 4, 1)
                        .with_meta(true, "", "", "", "", ""),
                    UnitState::new(2, 1, Job::Yumi, Team::Player, 1, 5, 80, 12, 4, 3),
                    UnitState::new(3, 2, Job::Teppo, Team::Enemy, 6, 2, 90, 13, 3, 2)
                        .with_meta(true, "", "", "", "", ""),
                    UnitState::new(4, 2, Job::Ninja, Team::Enemy, 6, 5, 70, 11, 4, 1),
                ];
                (
                    map,
                    HashSet::new(),
                    HashSet::new(),
                    units,
                    "自軍の行動です".to_string(),
                    (2, 2),
                )
            }
            ScenarioKind::Hitotoribashi => {
                let (map, bridge_tiles, escape_tiles) = build_hitotoribashi_map();
                let units = vec![
                    UnitState::new(1, 1, Job::Strategist, Team::Player, 4, 4, 90, 13, 2, 1)
                        .with_meta(
                            true,
                            "伊達政宗",
                            "伊達本隊・大将",
                            "masamune",
                            "fact",
                            "19歳。父・輝宗の横死直後。矢弾が迫る中、北端（小浜方面）の離脱路を目指す。",
                        ),
                    UnitState::new(2, 1, Job::Yari, Team::Player, 4, 6, 135, 17, 3, 1)
                        .with_meta(
                            false,
                            "鬼庭良直",
                            "殿（しんがり）・左月斎",
                            "oniwa",
                            "legend",
                            "73歳。政宗より金色の采配を預かり、黄の綿帽子を被って殿を務め討死したと伝わる。",
                        ),
                    UnitState::new(3, 1, Job::Ashigaru, Team::Player, 3, 4, 115, 16, 4, 1)
                        .with_meta(
                            false,
                            "伊達成実",
                            "成実隊（退却援護）",
                            "shigezane",
                            "fact",
                            "数え18歳。大森城主。崩れる陣の中で踏みとどまり、政宗離脱の時を稼いだ。",
                        ),
                    UnitState::new(4, 1, Job::Yumi, Team::Player, 5, 3, 75, 13, 3, 3)
                        .with_meta(
                            false,
                            "伊達弓隊",
                            "北岸援護（模式配置）",
                            "date_yumi",
                            "fiction",
                            "北岸の段々畑から橋の攻防を援護する弓隊。部隊編成と配置はゲーム用の模式図。",
                        ),
                    UnitState::new(5, 2, Job::Strategist, Team::Enemy, 4, 9, 120, 16, 3, 1)
                        .with_meta(
                            true,
                            "佐竹義重",
                            "南奥州連合・総大将",
                            "satake",
                            "fact",
                            "常陸の大名。南奥州諸侯連合を率い、約3万（伝承値）の軍勢で伊達軍に迫る。",
                        ),
                    UnitState::new(6, 2, Job::Yari, Team::Enemy, 3, 7, 100, 15, 3, 1)
                        .with_meta(
                            false,
                            "蘆名隊",
                            "会津・蘆名勢",
                            "ashina",
                            "fact",
                            "会津の名族・蘆名氏の主力勢。南岸から人取橋の突破を狙う。",
                        ),
                    UnitState::new(7, 2, Job::Yumi, Team::Enemy, 6, 7, 80, 13, 3, 3)
                        .with_meta(
                            false,
                            "岩城隊",
                            "浜通り・岩城勢",
                            "iwaki",
                            "fact",
                            "岩城氏の弓隊。川越しに橋上の殿と伊達本隊へ矢を浴びせる。",
                        ),
                    UnitState::new(8, 2, Job::Yari, Team::Enemy, 4, 7, 90, 14, 3, 1)
                        .with_meta(
                            false,
                            "連合先鋒・槍組",
                            "連合先鋒（模式配置）",
                            "coalition_yari",
                            "fiction",
                            "人取橋の南詰めへ押し寄せる連合軍先鋒。部隊構成と配置はゲーム用の模式図。",
                        ),
                    UnitState::new(9, 2, Job::Teppo, Team::Enemy, 5, 7, 75, 15, 3, 2)
                        .with_meta(
                            false,
                            "連合先鋒・鉄砲組",
                            "連合鉄砲隊（模式配置）",
                            "coalition_teppo",
                            "fiction",
                            "橋上の殿へ銃撃を加える連合軍鉄砲組。部隊構成と配置はゲーム用の模式図。",
                        ),
                    UnitState::new(10, 2, Job::Ashigaru, Team::Enemy, 5, 8, 85, 13, 4, 1)
                        .with_meta(
                            false,
                            "連合第二陣",
                            "連合追撃勢（模式配置）",
                            "coalition_ashigaru",
                            "fiction",
                            "橋の突破後に政宗を追撃する第二陣。部隊構成と配置はゲーム用の模式図。",
                        ),
                ];
                (
                    map,
                    bridge_tiles,
                    escape_tiles,
                    units,
                    "天正13年・人取橋の合戦。政宗を北端の小浜方面へ逃がせ。".to_string(),
                    (4, 4),
                )
            }
            ScenarioKind::Custom => {
                return Self::new_for_scenario(ScenarioKind::Hitotoribashi);
            }
        };

        let (scenario_slug, bridge_label, escape_label) = match scenario {
            ScenarioKind::Hitotoribashi => (
                "hitotoribashi".to_string(),
                "人取橋".to_string(),
                "離脱マス（小浜方面）".to_string(),
            ),
            ScenarioKind::Demo | ScenarioKind::Custom => (
                "demo".to_string(),
                "橋".to_string(),
                "離脱マス".to_string(),
            ),
        };

        let mut game = Self {
            scenario,
            scenario_slug,
            custom_scenario_json: None,
            bridge_label,
            escape_label,
            view_mode: ViewMode::Isometric,
            turn_number: 1,
            phase: Phase::Player,
            selected_unit_id: Some(1),
            selected_tile: Some(initial_tile),
            interaction_mode: None,
            move_origin: None,
            message,
            map,
            bridge_tiles,
            escape_tiles,
            units,
            turn_events: Vec::new(),
            event_seq: 0,
            render_buffer: String::new(),
        };
        game.refresh_render();
        game
    }

    fn from_parsed_scenario(parsed: scenario_json::ParsedScenario, raw_json: String) -> Self {
        let units: Vec<UnitState> = parsed
            .units
            .into_iter()
            .map(|u| {
                let team = if u.is_enemy { Team::Enemy } else { Team::Player };
                UnitState::new(u.id, u.clan, u.job, team, u.x, u.y, u.hp, u.atk, u.mov, u.range)
                    .with_meta(u.leader, &u.name, &u.role, &u.tag, &u.basis, &u.note)
            })
            .collect();

        let initial_player = units
            .iter()
            .find(|u| u.team == Team::Player && u.leader && u.hp > 0)
            .or_else(|| units.iter().find(|u| u.team == Team::Player && u.hp > 0));
        let selected_unit_id = initial_player.map(|u| u.id);
        let selected_tile = initial_player.map(|u| (u.x, u.y));

        let mut game = Self {
            scenario: ScenarioKind::Custom,
            scenario_slug: parsed.slug,
            custom_scenario_json: Some(raw_json),
            bridge_label: parsed.bridge_label,
            escape_label: parsed.escape_label,
            view_mode: ViewMode::Isometric,
            turn_number: 1,
            phase: Phase::Player,
            selected_unit_id,
            selected_tile,
            interaction_mode: None,
            move_origin: None,
            message: parsed.start_message,
            map: parsed.map,
            bridge_tiles: parsed.bridge_tiles,
            escape_tiles: parsed.escape_tiles,
            units,
            turn_events: Vec::new(),
            event_seq: 0,
            render_buffer: String::new(),
        };
        game.refresh_render();
        game
    }

    fn refresh_render(&mut self) {
        let summary = self.summary();
        let move_tiles = self.reachable_tiles(self.selected_player_unit());
        let attack_tiles = self.attack_tiles(self.selected_player_unit());

        self.render_buffer.clear();
        let _ = write!(
            self.render_buffer,
            "{{\"scenario\":\"{}\",\"view_mode\":\"{}\",\"turn_number\":{},\"phase\":\"{}\",\"selected_unit_id\":{},\"interaction_mode\":{},\"message\":\"{}\",\"event_seq\":{},\"map\":{{\"width\":{},\"height\":{},\"tiles\":[",
            json_escape(&self.scenario_slug),
            view_mode_name(summary.view_mode),
            summary.turn_number,
            summary.phase,
            opt_u32(summary.selected_unit_id),
            opt_str(summary.interaction_mode),
            json_escape(&summary.message),
            self.event_seq,
            summary.map_width,
            summary.map_height
        );

        for (i, tile) in self.map.tiles.iter().enumerate() {
            if i > 0 {
                self.render_buffer.push(',');
            }
            let tx = tile_index_x(&self.map, i);
            let ty = tile_index_y(&self.map, i);
            let is_bridge = self.bridge_tiles.contains(&(tx, ty));
            let is_escape = self.escape_tiles.contains(&(tx, ty));
            let _ = write!(
                self.render_buffer,
                "{{\"x\":{},\"y\":{},\"terrain\":\"{}\",\"height\":{},\"cover\":{},\"water\":{},\"bridge\":{},\"escape\":{}}}",
                tx,
                ty,
                terrain_name(tile.terrain),
                tile.height,
                bool_json(tile.cover),
                bool_json(tile.water),
                bool_json(is_bridge),
                bool_json(is_escape)
            );
        }

        self.render_buffer.push_str("]},\"units\":[");
        for (i, unit) in self.units.iter().enumerate() {
            if i > 0 {
                self.render_buffer.push(',');
            }
            let _ = write!(
                self.render_buffer,
                "{{\"id\":{},\"clan\":{},\"job\":\"{:?}\",\"team\":\"{}\",\"x\":{},\"y\":{},\"hp\":{},\"max_hp\":{},\"atk\":{},\"mov\":{},\"range\":{},\"moved\":{},\"acted\":{},\"leader\":{},\"name\":\"{}\",\"role\":\"{}\",\"tag\":\"{}\",\"basis\":\"{}\",\"note\":\"{}\"}}",
                unit.id,
                unit.clan,
                unit.job,
                team_name(unit.team),
                unit.x,
                unit.y,
                unit.hp,
                unit.max_hp,
                unit.atk,
                unit.mov,
                unit.range,
                bool_json(unit.moved),
                bool_json(unit.acted),
                bool_json(unit.leader),
                json_escape(&unit.name),
                json_escape(&unit.role),
                json_escape(&unit.tag),
                json_escape(&unit.basis),
                json_escape(&unit.note)
            );
        }
        self.render_buffer.push_str("],\"move_tiles\":[");
        write_coord_list(&mut self.render_buffer, &move_tiles);
        self.render_buffer.push_str("],\"attack_tiles\":[");
        write_coord_list(&mut self.render_buffer, &attack_tiles);
        self.render_buffer.push_str("],\"selected_tile\":");
        self.render_buffer.push_str(&opt_tile(summary.selected_tile));
        self.render_buffer.push_str(",\"move_origin\":");
        self.render_buffer.push_str(&opt_move_origin(summary.move_origin));
        self.render_buffer.push_str(",\"is_player_turn\":");
        self.render_buffer.push_str(bool_json(summary.is_player_turn));
        self.render_buffer.push_str(",\"unit_count\":");
        let _ = write!(self.render_buffer, "{}", summary.unit_count);
        self.render_buffer.push_str(",\"turn_events\":[");
        for (i, ev) in self.turn_events.iter().enumerate() {
            if i > 0 {
                self.render_buffer.push(',');
            }
            match ev {
                TurnEvent::Move {
                    unit_id,
                    from_x,
                    from_y,
                    to_x,
                    to_y,
                } => {
                    let _ = write!(
                        self.render_buffer,
                        "{{\"type\":\"move\",\"unit_id\":{},\"from_x\":{},\"from_y\":{},\"to_x\":{},\"to_y\":{}}}",
                        unit_id, from_x, from_y, to_x, to_y
                    );
                }
                TurnEvent::Attack {
                    attacker_id,
                    target_id,
                    damage,
                    killed,
                    target_hp,
                } => {
                    let _ = write!(
                        self.render_buffer,
                        "{{\"type\":\"attack\",\"attacker_id\":{},\"target_id\":{},\"damage\":{},\"killed\":{},\"target_hp\":{}}}",
                        attacker_id,
                        target_id,
                        damage,
                        bool_json(*killed),
                        target_hp
                    );
                }
                TurnEvent::Ability {
                    unit_id,
                    name,
                    target_id,
                    damage,
                    healed,
                } => {
                    let _ = write!(
                        self.render_buffer,
                        "{{\"type\":\"ability\",\"unit_id\":{},\"name\":\"{}\",\"target_id\":{},\"damage\":{},\"healed\":{}}}",
                        unit_id,
                        json_escape(name),
                        opt_u32(*target_id),
                        damage,
                        healed
                    );
                }
            }
        }
        self.render_buffer.push_str("],\"abilities\":[");
        let abilities = self
            .selected_player_unit()
            .map(ability_views)
            .unwrap_or_default();
        for (i, ability) in abilities.iter().enumerate() {
            if i > 0 {
                self.render_buffer.push(',');
            }
            let _ = write!(
                self.render_buffer,
                "{{\"id\":{},\"name\":\"{}\",\"range\":{},\"cost\":{}}}",
                ability.id,
                ability.name,
                ability.range,
                ability.cost
            );
        }
        self.render_buffer.push_str("]}");
    }

    fn selected_player_unit(&self) -> Option<&UnitState> {
        self.selected_unit_id.and_then(|id| {
            self.units
                .iter()
                .find(|unit| unit.id == id && unit.team == Team::Player && unit.hp > 0)
        })
    }

    fn selected_player_unit_mut(&mut self) -> Option<&mut UnitState> {
        let id = self.selected_unit_id?;
        self.units
            .iter_mut()
            .find(|unit| unit.id == id && unit.team == Team::Player && unit.hp > 0)
    }

    fn selected_unit(&self) -> Option<(i32, i32)> {
        self.selected_tile.or_else(|| self.selected_player_unit().map(|unit| (unit.x, unit.y)))
    }

    fn begin_move_selection(&mut self) {
        let Some((unit_id, unit_job, unit_x, unit_y, moved)) = self
            .selected_player_unit()
            .map(|unit| (unit.id, unit.job, unit.x, unit.y, unit.moved))
        else {
            self.message = "移動できる自軍ユニットを選択してください".to_string();
            return;
        };
        if moved {
            self.message = "そのユニットは移動済みです".to_string();
            return;
        }
        self.interaction_mode = Some(InteractionMode::Move);
        self.move_origin = Some((unit_id, unit_x, unit_y, moved));
        self.selected_tile = Some((unit_x, unit_y));
        self.message = format!("{} の移動先を選択してください", job_label(unit_job));
    }

    fn cancel_move_selection(&mut self) {
        if let Some((unit_id, x, y, moved)) = self.move_origin.take() {
            if let Some(unit) = self.units.iter_mut().find(|unit| unit.id == unit_id) {
                unit.x = x;
                unit.y = y;
                unit.moved = moved;
                self.selected_unit_id = Some(unit_id);
                self.selected_tile = Some((x, y));
            }
        }
        self.interaction_mode = None;
        self.message = "移動をキャンセル".to_string();
    }

    fn unit_at(&self, x: i32, y: i32) -> Option<&UnitState> {
        self.units
            .iter()
            .find(|unit| unit.hp > 0 && unit.x == x && unit.y == y)
    }

    fn handle_click(&mut self, x: i32, y: i32) {
        if !matches!(self.phase, Phase::Player) {
            return;
        }
        self.turn_events.clear();

        if let Some(unit) = self.unit_at(x, y).cloned() {
            self.selected_tile = Some((x, y));
            self.interaction_mode = None;
            if unit.team == Team::Player {
                self.selected_unit_id = Some(unit.id);
                self.message = format!("{} を選択", unit.display_name());
            } else {
                self.message = if self.can_attack_selected_tile() {
                    format!("{} を確認 / 攻撃可能", unit.display_name())
                } else {
                    format!("{} を確認", unit.display_name())
                };
            }
            return;
        }

        self.selected_tile = Some((x, y));
        if !matches!(self.interaction_mode, Some(InteractionMode::Move)) {
            self.message = self.describe_tile(x, y);
            return;
        }

        let Some(selected_id) = self.selected_unit_id else {
            return;
        };
        let Some(selected) = self.selected_player_unit() else {
            self.message = "移動できる自軍ユニットを選択してください".to_string();
            return;
        };

        let move_tiles = self.reachable_tiles(Some(selected));
        if move_tiles.contains(&(x, y)) && self.unit_at(x, y).is_none() {
            if let Some(unit) = self.units.iter_mut().find(|unit| unit.id == selected_id) {
                let (from_x, from_y) = (unit.x, unit.y);
                let label = unit.display_name().to_string();
                unit.x = x;
                unit.y = y;
                unit.moved = true;
                self.interaction_mode = None;
                self.selected_tile = Some((x, y));
                self.message = format!("{} が {},{} へ移動", label, x, y);
                self.turn_events.push(TurnEvent::Move {
                    unit_id: selected_id,
                    from_x,
                    from_y,
                    to_x: x,
                    to_y: y,
                });
                self.event_seq = self.event_seq.wrapping_add(1);
                return;
            }
        }

        self.message = "移動先を選択してください".to_string();
    }

    fn attack_power(&self, unit_id: UnitId) -> i32 {
        self.units
            .iter()
            .find(|unit| unit.id == unit_id)
            .map(|unit| unit.atk)
            .unwrap_or(10)
    }

    fn can_attack_selected_tile(&self) -> bool {
        let Some((x, y)) = self.selected_tile else {
            return false;
        };
        let Some(attacker) = self.selected_player_unit() else {
            return false;
        };
        if attacker.acted || attacker.hp <= 0 || !matches!(self.phase, Phase::Player) {
            return false;
        }
        let Some(target) = self.unit_at(x, y) else {
            return false;
        };
        if target.team != Team::Enemy {
            return false;
        }
        let dist = (target.x - attacker.x).abs() + (target.y - attacker.y).abs();
        dist <= attacker.range
    }

    fn attack_selected_tile(&mut self) -> bool {
        self.turn_events.clear();
        let Some((x, y)) = self.selected_tile else {
            return false;
        };
        let Some(attacker_id) = self.selected_unit_id else {
            return false;
        };
        let Some(attacker_index) = self
            .units
            .iter()
            .position(|unit| unit.id == attacker_id && unit.team == Team::Player && unit.hp > 0)
        else {
            return false;
        };
        let Some(target_index) = self
            .units
            .iter()
            .position(|unit| unit.hp > 0 && unit.x == x && unit.y == y && unit.team == Team::Enemy)
        else {
            return false;
        };

        let dist = (self.units[target_index].x - self.units[attacker_index].x).abs()
            + (self.units[target_index].y - self.units[attacker_index].y).abs();
        if dist > self.units[attacker_index].range || self.units[attacker_index].acted {
            self.message = "射程外です".to_string();
            return false;
        }

        let attack = self.units[attacker_index].atk;
        self.units[target_index].hp = (self.units[target_index].hp - attack).max(0);
        self.units[attacker_index].acted = true;
        let killed = self.units[target_index].hp <= 0;
        let target_id = self.units[target_index].id;
        let target_hp = self.units[target_index].hp;
        self.message = format!(
            "{} が {} に {} ダメージ",
            self.units[attacker_index].display_name(),
            self.units[target_index].display_name(),
            attack
        );
        if killed {
            self.message.push_str(" / 撃破");
        }
        self.turn_events.push(TurnEvent::Attack {
            attacker_id,
            target_id,
            damage: attack,
            killed,
            target_hp,
        });
        self.event_seq = self.event_seq.wrapping_add(1);
        self.check_victory_or_defeat();
        self.move_origin = None;
        true
    }

    fn describe_tile(&self, x: i32, y: i32) -> String {
        let Some(tile) = self.map.get(x, y) else {
            return "マップ外".to_string();
        };
        if self.bridge_tiles.contains(&(x, y)) {
            return format!("{} / 移動コスト 1 / 渡河可能", self.bridge_label);
        }
        if tile.terrain == Terrain::Water {
            return "川 / 進入不可".to_string();
        }
        let mut traits: Vec<String> = Vec::new();
        if self.escape_tiles.contains(&(x, y)) {
            traits.push(self.escape_label.clone());
        }
        if tile.cover {
            traits.push("遮蔽あり".to_string());
        }
        if tile.water {
            traits.push("水地".to_string());
        }
        if tile.height > 0 {
            traits.push(format!("高さ +{}", tile.height));
        }
        let mut text = format!("{} / 移動コスト {}", terrain_label(tile.terrain), movement_cost(tile));
        if !traits.is_empty() {
            text.push_str(" / ");
            text.push_str(&traits.join(" / "));
        }
        text
    }

    fn enemy_units_alive(&self) -> usize {
        self.units
            .iter()
            .filter(|unit| unit.team == Team::Enemy && unit.hp > 0)
            .count()
    }

    fn player_units_alive(&self) -> usize {
        self.units
            .iter()
            .filter(|unit| unit.team == Team::Player && unit.hp > 0)
            .count()
    }

    fn end_player_turn(&mut self) {
        if !matches!(self.phase, Phase::Player) {
            return;
        }
        self.turn_events.clear();
        self.phase = Phase::Enemy;
        self.selected_unit_id = None;
        self.selected_tile = None;
        self.interaction_mode = None;
        self.move_origin = None;
        self.message = "敵の行動中".to_string();
        self.run_enemy_turn();
        self.event_seq = self.event_seq.wrapping_add(1);
    }

    fn run_enemy_turn(&mut self) {
        for idx in 0..self.units.len() {
            if self.units[idx].team != Team::Enemy || self.units[idx].hp <= 0 {
                continue;
            }
            let player_positions: Vec<(i32, i32)> = self
                .units
                .iter()
                .filter(|unit| unit.team == Team::Player && unit.hp > 0)
                .map(|unit| (unit.x, unit.y))
                .collect();
            if player_positions.is_empty() {
                break;
            }

            let enemy_snapshot = self.units[idx].clone();
            let nearest = player_positions
                .iter()
                .copied()
                .min_by_key(|(px, py)| (px - enemy_snapshot.x).abs() + (py - enemy_snapshot.y).abs())
                .unwrap();

            let mut steps = enemy_snapshot.mov;
            while steps > 0 {
                let cur = (self.units[idx].x, self.units[idx].y);
                let next = self.shortest_step(cur, nearest, self.units[idx].id);
                let Some(next) = next else { break };
                if next == cur {
                    break;
                }
                if self.unit_at(next.0, next.1).is_some() {
                    break;
                }
                if next == nearest {
                    break;
                }
                self.units[idx].x = next.0;
                self.units[idx].y = next.1;
                self.turn_events.push(TurnEvent::Move {
                    unit_id: self.units[idx].id,
                    from_x: cur.0,
                    from_y: cur.1,
                    to_x: next.0,
                    to_y: next.1,
                });
                steps -= 1;
            }

            let dist = (self.units[idx].x - nearest.0).abs() + (self.units[idx].y - nearest.1).abs();
            if dist <= self.units[idx].range {
                if let Some(target_idx) = self
                    .units
                    .iter()
                    .position(|unit| unit.team == Team::Player && unit.hp > 0 && unit.x == nearest.0 && unit.y == nearest.1)
                {
                    let damage = self.units[idx].atk;
                    self.units[target_idx].hp = (self.units[target_idx].hp - damage).max(0);
                    let killed = self.units[target_idx].hp <= 0;
                    self.turn_events.push(TurnEvent::Attack {
                        attacker_id: self.units[idx].id,
                        target_id: self.units[target_idx].id,
                        damage,
                        killed,
                        target_hp: self.units[target_idx].hp,
                    });
                    self.message = format!(
                        "{} が {} に {} ダメージ",
                        self.units[idx].display_name(),
                        self.units[target_idx].display_name(),
                        damage
                    );
                    if killed {
                        self.message.push_str(" / 撃破");
                    }
                    if self.player_units_alive() == 0 {
                        self.phase = Phase::Defeat;
                        self.message = "敗北".to_string();
                        self.selected_unit_id = None;
                        return;
                    }
                }
            }
        }

        if self.player_units_alive() == 0 {
            self.phase = Phase::Defeat;
            self.message = "敗北".to_string();
            self.selected_unit_id = None;
            return;
        }

        for unit in self.units.iter_mut() {
            if unit.team == Team::Player {
                unit.moved = false;
                unit.acted = false;
            }
        }
        self.phase = Phase::Player;
        self.turn_number = self.turn_number.saturating_add(1);
        self.selected_unit_id = self
            .units
            .iter()
            .find(|unit| unit.team == Team::Player && unit.hp > 0)
            .map(|unit| unit.id);
        self.selected_tile = self
            .selected_player_unit()
            .map(|unit| (unit.x, unit.y));
        self.interaction_mode = None;
        self.move_origin = None;
        self.message = "自軍の行動です".to_string();
    }

    fn shortest_step(&self, start: (i32, i32), goal: (i32, i32), mover_id: UnitId) -> Option<(i32, i32)> {
        let mut open = vec![(start.0, start.1, 0i32)];
        let mut best = std::collections::BTreeMap::<(i32, i32), i32>::new();
        let mut prev = std::collections::BTreeMap::<(i32, i32), (i32, i32)>::new();
        best.insert(start, 0);

        while let Some((x, y, cost)) = pop_lowest(&mut open) {
            if (x, y) == goal {
                break;
            }
            for (dx, dy) in [(0, -1), (1, 0), (0, 1), (-1, 0)] {
                let nx = x + dx;
                let ny = y + dy;
                let Some(tile) = self.map.get(nx, ny) else { continue };
                if tile.terrain == Terrain::Water {
                    continue;
                }
                let occupied = self.unit_at(nx, ny);
                if let Some(unit) = occupied {
                    if unit.id != mover_id && (nx, ny) != goal {
                        continue;
                    }
                }
                let next_cost = cost + movement_cost(tile);
                let key = (nx, ny);
                if best.get(&key).map(|existing| next_cost < *existing).unwrap_or(true) {
                    best.insert(key, next_cost);
                    prev.insert(key, (x, y));
                    open.push((nx, ny, next_cost));
                }
            }
        }

        let mut cursor = goal;
        while let Some(parent) = prev.get(&cursor).copied() {
            if parent == start {
                return Some(cursor);
            }
            cursor = parent;
        }
        None
    }

    fn reachable_tiles(&self, unit: Option<&UnitState>) -> HashSet<(i32, i32)> {
        let Some(unit) = unit else {
            return HashSet::new();
        };
        if unit.hp <= 0 || unit.moved {
            return HashSet::new();
        }

        let mut open = vec![(unit.x, unit.y, 0i32)];
        let mut best = std::collections::BTreeMap::<(i32, i32), i32>::new();
        best.insert((unit.x, unit.y), 0);
        let mut reachable = HashSet::new();

        while let Some((x, y, cost)) = pop_lowest(&mut open) {
            for (dx, dy) in [(0, -1), (1, 0), (0, 1), (-1, 0)] {
                let nx = x + dx;
                let ny = y + dy;
                let Some(tile) = self.map.get(nx, ny) else { continue };
                let occupied = self.unit_at(nx, ny);
                if occupied.is_some() && occupied.map(|u| u.id) != Some(unit.id) {
                    continue;
                }
                let next_cost = cost + movement_cost(tile);
                if next_cost > unit.mov {
                    continue;
                }
                let key = (nx, ny);
                if best.get(&key).map(|existing| next_cost < *existing).unwrap_or(true) {
                    best.insert(key, next_cost);
                    open.push((nx, ny, next_cost));
                    if key != (unit.x, unit.y) {
                        reachable.insert(key);
                    }
                }
            }
        }

        reachable
    }

    fn attack_tiles(&self, unit: Option<&UnitState>) -> HashSet<(i32, i32)> {
        let Some(unit) = unit else {
            return HashSet::new();
        };
        if unit.hp <= 0 || unit.acted {
            return HashSet::new();
        }

        self.units
            .iter()
            .filter(|target| target.team != unit.team && target.hp > 0)
            .filter(|target| (target.x - unit.x).abs() + (target.y - unit.y).abs() <= unit.range)
            .map(|target| (target.x, target.y))
            .collect()
    }

    fn use_ability(&mut self, ability_id: u32) {
        if !matches!(self.phase, Phase::Player) {
            return;
        }
        self.turn_events.clear();

        let Some(selected_id) = self.selected_unit_id else {
            return;
        };
        let Some(unit_index) = self
            .units
            .iter()
            .position(|unit| unit.id == selected_id && unit.team == Team::Player && unit.hp > 0)
        else {
            return;
        };

        let job = self.units[unit_index].job;
        match (job, ability_id) {
            (Job::Ashigaru, 0) => {
                self.use_push(unit_index);
            }
            (Job::Yumi, 0) => {
                self.use_curved_shot(unit_index);
            }
            (Job::Teppo, 0) => {
                self.use_matchlock_shot(unit_index);
            }
            (Job::Ninja, 0) => {
                self.use_smoke_bomb(unit_index);
            }
            (Job::Strategist, 0) => {
                self.use_formation_change(unit_index);
            }
            _ => {
                self.message = "使用できないアビリティです".to_string();
            }
        }
        if !self.turn_events.is_empty() {
            self.event_seq = self.event_seq.wrapping_add(1);
        }
    }

    fn use_push(&mut self, unit_index: usize) {
        let (uid, ux, uy, unit_name) = {
            let unit = &self.units[unit_index];
            (unit.id, unit.x, unit.y, unit.display_name().to_string())
        };
        let target_index = self
            .units
            .iter()
            .enumerate()
            .filter(|(_, unit)| unit.team == Team::Enemy && unit.hp > 0)
            .filter(|(_, unit)| (unit.x - ux).abs() + (unit.y - uy).abs() == 1)
            .min_by_key(|(_, unit)| (unit.x - ux).abs() + (unit.y - uy).abs())
            .map(|(idx, _)| idx);

        let Some(target_index) = target_index else {
            self.message = "押し込みの対象がいません".to_string();
            return;
        };

        let target_id = self.units[target_index].id;
        let from_x = self.units[target_index].x;
        let from_y = self.units[target_index].y;
        let dx = (from_x - ux).signum();
        let dy = (from_y - uy).signum();
        let next = (from_x + dx, from_y + dy);
        if self
            .map
            .get(next.0, next.1)
            .is_some_and(|tile| tile.terrain != Terrain::Water && self.unit_at(next.0, next.1).is_none())
        {
            self.units[target_index].x = next.0;
            self.units[target_index].y = next.1;
            self.units[unit_index].acted = true;
            self.message = format!("{} の押し込み", unit_name);
            self.turn_events.push(TurnEvent::Move {
                unit_id: target_id,
                from_x,
                from_y,
                to_x: next.0,
                to_y: next.1,
            });
            self.turn_events.push(TurnEvent::Ability {
                unit_id: uid,
                name: "押し込み",
                target_id: Some(target_id),
                damage: 0,
                healed: 0,
            });
        } else {
            self.units[target_index].hp = (self.units[target_index].hp - 8).max(0);
            self.units[unit_index].acted = true;
            self.message = format!("{} の押し込み失敗、代わりに8ダメージ", unit_name);
            self.turn_events.push(TurnEvent::Attack {
                attacker_id: uid,
                target_id,
                damage: 8,
                killed: self.units[target_index].hp <= 0,
                target_hp: self.units[target_index].hp,
            });
            self.check_victory_or_defeat();
        }
    }

    fn use_curved_shot(&mut self, unit_index: usize) {
        let (uid, ux, uy, atk, unit_name) = {
            let unit = &self.units[unit_index];
            (unit.id, unit.x, unit.y, unit.atk + 4, unit.display_name().to_string())
        };
        let target_index = self
            .units
            .iter()
            .enumerate()
            .filter(|(_, unit)| unit.team == Team::Enemy && unit.hp > 0)
            .filter(|(_, unit)| (unit.x - ux).abs() + (unit.y - uy).abs() <= 4)
            .max_by_key(|(_, unit)| unit.hp)
            .map(|(idx, _)| idx);

        let Some(target_index) = target_index else {
            self.message = "曲射の対象がいません".to_string();
            return;
        };

        let target_id = self.units[target_index].id;
        self.units[target_index].hp = (self.units[target_index].hp - atk).max(0);
        self.units[unit_index].acted = true;
        self.message = format!("{} の曲射で {} ダメージ", unit_name, atk);
        self.turn_events.push(TurnEvent::Attack {
            attacker_id: uid,
            target_id,
            damage: atk,
            killed: self.units[target_index].hp <= 0,
            target_hp: self.units[target_index].hp,
        });
        self.check_victory_or_defeat();
    }

    fn use_matchlock_shot(&mut self, unit_index: usize) {
        let (uid, ux, uy, atk, unit_name) = {
            let unit = &self.units[unit_index];
            (unit.id, unit.x, unit.y, unit.atk + 8, unit.display_name().to_string())
        };
        let target_index = self
            .units
            .iter()
            .enumerate()
            .filter(|(_, unit)| unit.team == Team::Enemy && unit.hp > 0)
            .filter(|(_, unit)| (unit.x - ux).abs() + (unit.y - uy).abs() <= 5)
            .min_by_key(|(_, unit)| (unit.x - ux).abs() + (unit.y - uy).abs())
            .map(|(idx, _)| idx);

        let Some(target_index) = target_index else {
            self.message = "火縄チャージの対象がいません".to_string();
            return;
        };

        let target_id = self.units[target_index].id;
        self.units[target_index].hp = (self.units[target_index].hp - atk).max(0);
        self.units[unit_index].acted = true;
        self.message = format!("{} の火縄射撃で {} ダメージ", unit_name, atk);
        self.turn_events.push(TurnEvent::Attack {
            attacker_id: uid,
            target_id,
            damage: atk,
            killed: self.units[target_index].hp <= 0,
            target_hp: self.units[target_index].hp,
        });
        self.check_victory_or_defeat();
    }

    fn use_smoke_bomb(&mut self, unit_index: usize) {
        let (uid, ux, uy, unit_name) = {
            let unit = &self.units[unit_index];
            (unit.id, unit.x, unit.y, unit.display_name().to_string())
        };
        let tile_index = self.map.idx(ux, uy);
        if let Some(tile_index) = tile_index {
            if let Some(tile) = self.map.tiles.get_mut(tile_index) {
                tile.cover = true;
                self.units[unit_index].moved = true;
                self.units[unit_index].acted = true;
                self.message = format!("{} が煙玉を使用", unit_name);
                self.turn_events.push(TurnEvent::Ability {
                    unit_id: uid,
                    name: "煙玉",
                    target_id: None,
                    damage: 0,
                    healed: 0,
                });
            }
        }
    }

    fn use_formation_change(&mut self, unit_index: usize) {
        let (uid, ux, uy, unit_name) = {
            let unit = &self.units[unit_index];
            (unit.id, unit.x, unit.y, unit.display_name().to_string())
        };
        let mut healed_total = 0;
        for unit in self.units.iter_mut() {
            if unit.team == Team::Player && unit.hp > 0 {
                let dist = (unit.x - ux).abs() + (unit.y - uy).abs();
                if dist <= 2 {
                    let before = unit.hp;
                    unit.hp = (unit.hp + 6).min(unit.max_hp);
                    healed_total += unit.hp - before;
                }
            }
        }
        self.units[unit_index].acted = true;
        self.message = format!("{} が陣形を整えた", unit_name);
        self.turn_events.push(TurnEvent::Ability {
            unit_id: uid,
            name: "陣形変更",
            target_id: None,
            damage: 0,
            healed: healed_total,
        });
    }

    fn check_victory_or_defeat(&mut self) {
        if self.enemy_units_alive() == 0 {
            self.phase = Phase::Victory;
            self.selected_unit_id = None;
            self.message = "勝利".to_string();
            return;
        }
        if self.player_units_alive() == 0 {
            self.phase = Phase::Defeat;
            self.selected_unit_id = None;
            self.message = "敗北".to_string();
        }
    }

    fn summary(&self) -> BattleSummary {
        BattleSummary {
            view_mode: self.view_mode,
            turn_number: self.turn_number,
            phase: phase_name(self.phase),
            selected_unit_id: self.selected_unit_id,
            interaction_mode: self.interaction_mode,
            message: self.message.clone(),
            map_width: self.map.width,
            map_height: self.map.height,
            unit_count: self.units.iter().filter(|unit| unit.hp > 0).count() as u32,
            is_player_turn: matches!(self.phase, Phase::Player),
            selected_tile: self.selected_tile.or_else(|| self.selected_unit()),
            move_origin: self.move_origin,
        }
    }
}

impl UnitState {
    fn new(
        id: UnitId,
        clan: u32,
        job: Job,
        team: Team,
        x: i32,
        y: i32,
        hp: i32,
        atk: i32,
        mov: i32,
        range: i32,
    ) -> Self {
        Self {
            id,
            clan,
            job,
            team,
            x,
            y,
            hp,
            max_hp: hp,
            atk,
            mov,
            range,
            moved: false,
            acted: false,
            leader: false,
            name: String::new(),
            role: String::new(),
            tag: String::new(),
            basis: String::new(),
            note: String::new(),
        }
    }

    fn with_meta(
        mut self,
        leader: bool,
        name: &str,
        role: &str,
        tag: &str,
        basis: &str,
        note: &str,
    ) -> Self {
        self.leader = leader;
        self.name = name.to_string();
        self.role = role.to_string();
        self.tag = tag.to_string();
        self.basis = basis.to_string();
        self.note = note.to_string();
        self
    }

    fn display_name(&self) -> &str {
        if !self.name.is_empty() {
            &self.name
        } else {
            job_label(self.job)
        }
    }
}

struct BattleSummary {
    view_mode: ViewMode,
    turn_number: u32,
    phase: &'static str,
    selected_unit_id: Option<UnitId>,
    interaction_mode: Option<InteractionMode>,
    message: String,
    map_width: usize,
    map_height: usize,
    unit_count: u32,
    is_player_turn: bool,
    selected_tile: Option<(i32, i32)>,
    move_origin: Option<(UnitId, i32, i32, bool)>,
}

fn build_hitotoribashi_map() -> (Map, HashSet<(i32, i32)>, HashSet<(i32, i32)>) {
    let fill = Tile {
        terrain: Terrain::Plain,
        height: 1,
        cover: false,
        water: false,
    };
    let mut map = Map::new(10, 10, fill);
    let mut bridge_tiles = HashSet::new();
    let mut escape_tiles = HashSet::new();

    for y in 0..10i32 {
        for x in 0..10i32 {
            let idx = (y as usize) * 10 + (x as usize);
            let tile = match (x, y) {
                // River (阿武隈川 / 瀬戸川): impassable water curving NE -> SW
                (8, 4) | (9, 4)
                | (0, 5) | (1, 5) | (2, 5) | (3, 5)
                | (5, 5) | (6, 5) | (7, 5) | (8, 5)
                | (0, 6) => Tile {
                    terrain: Terrain::Water,
                    height: 0,
                    cover: false,
                    water: true,
                },

                // Hitotoribashi wooden bridge (人取橋)
                (4, 5) | (4, 6) => {
                    bridge_tiles.insert((x, y));
                    Tile {
                        terrain: Terrain::Road,
                        height: 1,
                        cover: false,
                        water: false,
                    }
                }

                // North hilltop castle (小浜城 / 退路方面の砦)
                (5, 0) => {
                    escape_tiles.insert((x, y));
                    Tile {
                        terrain: Terrain::Castle,
                        height: 3,
                        cover: true,
                        water: false,
                    }
                }
                (6, 0) => Tile {
                    terrain: Terrain::Castle,
                    height: 3,
                    cover: true,
                    water: false,
                },
                (9, 0) => Tile {
                    terrain: Terrain::Mountain,
                    height: 3,
                    cover: true,
                    water: false,
                },

                // North escape highway (小浜方面・離脱マス)
                (3, 0) | (4, 0) => {
                    escape_tiles.insert((x, y));
                    Tile {
                        terrain: Terrain::Road,
                        height: 2,
                        cover: false,
                        water: false,
                    }
                }

                // Winding north road & south highway
                (2, 1) | (3, 1) => Tile {
                    terrain: Terrain::Road,
                    height: 2,
                    cover: false,
                    water: false,
                },
                (2, 2) | (2, 3) | (3, 3) | (3, 4) | (4, 4) | (4, 7) | (4, 8) | (4, 9) => Tile {
                    terrain: Terrain::Road,
                    height: 1,
                    cover: false,
                    water: false,
                },

                // Castle town below hilltop fort
                (5, 1) | (6, 1) => Tile {
                    terrain: Terrain::Town,
                    height: 2,
                    cover: true,
                    water: false,
                },

                // Terraced hills (段々畑) on northern slopes & eastern flank
                (0, 0) | (1, 0) | (2, 0) | (7, 0) | (8, 0)
                | (0, 1) | (1, 1) | (4, 1) | (7, 1) | (8, 1) | (9, 1)
                | (3, 2) | (4, 2) | (9, 2)
                | (8, 7) | (9, 7) | (8, 8) | (9, 8) | (7, 9) | (8, 9) | (9, 9) => Tile {
                    terrain: Terrain::Terrace,
                    height: 2,
                    cover: (x == 7 && y == 0) || (x == 9 && y == 1),
                    water: false,
                },
                (0, 2) | (1, 2) | (5, 2) | (8, 2) | (5, 3) => Tile {
                    terrain: Terrain::Terrace,
                    height: 1,
                    cover: x == 5,
                    water: false,
                },

                // Flooded rice fields (田んぼ) bordering the riverbanks
                (6, 2) | (7, 2)
                | (0, 3) | (1, 3) | (6, 3) | (7, 3) | (8, 3)
                | (0, 4) | (1, 4) | (6, 4) | (7, 4)
                | (1, 6) | (2, 6) | (8, 6) | (9, 6)
                | (0, 7) | (1, 7)
                | (0, 8) | (1, 8) | (2, 8) => Tile {
                    terrain: Terrain::RiceField,
                    height: 1,
                    cover: false,
                    water: true,
                },

                // Riverbank plains & staging fields
                (6, 7) => Tile {
                    terrain: Terrain::Plain,
                    height: 1,
                    cover: true,
                    water: false,
                },
                _ => Tile {
                    terrain: Terrain::Plain,
                    height: 1,
                    cover: false,
                    water: false,
                },
            };
            map.tiles[idx] = tile;
        }
    }

    (map, bridge_tiles, escape_tiles)
}

fn build_demo_map() -> Map {
    let fill = Tile {
        terrain: Terrain::Plain,
        height: 0,
        cover: false,
        water: false,
    };
    let mut map = Map::new(8, 8, fill);

    for y in 0..8 {
        for x in 0..8 {
            let idx = y * 8 + x;
            let tile = if x == 3 && y <= 5 {
                Tile {
                    terrain: Terrain::Road,
                    height: 0,
                    cover: false,
                    water: false,
                }
            } else if y >= 5 {
                Tile {
                    terrain: Terrain::RiceField,
                    height: 0,
                    cover: false,
                    water: true,
                }
            } else if x >= 5 {
                Tile {
                    terrain: Terrain::Terrace,
                    height: (x as i32 - 4) + y as i32 / 2,
                    cover: x == 6,
                    water: false,
                }
            } else if x == 1 && y == 1 {
                Tile {
                    terrain: Terrain::Castle,
                    height: 3,
                    cover: true,
                    water: false,
                }
            } else if x <= 2 && y <= 2 {
                Tile {
                    terrain: Terrain::Town,
                    height: if y == 2 { 1 } else { 0 },
                    cover: x % 2 == 0 && y % 2 == 0,
                    water: false,
                }
            } else {
                Tile {
                    terrain: Terrain::Plain,
                    height: 0,
                    cover: (x + y) % 3 == 0,
                    water: false,
                }
            };
            map.tiles[idx] = tile;
        }
    }

    map
}

fn movement_cost(tile: &Tile) -> i32 {
    tile.movement_cost()
}

fn terrain_label(terrain: Terrain) -> &'static str {
    match terrain {
        Terrain::Plain => "平地",
        Terrain::Mountain => "山",
        Terrain::Castle => "城",
        Terrain::Town => "城下町",
        Terrain::RiceField => "田んぼ",
        Terrain::Terrace => "段々畑",
        Terrain::Road => "道",
        Terrain::Water => "水",
    }
}

fn view_mode_name(view_mode: ViewMode) -> &'static str {
    match view_mode {
        ViewMode::Isometric => "isometric",
        ViewMode::TopDown => "topdown",
    }
}

fn phase_name(phase: Phase) -> &'static str {
    match phase {
        Phase::Player => "player",
        Phase::Enemy => "enemy",
        Phase::Victory => "victory",
        Phase::Defeat => "defeat",
    }
}

fn team_name(team: Team) -> &'static str {
    match team {
        Team::Player => "player",
        Team::Enemy => "enemy",
    }
}

fn job_label(job: Job) -> &'static str {
    match job {
        Job::Ashigaru => "足軽",
        Job::Yari => "槍",
        Job::Yumi => "弓",
        Job::Teppo => "鉄砲",
        Job::Ninja => "忍者",
        Job::Strategist => "軍師",
    }
}

fn terrain_name(terrain: Terrain) -> &'static str {
    match terrain {
        Terrain::Plain => "Plain",
        Terrain::Mountain => "Mountain",
        Terrain::Castle => "Castle",
        Terrain::Town => "Town",
        Terrain::RiceField => "RiceField",
        Terrain::Terrace => "Terrace",
        Terrain::Water => "Water",
        Terrain::Road => "Road",
    }
}

fn opt_u32(value: Option<u32>) -> String {
    value
        .map(|value| value.to_string())
        .unwrap_or_else(|| "null".to_string())
}

fn opt_str(value: Option<InteractionMode>) -> &'static str {
    match value {
        Some(InteractionMode::Move) => "\"move\"",
        None => "null",
    }
}

fn opt_tile(value: Option<(i32, i32)>) -> String {
    match value {
        Some((x, y)) => format!("{{\"x\":{},\"y\":{}}}", x, y),
        None => "null".to_string(),
    }
}

fn opt_move_origin(value: Option<(UnitId, i32, i32, bool)>) -> String {
    match value {
        Some((unit_id, x, y, moved)) => format!(
            "{{\"unitId\":{},\"x\":{},\"y\":{},\"moved\":{}}}",
            unit_id,
            x,
            y,
            bool_json(moved)
        ),
        None => "null".to_string(),
    }
}

fn bool_json(value: bool) -> &'static str {
    if value { "true" } else { "false" }
}

fn json_escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 8);
    for ch in value.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            _ => out.push(ch),
        }
    }
    out
}

fn write_coord_list(out: &mut String, coords: &HashSet<(i32, i32)>) {
    let mut first = true;
    for (x, y) in coords.iter().copied() {
        if !first {
            out.push(',');
        }
        first = false;
        let _ = write!(out, "{{\"x\":{},\"y\":{}}}", x, y);
    }
}

fn ability_views(unit: &UnitState) -> Vec<AbilityView> {
    match unit.job {
        Job::Ashigaru => vec![AbilityView {
            id: 0,
            name: "押し込み",
            range: 1,
            cost: 2,
        }],
        Job::Yumi => vec![AbilityView {
            id: 0,
            name: "曲射",
            range: 4,
            cost: 3,
        }],
        Job::Teppo => vec![AbilityView {
            id: 0,
            name: "火縄チャージ",
            range: 5,
            cost: 4,
        }],
        Job::Ninja => vec![AbilityView {
            id: 0,
            name: "煙玉",
            range: 0,
            cost: 2,
        }],
        Job::Strategist => vec![AbilityView {
            id: 0,
            name: "陣形変更",
            range: 2,
            cost: 3,
        }],
        Job::Yari => Vec::new(),
    }
}

fn tile_index_x(map: &Map, idx: usize) -> i32 {
    (idx % map.width) as i32
}

fn tile_index_y(map: &Map, idx: usize) -> i32 {
    (idx / map.width) as i32
}

fn pop_lowest(open: &mut Vec<(i32, i32, i32)>) -> Option<(i32, i32, i32)> {
    if open.is_empty() {
        return None;
    }
    let mut best_index = 0usize;
    for i in 1..open.len() {
        if open[i].2 < open[best_index].2 {
            best_index = i;
        }
    }
    Some(open.swap_remove(best_index))
}

#[cfg(feature = "jindori")]
mod jindori;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_custom_scenario_json_and_resets() {
        let json = r#"{
            "slug": "test_battle",
            "start_message": "テスト開戦",
            "bridge_label": "テスト橋",
            "escape_label": "離脱マス（北）",
            "map": {
                "width": 4,
                "height": 4,
                "tiles": [
                    {"x":0,"y":0,"terrain":"Road","height":2,"cover":false,"water":false,"bridge":false,"escape":true},
                    {"x":1,"y":1,"terrain":"Water","height":0,"cover":false,"water":true,"bridge":false,"escape":false},
                    {"x":2,"y":1,"terrain":"Road","height":1,"cover":false,"water":false,"bridge":true,"escape":false}
                ]
            },
            "units": [
                {"id":1,"clan":1,"job":"Strategist","team":"player","x":2,"y":2,"hp":90,"atk":15,"mov":3,"range":1,"leader":true,"name":"伊達政宗","role":"大将","tag":"masamune","basis":"fact","note":"注記"},
                {"id":2,"clan":2,"job":"Yari","team":"enemy","x":2,"y":0,"hp":80,"atk":12,"mov":3,"range":1,"leader":true,"name":"敵大将","role":"敵","tag":"enemy_boss","basis":"fiction","note":"模式"}
            ]
        }"#;
        let parsed = scenario_json::parse_scenario_json(json).expect("should parse JSON");
        assert_eq!(parsed.slug, "test_battle");
        assert_eq!(parsed.map.width, 4);
        assert_eq!(parsed.map.height, 4);
        assert!(parsed.bridge_tiles.contains(&(2, 1)));
        assert!(parsed.escape_tiles.contains(&(0, 0)));
        assert_eq!(parsed.units.len(), 2);

        let mut game = GameState::from_parsed_scenario(parsed, json.to_string());
        assert_eq!(game.scenario_slug, "test_battle");
        assert_eq!(game.selected_unit_id, Some(1));
        assert!(game.render_buffer.contains("\"scenario\":\"test_battle\""));
        assert!(game.render_buffer.contains("伊達政宗"));
        game.end_player_turn();
        assert_eq!(game.turn_number, 2);
    }

    #[test]
    fn rejects_invalid_json() {
        assert!(scenario_json::parse_scenario_json("{bad").is_err());
        assert!(scenario_json::parse_scenario_json("{}").is_err());
    }
}
