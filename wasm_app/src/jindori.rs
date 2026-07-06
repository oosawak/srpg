use core::fmt::Write;
use std::alloc::{alloc, dealloc, Layout};
use std::sync::{Mutex, OnceLock};

struct PuzzleSpec {
    size: usize,
    difficulty: usize,
    animal_kind: u32,
    zones: Vec<u8>,
    solution: Vec<u8>,
}

struct PuzzleState {
    size: usize,
    difficulty: usize,
    animal_kind: u32,
    zones: Vec<u8>,
    solution: Vec<u8>,
    occupied: Vec<u8>,
    count: usize,
    animals_buffer: Vec<u8>,
    generate_buffer: Vec<u8>,
}

static GAME: OnceLock<Mutex<PuzzleState>> = OnceLock::new();

fn game_cell() -> &'static Mutex<PuzzleState> {
    GAME.get_or_init(|| Mutex::new(PuzzleState::new()))
}

fn with_game_mut<R, F: FnOnce(&mut PuzzleState) -> R>(f: F) -> Option<R> {
    let lock = game_cell().lock().unwrap_or_else(|poison| poison.into_inner());
    let mut game = lock;
    Some(f(&mut game))
}

fn with_game<R, F: FnOnce(&PuzzleState) -> R>(f: F) -> Option<R> {
    let lock = GAME.get()?;
    let guard = lock.lock().unwrap_or_else(|poison| poison.into_inner());
    Some(f(&guard))
}

#[no_mangle]
pub extern "C" fn animal_puzzle_alloc(size: usize) -> *mut u8 {
    let Ok(layout) = Layout::array::<u8>(size.max(1)) else {
        return core::ptr::null_mut();
    };
    unsafe { alloc(layout) }
}

#[no_mangle]
pub extern "C" fn animal_puzzle_dealloc(ptr: *mut u8, size: usize) {
    if ptr.is_null() {
        return;
    }
    if let Ok(layout) = Layout::array::<u8>(size.max(1)) {
        unsafe { dealloc(ptr, layout) };
    }
}

#[no_mangle]
pub extern "C" fn animal_puzzle_init(size: u32) {
    with_game_mut(|game| game.init(size as usize));
}

#[no_mangle]
pub extern "C" fn animal_puzzle_reset() {
    with_game_mut(|game| game.reset());
}

#[no_mangle]
pub extern "C" fn animal_puzzle_size() -> u32 {
    with_game(|game| game.size as u32).unwrap_or(0)
}

#[no_mangle]
pub extern "C" fn animal_puzzle_count() -> u32 {
    with_game(|game| game.count as u32).unwrap_or(0)
}

#[no_mangle]
pub extern "C" fn animal_puzzle_is_occupied(row: u32, col: u32) -> i32 {
    with_game(|game| game.is_occupied(row as usize, col as usize)).unwrap_or(false) as i32
}

#[no_mangle]
pub extern "C" fn animal_puzzle_is_valid(row: u32, col: u32) -> i32 {
    with_game(|game| game.is_valid(row as usize, col as usize)).unwrap_or(false) as i32
}

#[no_mangle]
pub extern "C" fn animal_puzzle_toggle(row: u32, col: u32) -> i32 {
    with_game_mut(|game| game.toggle(row as usize, col as usize))
        .unwrap_or(false) as i32
}

#[no_mangle]
pub extern "C" fn animal_puzzle_is_solved() -> i32 {
    with_game(|game| game.is_solved()).unwrap_or(false) as i32
}

#[no_mangle]
pub extern "C" fn animal_puzzle_set_zones(ptr: *const u8, len: usize) -> i32 {
    with_game_mut(|game| {
        if let Some(data) = read_bytes(ptr, len) {
            game.set_zones(data);
        }
    });
    1
}

#[no_mangle]
pub extern "C" fn animal_puzzle_set_solution(ptr: *const u8, len: usize) -> i32 {
    with_game_mut(|game| {
        if let Some(data) = read_bytes(ptr, len) {
            game.set_solution(data);
        }
    });
    1
}

#[no_mangle]
pub extern "C" fn animal_puzzle_zones_ptr() -> *const u8 {
    with_game(|game| game.zones.as_ptr()).unwrap_or(core::ptr::null())
}

#[no_mangle]
pub extern "C" fn animal_puzzle_zones_len() -> usize {
    with_game(|game| game.zones.len()).unwrap_or(0)
}

#[no_mangle]
pub extern "C" fn animal_puzzle_animals_ptr() -> *const u8 {
    with_game(|game| game.animals_buffer.as_ptr()).unwrap_or(core::ptr::null())
}

