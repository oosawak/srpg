use core::fmt::Write;
use srpg_core::{Job, Map, Terrain, Tile, ViewMode};
use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};

type UnitId = u32;

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
}

#[derive(Clone)]
struct AbilityView {
    id: u32,
    name: &'static str,
    range: i32,
    cost: i32,
}

struct GameState {
    view_mode: ViewMode,
    turn_number: u32,
    phase: Phase,
    selected_unit_id: Option<UnitId>,
    selected_tile: Option<(i32, i32)>,
    interaction_mode: Option<InteractionMode>,
    move_origin: Option<(UnitId, i32, i32, bool)>,
    message: String,
    map: Map,
    units: Vec<UnitState>,
    render_buffer: String,
}

static GAME: OnceLock<Mutex<GameState>> = OnceLock::new();

#[no_mangle]
pub extern "C" fn srpg_init() {
    let _ = game_cell();
}

#[no_mangle]
pub extern "C" fn srpg_reset() {
    with_game_mut(|game| *game = GameState::new());
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
        let map = build_demo_map();
        let units = vec![
            UnitState::new(1, 1, Job::Ashigaru, Team::Player, 2, 2, 100, 14, 4, 1),
            UnitState::new(2, 1, Job::Yumi, Team::Player, 1, 5, 80, 12, 4, 3),
            UnitState::new(3, 2, Job::Teppo, Team::Enemy, 6, 2, 90, 13, 3, 2),
            UnitState::new(4, 2, Job::Ninja, Team::Enemy, 6, 5, 70, 11, 4, 1),
        ];

        let mut game = Self {
            view_mode: ViewMode::Isometric,
            turn_number: 1,
            phase: Phase::Player,
            selected_unit_id: Some(1),
            selected_tile: Some((2, 2)),
            interaction_mode: None,
            move_origin: None,
            message: "自軍の行動です".to_string(),
            map,
            units,
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
            "{{\"view_mode\":\"{}\",\"turn_number\":{},\"phase\":\"{}\",\"selected_unit_id\":{},\"interaction_mode\":{},\"message\":\"{}\",\"map\":{{\"width\":{},\"height\":{},\"tiles\":[",
            view_mode_name(summary.view_mode),
            summary.turn_number,
            summary.phase,
            opt_u32(summary.selected_unit_id),
            opt_str(summary.interaction_mode),
            json_escape(&summary.message),
            summary.map_width,
            summary.map_height
        );

        for (i, tile) in self.map.tiles.iter().enumerate() {
            if i > 0 {
                self.render_buffer.push(',');
            }
            let _ = write!(
                self.render_buffer,
                "{{\"x\":{},\"y\":{},\"terrain\":\"{}\",\"height\":{},\"cover\":{},\"water\":{}}}",
                tile_index_x(&self.map, i),
                tile_index_y(&self.map, i),
                terrain_name(tile.terrain),
                tile.height,
                bool_json(tile.cover),
                bool_json(tile.water)
            );
        }

        self.render_buffer.push_str("]},\"units\":[");
        for (i, unit) in self.units.iter().enumerate() {
            if i > 0 {
                self.render_buffer.push(',');
            }
            let _ = write!(
                self.render_buffer,
                "{{\"id\":{},\"clan\":{},\"job\":\"{:?}\",\"team\":\"{}\",\"x\":{},\"y\":{},\"hp\":{},\"max_hp\":{},\"atk\":{},\"mov\":{},\"range\":{},\"moved\":{},\"acted\":{}}}",
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
                bool_json(unit.acted)
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
        self.render_buffer.push_str(",\"abilities\":[");
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

        if let Some(unit) = self.unit_at(x, y).cloned() {
            self.selected_tile = Some((x, y));
            self.interaction_mode = None;
            if unit.team == Team::Player {
                self.selected_unit_id = Some(unit.id);
                self.message = format!("{} を選択", job_label(unit.job));
            } else {
                self.message = if self.can_attack_selected_tile() {
                    format!("{} を確認 / 攻撃可能", job_label(unit.job))
                } else {
                    format!("{} を確認", job_label(unit.job))
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
                unit.x = x;
                unit.y = y;
                unit.moved = true;
                self.interaction_mode = None;
                self.selected_tile = Some((x, y));
                self.message = format!("{} が {},{} へ移動", job_label(unit.job), x, y);
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
        self.message = format!(
            "{} が {} に {} ダメージ",
            job_label(self.units[attacker_index].job),
            job_label(self.units[target_index].job),
            attack
        );
        if self.units[target_index].hp <= 0 {
            self.message.push_str(" / 撃破");
        }
        self.check_victory_or_defeat();
        self.move_origin = None;
        true
    }

    fn describe_tile(&self, x: i32, y: i32) -> String {
        let Some(tile) = self.map.get(x, y) else {
            return "マップ外".to_string();
        };
        let mut traits: Vec<String> = Vec::new();
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
        self.phase = Phase::Enemy;
        self.selected_unit_id = None;
        self.selected_tile = None;
        self.interaction_mode = None;
        self.move_origin = None;
        self.message = "敵の行動中".to_string();
        self.run_enemy_turn();
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
                let next = self.shortest_step((self.units[idx].x, self.units[idx].y), nearest, self.units[idx].id);
                let Some(next) = next else { break };
                if next == (self.units[idx].x, self.units[idx].y) {
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
                    self.message = format!(
                        "{} が {} に {} ダメージ",
                        job_label(self.units[idx].job),
                        job_label(self.units[target_idx].job),
                        damage
                    );
                    if self.units[target_idx].hp <= 0 {
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
    }

    fn use_push(&mut self, unit_index: usize) {
        let (ux, uy, job_name) = {
            let unit = &self.units[unit_index];
            (unit.x, unit.y, job_label(unit.job).to_string())
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

        let dx = (self.units[target_index].x - ux).signum();
        let dy = (self.units[target_index].y - uy).signum();
        let next = (self.units[target_index].x + dx, self.units[target_index].y + dy);
        if self
            .map
            .get(next.0, next.1)
            .is_some_and(|_| self.unit_at(next.0, next.1).is_none())
        {
            self.units[target_index].x = next.0;
            self.units[target_index].y = next.1;
            self.units[unit_index].acted = true;
            self.message = format!("{} の押し込み", job_name);
        } else {
            self.units[target_index].hp = (self.units[target_index].hp - 8).max(0);
            self.units[unit_index].acted = true;
            self.message = format!("{} の押し込み失敗、代わりに8ダメージ", job_name);
        }
    }

    fn use_curved_shot(&mut self, unit_index: usize) {
        let (ux, uy, atk, job_name) = {
            let unit = &self.units[unit_index];
            (unit.x, unit.y, unit.atk + 4, job_label(unit.job).to_string())
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

        self.units[target_index].hp = (self.units[target_index].hp - atk).max(0);
        self.units[unit_index].acted = true;
        self.message = format!("{} の曲射で {} ダメージ", job_name, atk);
        self.check_victory_or_defeat();
    }

    fn use_matchlock_shot(&mut self, unit_index: usize) {
        let (ux, uy, atk, job_name) = {
            let unit = &self.units[unit_index];
            (unit.x, unit.y, unit.atk + 8, job_label(unit.job).to_string())
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

        self.units[target_index].hp = (self.units[target_index].hp - atk).max(0);
        self.units[unit_index].acted = true;
        self.message = format!("{} の火縄射撃で {} ダメージ", job_name, atk);
        self.check_victory_or_defeat();
    }

    fn use_smoke_bomb(&mut self, unit_index: usize) {
        let (ux, uy, job_name) = {
            let unit = &self.units[unit_index];
            (unit.x, unit.y, job_label(unit.job).to_string())
        };
        let tile_index = self.map.idx(ux, uy);
        if let Some(tile_index) = tile_index {
            if let Some(tile) = self.map.tiles.get_mut(tile_index) {
            tile.cover = true;
            self.units[unit_index].moved = true;
            self.units[unit_index].acted = true;
            self.message = format!("{} が煙玉を使用", job_name);
            }
        }
    }

    fn use_formation_change(&mut self, unit_index: usize) {
        let (ux, uy, job_name) = {
            let unit = &self.units[unit_index];
            (unit.x, unit.y, job_label(unit.job).to_string())
        };
        for unit in self.units.iter_mut() {
            if unit.team == Team::Player && unit.hp > 0 {
                let dist = (unit.x - ux).abs() + (unit.y - uy).abs();
                if dist <= 2 {
                    unit.hp = (unit.hp + 6).min(unit.max_hp);
                }
            }
        }
        self.units[unit_index].acted = true;
        self.message = format!("{} が陣形を整えた", job_name);
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
