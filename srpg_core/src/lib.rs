pub type UnitId = u32;
pub type ClanId = u32;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ViewMode {
    Isometric,
    TopDown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Terrain {
    Plain,
    Mountain,
    Castle,
    Town,
    RiceField,
    Terrace,
    Water,
    Road,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Tile {
    pub terrain: Terrain,
    pub height: i32,
    pub cover: bool,
    pub water: bool,
}

impl Tile {
    pub fn movement_cost(&self) -> i32 {
        let terrain_cost = match self.terrain {
            Terrain::Plain => 1,
            Terrain::Road => 1,
            Terrain::Town => 2,
            Terrain::Castle => 2,
            Terrain::RiceField => 3,
            Terrain::Terrace => 2,
            Terrain::Mountain => 4,
            Terrain::Water => 99,
        };
        if self.water {
            terrain_cost + 1
        } else {
            terrain_cost
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Job {
    Ashigaru,
    Yari,
    Yumi,
    Teppo,
    Ninja,
    Strategist,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Stats {
    pub hp: i32,
    pub atk: i32,
    pub def: i32,
    pub mag: i32,
    pub spd: i32,
    pub mov: i32,
    pub jump: i32,
}

impl Default for Stats {
    fn default() -> Self {
        Self {
            hp: 100,
            atk: 10,
            def: 10,
            mag: 10,
            spd: 10,
            mov: 4,
            jump: 2,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Trait {
    pub name: String,
    pub power: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AbilityKind {
    Push,
    CurvedShot,
    MatchlockCharge,
    SmokeBomb,
    FormationChange,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Ability {
    pub kind: AbilityKind,
    pub name: String,
    pub range: i32,
    pub cost: i32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Unit {
    pub id: UnitId,
    pub clan: ClanId,
    pub job: Job,
    pub stats: Stats,
    pub traits: Vec<Trait>,
    pub abilities: Vec<Ability>,
    pub pos: (i32, i32),
}

impl Unit {
    pub fn new(id: UnitId, clan: ClanId, job: Job, pos: (i32, i32)) -> Self {
        Self {
            id,
            clan,
            job,
            stats: Stats::default(),
            traits: Vec::new(),
            abilities: default_abilities(job),
            pos,
        }
    }
}

pub fn default_abilities(job: Job) -> Vec<Ability> {
    match job {
        Job::Ashigaru => vec![Ability {
            kind: AbilityKind::Push,
            name: "押し込み".to_string(),
            range: 1,
            cost: 2,
        }],
        Job::Yari => vec![],
        Job::Yumi => vec![Ability {
            kind: AbilityKind::CurvedShot,
            name: "曲射".to_string(),
            range: 5,
            cost: 3,
        }],
        Job::Teppo => vec![Ability {
            kind: AbilityKind::MatchlockCharge,
            name: "火縄チャージ".to_string(),
            range: 4,
            cost: 4,
        }],
        Job::Ninja => vec![Ability {
            kind: AbilityKind::SmokeBomb,
            name: "煙玉".to_string(),
            range: 2,
            cost: 2,
        }],
        Job::Strategist => vec![Ability {
            kind: AbilityKind::FormationChange,
            name: "陣形変更".to_string(),
            range: 3,
            cost: 3,
        }],
    }
}

#[derive(Debug, Clone)]
pub struct Map {
    pub width: usize,
    pub height: usize,
    pub tiles: Vec<Tile>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProjectedTile {
    pub x: i32,
    pub y: i32,
    pub screen_x: i32,
    pub screen_y: i32,
    pub depth: i32,
    pub terrain: Terrain,
    pub height: i32,
}

impl Map {
    pub fn new(width: usize, height: usize, fill: Tile) -> Self {
        Self {
            width,
            height,
            tiles: vec![fill; width * height],
        }
    }

    pub fn idx(&self, x: i32, y: i32) -> Option<usize> {
        if x < 0 || y < 0 {
            return None;
        }
        let (x, y) = (x as usize, y as usize);
        if x >= self.width || y >= self.height {
            None
        } else {
            Some(y * self.width + x)
        }
    }

    pub fn get(&self, x: i32, y: i32) -> Option<&Tile> {
        self.idx(x, y).and_then(|idx| self.tiles.get(idx))
    }

    pub fn projected_tiles(&self, view_mode: ViewMode, tile_size: i32) -> Vec<ProjectedTile> {
        let mut tiles = Vec::with_capacity(self.tiles.len());

        for y in 0..self.height as i32 {
            for x in 0..self.width as i32 {
                let Some(tile) = self.get(x, y) else {
                    continue;
                };

                let (screen_x, screen_y, depth) = match view_mode {
                    ViewMode::TopDown => (x * tile_size, y * tile_size, y),
                    ViewMode::Isometric => {
                        let iso_x = (x - y) * (tile_size / 2);
                        let iso_y = (x + y) * (tile_size / 4) - tile.height * (tile_size / 3);
                        (iso_x, iso_y, x + y + tile.height)
                    }
                };

                tiles.push(ProjectedTile {
                    x,
                    y,
                    screen_x,
                    screen_y,
                    depth,
                    terrain: tile.terrain,
                    height: tile.height,
                });
            }
        }

        tiles.sort_by_key(|tile| tile.depth);
        tiles
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BattleState {
    StartTurn(UnitId),
    SelectAction,
    ExecuteAction,
    EndTurn,
}

#[derive(Debug, Clone)]
pub struct BattleSnapshot {
    pub state: BattleState,
    pub turn_number: u32,
    pub active_unit: Option<UnitId>,
    pub units: Vec<Unit>,
}

pub fn evaluate_tactics(unit: &Unit, map: &Map) -> f32 {
    let tile_bonus = map
        .get(unit.pos.0, unit.pos.1)
        .map(|tile| {
            let height_bonus = tile.height as f32 * 0.2;
            let cover_bonus = if tile.cover { 1.0 } else { 0.0 };
            let water_penalty = if tile.water { -1.5 } else { 0.0 };
            height_bonus + cover_bonus + water_penalty
        })
        .unwrap_or(0.0);

    let job_bonus = match unit.job {
        Job::Ashigaru => 0.8,
        Job::Yari => 0.9,
        Job::Yumi => 1.1,
        Job::Teppo => 1.2,
        Job::Ninja => 1.3,
        Job::Strategist => 1.4,
    };

    tile_bonus + job_bonus + unit.stats.spd as f32 * 0.05
}