#[no_mangle]
pub extern "C" fn animal_puzzle_animals_len() -> usize {
    with_game(|game| game.animals_buffer.len()).unwrap_or(0)
}

#[no_mangle]
pub extern "C" fn animal_puzzle_generate_raw(size: u32, difficulty: u32, nonce: u32) -> *const u8 {
    with_game_mut(|game| game.generate(size as usize, difficulty as usize, nonce as u64))
        .unwrap_or(core::ptr::null())
}

#[no_mangle]
pub extern "C" fn animal_puzzle_generate_len() -> usize {
    with_game(|game| game.generate_buffer.len()).unwrap_or(0)
}

impl PuzzleState {
    fn new() -> Self {
        Self {
            size: 0,
            difficulty: 1,
            animal_kind: 0,
            zones: Vec::new(),
            solution: Vec::new(),
            occupied: Vec::new(),
            count: 0,
            animals_buffer: vec![0, 0],
            generate_buffer: Vec::new(),
        }
    }

    fn init(&mut self, size: usize) {
        self.size = size.max(1);
        self.zones = vec![0; self.size * self.size];
        self.solution = vec![0; self.size * self.size];
        self.occupied = vec![0; self.size * self.size];
        self.count = 0;
        self.refresh_animals_buffer();
    }

    fn reset(&mut self) {
        if self.size == 0 {
            return;
        }
        self.occupied.fill(0);
        self.count = 0;
        self.refresh_animals_buffer();
    }

    fn set_zones(&mut self, data: Vec<u8>) {
        let size = square_size(data.len()).unwrap_or(self.size.max(1));
        self.size = size;
        self.zones = data;
        self.ensure_buffers();
        self.refresh_animals_buffer();
    }

    fn set_solution(&mut self, data: Vec<u8>) {
        let size = square_size(data.len()).unwrap_or(self.size.max(1));
        self.size = size;
        self.solution = data;
        self.ensure_buffers();
        self.refresh_animals_buffer();
    }

    fn ensure_buffers(&mut self) {
        let len = self.size * self.size;
        if self.zones.len() != len {
            self.zones.resize(len, 0);
        }
        if self.solution.len() != len {
            self.solution.resize(len, 0);
        }
        if self.occupied.len() != len {
            self.occupied.resize(len, 0);
        }
    }

    fn refresh_animals_buffer(&mut self) {
        self.animals_buffer.clear();
        self.animals_buffer.push((self.size.min(255)) as u8);
        self.animals_buffer.push((self.count.min(255)) as u8);
    }

    fn generate(&mut self, size: usize, difficulty: usize, nonce: u64) -> *const u8 {
        let spec = make_spec(size.max(1), difficulty.max(1), nonce);
        self.apply_spec(&spec);
        self.generate_buffer.clear();
        write_spec_json(&mut self.generate_buffer, &spec);
        self.generate_buffer.as_ptr()
    }

    fn apply_spec(&mut self, spec: &PuzzleSpec) {
        self.size = spec.size;
        self.difficulty = spec.difficulty;
        self.animal_kind = spec.animal_kind;
        self.zones = spec.zones.clone();
        self.solution = spec.solution.clone();
        self.occupied = vec![0; spec.size * spec.size];
        self.count = 0;
        self.refresh_animals_buffer();
    }

    fn is_occupied(&self, row: usize, col: usize) -> bool {
        let Some(idx) = self.idx(row, col) else {
            return false;
        };
        self.occupied.get(idx).copied().unwrap_or(0) != 0
    }

    fn is_valid(&self, row: usize, col: usize) -> bool {
        let Some(idx) = self.idx(row, col) else {
            return false;
        };
        self.occupied.get(idx).copied().unwrap_or(0) == 0
    }

    fn toggle(&mut self, row: usize, col: usize) -> bool {
        let Some(idx) = self.idx(row, col) else {
            return false;
        };
        if self.occupied[idx] != 0 {
            self.occupied[idx] = 0;
            self.count = self.count.saturating_sub(1);
            self.refresh_animals_buffer();
            return true;
        }
        if !self.is_valid(row, col) {
            return false;
        }
        self.occupied[idx] = 1;
        self.count += 1;
        self.refresh_animals_buffer();
        true
    }

    fn is_solved(&self) -> bool {
        let target_count = self.solution.iter().filter(|&&value| value != 0).count();
        if self.size == 0 || self.count != target_count {
            return false;
        }
        self.occupied == self.solution
    }

    fn idx(&self, row: usize, col: usize) -> Option<usize> {
        if row < self.size && col < self.size {
            Some(row * self.size + col)
        } else {
            None
        }
    }
}

fn read_bytes(ptr: *const u8, len: usize) -> Option<Vec<u8>> {
    if ptr.is_null() || len == 0 {
        return Some(Vec::new());
    }
    let slice = unsafe { core::slice::from_raw_parts(ptr, len) };
    Some(slice.to_vec())
}

fn square_size(len: usize) -> Option<usize> {
    let size = (len as f64).sqrt() as usize;
    if size * size == len {
        Some(size)
    } else {
        None
    }
}

fn make_spec(size: usize, difficulty: usize, nonce: u64) -> PuzzleSpec {
    let animal_kind = (difficulty.saturating_sub(1) % 5) as u32;
    let seed_base = (size as u64 * 1_000_003)
        ^ (difficulty as u64 * 97_003)
        ^ nonce.wrapping_mul(1_000_003_003)
        ^ 0x9e3779b97f4a7c15;
    let zones = build_rectangular_zones(size, seed_base);
    let solution = build_solution_from_zones(size, &zones);
    PuzzleSpec {
        size,
        difficulty,
        animal_kind,
        zones,
        solution,
    }
}

fn build_rectangular_zones(size: usize, seed: u64) -> Vec<u8> {
    let max_area = max_block_area(size);
    let candidates = rectangular_candidates(size, max_area);
    let required_areas = mandatory_areas(size, max_area);
    let mut zones = vec![u8::MAX; size * size];
    let target_cycle = target_area_cycle(seed, max_area);

    for attempt in 0..128usize {
        zones.fill(u8::MAX);
        let mut next_zone = 0u8;
        let mut rng = seed.wrapping_add((attempt as u64 + 1) * 7919);
        if tile_rectangles(
            size,
            &candidates,
            &required_areas,
            &target_cycle,
            &mut zones,
            &mut next_zone,
            &mut rng,
            0,
        ) {
            return zones;
        }
    }

    let mut fallback = vec![0u8; size * size];
    for row in 0..size {
        for col in 0..size {
            fallback[row * size + col] = ((row + col) % size.max(1)) as u8;
        }
    }
    fallback
}

fn build_solution_from_zones(size: usize, zones: &[u8]) -> Vec<u8> {
    let mut bounds = vec![None::<ZoneBounds>; 256];
    for (idx, &zone) in zones.iter().enumerate() {
        let row = idx / size;
        let col = idx % size;
        let entry = &mut bounds[zone as usize];
        match entry {
            Some(bounds) => bounds.include(row, col),
            None => {
                *entry = Some(ZoneBounds::new(row, col));
            }
        }
    }

    let mut solution = vec![0u8; size * size];
    for (_zone, entry) in bounds.into_iter().enumerate() {
        let Some(bounds) = entry else {
            continue;
        };
        let row = bounds.row_min + (bounds.row_max - bounds.row_min) / 2;
        let col = bounds.col_min + (bounds.col_max - bounds.col_min) / 2;
        solution[row * size + col] = 1;
    }
    solution
}

fn next_seed(seed: u64) -> u64 {
    let mut x = seed ^ (seed << 7);
    x ^= x >> 9;
    x ^= x << 8;
    x
}

fn max_block_area(size: usize) -> usize {
    match size {
        0..=5 => 6,
        6..=7 => 8,
        _ => 10,
    }
}

fn mandatory_areas(size: usize, max_area: usize) -> Vec<usize> {
    let preset: &[usize] = match size {
        0..=5 => &[5, 4, 3],
        6..=7 => &[8, 6, 4],
        _ => &[10, 9, 8],
    };
    preset
        .iter()
        .copied()
        .filter(|&area| area <= max_area)
        .collect()
}

fn rectangular_candidates(size: usize, max_area: usize) -> Vec<(usize, usize)> {
    let area_order = [1usize, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let mut out = Vec::new();

    for &area in &area_order {
        if area > max_area {
            continue;
        }
        for h in 1..=size {
            if area % h != 0 {
                continue;
            }
            let w = area / h;
            if w == 0 || w > size {
                continue;
            }
            if h == w {
                out.push((h, w));
            } else {
                out.push((h, w));
                out.push((w, h));
            }
        }
    }

    out
}

fn target_area_cycle(seed: u64, max_area: usize) -> Vec<usize> {
    let mut cycle: Vec<usize> = vec![
        2, 3, 4, 5, 2, 3, 4, 6, 3, 4, 5, 1, 2, 4, 6, 3, 5, 2, 4, 6, 1, 3, 5,
    ]
    .into_iter()
    .filter(|&area| area <= max_area)
    .collect();
    if cycle.is_empty() {
        cycle.push(1);
    }
    let mut rng = seed;
    for i in (1..cycle.len()).rev() {
        rng = next_seed(rng);
        let j = (rng as usize) % (i + 1);
        cycle.swap(i, j);
    }
    cycle
}

fn tile_rectangles(
    size: usize,
    candidates: &[(usize, usize)],
    required_areas: &[usize],
    target_cycle: &[usize],
    zones: &mut [u8],
    next_zone: &mut u8,
    rng: &mut u64,
    depth: usize,
) -> bool {
    let Some(start) = zones.iter().position(|&value| value == u8::MAX) else {
        return true;
    };
    let row = start / size;
    let col = start % size;
    let target = if depth < required_areas.len() {
        required_areas[depth]
    } else {
        target_cycle[(depth - required_areas.len()) % target_cycle.len()]
    };
    let max_area = max_block_area(size);

    let mut order: Vec<usize> = (0..candidates.len()).collect();
    let seed = *rng ^ ((depth as u64 + 1) * 0x9e3779b97f4a7c15);
    order.sort_by_key(|&idx| {
        let (h, w) = candidates[idx];
        let area = h * w;
        if depth < required_areas.len() && area != target {
            return (usize::MAX, 2, usize::MAX, h.max(w), h.min(w));
        }
        let distance = area.abs_diff(target);
        let size_bias = if area <= max_area { 0 } else { 2 };
        let even_bias = if area % 2 == 0 { 0 } else { 1 };
        let jitter = seed
            .wrapping_add((idx as u64 + 1) * 1_000_003)
            .rotate_left(13) as usize;
        (distance, size_bias, even_bias, jitter, h.max(w))
    });

    for idx in order {
        let (h, w) = candidates[idx];
        if row + h > size || col + w > size {
            continue;
        }

        let mut fits = true;
        for r in row..row + h {
            for c in col..col + w {
                if zones[r * size + c] != u8::MAX {
                    fits = false;
                    break;
                }
            }
            if !fits {
                break;
            }
        }
        if !fits {
            continue;
        }

        let zone_id = *next_zone;
        *next_zone = next_zone.wrapping_add(1);
        for r in row..row + h {
            for c in col..col + w {
                zones[r * size + c] = zone_id;
            }
        }

        *rng = next_seed(*rng);
        if tile_rectangles(
            size,
            candidates,
            required_areas,
            target_cycle,
            zones,
            next_zone,
            rng,
            depth + 1,
        ) {
            return true;
        }

        for r in row..row + h {
            for c in col..col + w {
                zones[r * size + c] = u8::MAX;
            }
        }
        *next_zone = zone_id;
    }

    false
}

#[derive(Clone, Copy)]
struct ZoneBounds {
    row_min: usize,
    row_max: usize,
    col_min: usize,
    col_max: usize,
}

impl ZoneBounds {
    fn new(row: usize, col: usize) -> Self {
        Self {
            row_min: row,
            row_max: row,
            col_min: col,
            col_max: col,
        }
    }

    fn include(&mut self, row: usize, col: usize) {
        self.row_min = self.row_min.min(row);
        self.row_max = self.row_max.max(row);
        self.col_min = self.col_min.min(col);
        self.col_max = self.col_max.max(col);
    }
}

fn write_spec_json(out: &mut Vec<u8>, spec: &PuzzleSpec) {
    out.clear();
    let _ = write!(
        out_writer(out),
        "{{\"size\":{},\"difficulty\":{},\"animal_kind\":{},\"zones\":[",
        spec.size,
        spec.difficulty,
        spec.animal_kind
    );
    write_u8_list(out, &spec.zones);
    out.extend_from_slice(b"],\"solution\":[");
    write_u8_list(out, &spec.solution);
    out.extend_from_slice(b"]}");
}

fn out_writer(out: &mut Vec<u8>) -> VecWriter<'_> {
    VecWriter { out }
}

struct VecWriter<'a> {
    out: &'a mut Vec<u8>,
}

impl Write for VecWriter<'_> {
    fn write_str(&mut self, s: &str) -> core::fmt::Result {
        self.out.extend_from_slice(s.as_bytes());
        Ok(())
    }
}

fn write_u8_list(out: &mut Vec<u8>, values: &[u8]) {
    for (i, value) in values.iter().enumerate() {
        if i > 0 {
            out.push(b',');
        }
        let _ = write!(out_writer(out), "{}", value);
    }
}
