use srpg_core::{Job, Map, Terrain, Tile};
use std::collections::{BTreeMap, HashSet};

#[derive(Debug, Clone)]
pub struct ParsedUnit {
    pub id: u32,
    pub clan: u32,
    pub job: Job,
    pub is_enemy: bool,
    pub x: i32,
    pub y: i32,
    pub hp: i32,
    pub atk: i32,
    pub mov: i32,
    pub range: i32,
    pub leader: bool,
    pub name: String,
    pub role: String,
    pub tag: String,
    pub basis: String,
    pub note: String,
}

#[derive(Debug, Clone)]
pub struct ParsedScenario {
    pub slug: String,
    pub start_message: String,
    pub bridge_label: String,
    pub escape_label: String,
    pub map: Map,
    pub bridge_tiles: HashSet<(i32, i32)>,
    pub escape_tiles: HashSet<(i32, i32)>,
    pub units: Vec<ParsedUnit>,
}

#[derive(Debug, Clone)]
enum JsonValue {
    Null,
    Bool(bool),
    Number(i64),
    String(String),
    Array(Vec<JsonValue>),
    Object(BTreeMap<String, JsonValue>),
}

impl JsonValue {
    fn as_object(&self) -> Option<&BTreeMap<String, JsonValue>> {
        match self {
            JsonValue::Object(map) => Some(map),
            _ => None,
        }
    }

    fn as_array(&self) -> Option<&[JsonValue]> {
        match self {
            JsonValue::Array(arr) => Some(arr),
            _ => None,
        }
    }

    fn as_str(&self) -> Option<&str> {
        match self {
            JsonValue::String(s) => Some(s.as_str()),
            _ => None,
        }
    }

    fn as_i64(&self) -> Option<i64> {
        match self {
            JsonValue::Number(n) => Some(*n),
            _ => None,
        }
    }

    fn as_bool(&self) -> Option<bool> {
        match self {
            JsonValue::Bool(b) => Some(*b),
            _ => None,
        }
    }
}

struct Parser<'a> {
    bytes: &'a [u8],
    pos: usize,
}

impl<'a> Parser<'a> {
    fn new(input: &'a str) -> Self {
        Self {
            bytes: input.as_bytes(),
            pos: 0,
        }
    }

    fn skip_ws(&mut self) {
        while self.pos < self.bytes.len() {
            match self.bytes[self.pos] {
                b' ' | b'\t' | b'\n' | b'\r' => self.pos += 1,
                _ => break,
            }
        }
    }

    fn peek(&self) -> Option<u8> {
        self.bytes.get(self.pos).copied()
    }

    fn parse_value(&mut self) -> Result<JsonValue, String> {
        self.skip_ws();
        let b = self.peek().ok_or_else(|| "unexpected end of JSON".to_string())?;
        match b {
            b'{' => self.parse_object(),
            b'[' => self.parse_array(),
            b'"' => self.parse_string().map(JsonValue::String),
            b't' => self.parse_literal(b"true", JsonValue::Bool(true)),
            b'f' => self.parse_literal(b"false", JsonValue::Bool(false)),
            b'n' => self.parse_literal(b"null", JsonValue::Null),
            b'-' | b'0'..=b'9' => self.parse_number(),
            _ => Err(format!("unexpected byte '{}' at {}", b as char, self.pos)),
        }
    }

    fn parse_literal(&mut self, expected: &[u8], value: JsonValue) -> Result<JsonValue, String> {
        if self.bytes[self.pos..].starts_with(expected) {
            self.pos += expected.len();
            Ok(value)
        } else {
            Err(format!("invalid literal at {}", self.pos))
        }
    }

    fn parse_number(&mut self) -> Result<JsonValue, String> {
        let start = self.pos;
        if self.peek() == Some(b'-') {
            self.pos += 1;
        }
        let digits_start = self.pos;
        while let Some(b'0'..=b'9') = self.peek() {
            self.pos += 1;
        }
        if self.pos == digits_start {
            return Err(format!("invalid number at {}", start));
        }
        let int_end = self.pos;
        // Skip optional fraction / exponent if present
        if self.peek() == Some(b'.') {
            self.pos += 1;
            while let Some(b'0'..=b'9') = self.peek() {
                self.pos += 1;
            }
        }
        if matches!(self.peek(), Some(b'e' | b'E')) {
            self.pos += 1;
            if matches!(self.peek(), Some(b'+' | b'-')) {
                self.pos += 1;
            }
            while let Some(b'0'..=b'9') = self.peek() {
                self.pos += 1;
            }
        }
        let s = core::str::from_utf8(&self.bytes[start..int_end])
            .map_err(|_| "invalid utf8 in number".to_string())?;
        let n = s.parse::<i64>().map_err(|_| format!("bad integer '{}'", s))?;
        Ok(JsonValue::Number(n))
    }

    fn parse_string(&mut self) -> Result<String, String> {
        if self.peek() != Some(b'"') {
            return Err(format!("expected '\"' at {}", self.pos));
        }
        self.pos += 1;
        let mut out = String::new();
        while self.pos < self.bytes.len() {
            let b = self.bytes[self.pos];
            if b == b'"' {
                self.pos += 1;
                return Ok(out);
            }
            if b == b'\\' {
                self.pos += 1;
                let esc = self.peek().ok_or_else(|| "unterminated escape".to_string())?;
                self.pos += 1;
                match esc {
                    b'"' => out.push('"'),
                    b'\\' => out.push('\\'),
                    b'/' => out.push('/'),
                    b'b' => out.push('\u{0008}'),
                    b'f' => out.push('\u{000C}'),
                    b'n' => out.push('\n'),
                    b'r' => out.push('\r'),
                    b't' => out.push('\t'),
                    b'u' => {
                        let code = self.parse_hex4()?;
                        if (0xD800..=0xDBFF).contains(&code) {
                            if self.bytes[self.pos..].starts_with(b"\\u") {
                                self.pos += 2;
                                let low = self.parse_hex4()?;
                                if (0xDC00..=0xDFFF).contains(&low) {
                                    let combined = 0x10000
                                        + (((code as u32) - 0xD800) << 10)
                                        + ((low as u32) - 0xDC00);
                                    if let Some(ch) = char::from_u32(combined) {
                                        out.push(ch);
                                    }
                                }
                            }
                        } else if let Some(ch) = char::from_u32(code as u32) {
                            out.push(ch);
                        }
                    }
                    _ => return Err(format!("unknown escape \\{}", esc as char)),
                }
                continue;
            }
            // Copy contiguous non-escaped UTF-8 slice
            let chunk_start = self.pos;
            while self.pos < self.bytes.len()
                && self.bytes[self.pos] != b'"'
                && self.bytes[self.pos] != b'\\'
            {
                self.pos += 1;
            }
            let chunk = core::str::from_utf8(&self.bytes[chunk_start..self.pos])
                .map_err(|_| "invalid utf8 in string".to_string())?;
            out.push_str(chunk);
        }
        Err("unterminated string".to_string())
    }

    fn parse_hex4(&mut self) -> Result<u16, String> {
        if self.pos + 4 > self.bytes.len() {
            return Err("incomplete \\u escape".to_string());
        }
        let s = core::str::from_utf8(&self.bytes[self.pos..self.pos + 4])
            .map_err(|_| "invalid hex escape".to_string())?;
        self.pos += 4;
        u16::from_str_radix(s, 16).map_err(|_| format!("invalid hex '{}'", s))
    }

    fn parse_array(&mut self) -> Result<JsonValue, String> {
        self.pos += 1; // '['
        let mut items = Vec::new();
        self.skip_ws();
        if self.peek() == Some(b']') {
            self.pos += 1;
            return Ok(JsonValue::Array(items));
        }
        loop {
            items.push(self.parse_value()?);
            self.skip_ws();
            match self.peek() {
                Some(b',') => {
                    self.pos += 1;
                }
                Some(b']') => {
                    self.pos += 1;
                    return Ok(JsonValue::Array(items));
                }
                _ => return Err(format!("expected ',' or ']' at {}", self.pos)),
            }
        }
    }

    fn parse_object(&mut self) -> Result<JsonValue, String> {
        self.pos += 1; // '{'
        let mut map = BTreeMap::new();
        self.skip_ws();
        if self.peek() == Some(b'}') {
            self.pos += 1;
            return Ok(JsonValue::Object(map));
        }
        loop {
            self.skip_ws();
            let key = self.parse_string()?;
            self.skip_ws();
            if self.peek() != Some(b':') {
                return Err(format!("expected ':' at {}", self.pos));
            }
            self.pos += 1;
            let val = self.parse_value()?;
            map.insert(key, val);
            self.skip_ws();
            match self.peek() {
                Some(b',') => {
                    self.pos += 1;
                }
                Some(b'}') => {
                    self.pos += 1;
                    return Ok(JsonValue::Object(map));
                }
                _ => return Err(format!("expected ',' or '}}' at {}", self.pos)),
            }
        }
    }
}

fn parse_terrain(name: &str) -> Terrain {
    match name {
        "Mountain" => Terrain::Mountain,
        "Castle" => Terrain::Castle,
        "Town" => Terrain::Town,
        "RiceField" => Terrain::RiceField,
        "Terrace" => Terrain::Terrace,
        "Water" => Terrain::Water,
        "Road" => Terrain::Road,
        _ => Terrain::Plain,
    }
}

fn parse_job(name: &str) -> Job {
    match name {
        "Yari" => Job::Yari,
        "Yumi" => Job::Yumi,
        "Teppo" => Job::Teppo,
        "Ninja" => Job::Ninja,
        "Strategist" => Job::Strategist,
        _ => Job::Ashigaru,
    }
}

pub fn parse_scenario_json(input: &str) -> Result<ParsedScenario, String> {
    let mut parser = Parser::new(input);
    let root = parser.parse_value()?;
    let obj = root
        .as_object()
        .ok_or_else(|| "scenario root must be a JSON object".to_string())?;

    let slug = obj
        .get("slug")
        .and_then(JsonValue::as_str)
        .unwrap_or("custom")
        .to_string();
    let start_message = obj
        .get("start_message")
        .and_then(JsonValue::as_str)
        .unwrap_or("自軍の行動です")
        .to_string();
    let bridge_label = obj
        .get("bridge_label")
        .and_then(JsonValue::as_str)
        .unwrap_or("橋")
        .to_string();
    let escape_label = obj
        .get("escape_label")
        .and_then(JsonValue::as_str)
        .unwrap_or("離脱マス")
        .to_string();

    let map_obj = obj
        .get("map")
        .and_then(JsonValue::as_object)
        .ok_or_else(|| "missing 'map' object".to_string())?;
    let width = map_obj
        .get("width")
        .and_then(JsonValue::as_i64)
        .ok_or_else(|| "missing 'map.width'".to_string())?;
    let height = map_obj
        .get("height")
        .and_then(JsonValue::as_i64)
        .ok_or_else(|| "missing 'map.height'".to_string())?;
    if width <= 0 || height <= 0 || width > 64 || height > 64 {
        return Err("invalid map dimensions".to_string());
    }
    let width = width as usize;
    let height = height as usize;

    let fill = Tile {
        terrain: Terrain::Plain,
        height: 1,
        cover: false,
        water: false,
    };
    let mut map = Map::new(width, height, fill);
    let mut bridge_tiles = HashSet::new();
    let mut escape_tiles = HashSet::new();

    let tiles_arr = map_obj
        .get("tiles")
        .and_then(JsonValue::as_array)
        .ok_or_else(|| "missing 'map.tiles'".to_string())?;

    for tile_val in tiles_arr {
        let tobj = tile_val
            .as_object()
            .ok_or_else(|| "tile entry must be an object".to_string())?;
        let x = tobj.get("x").and_then(JsonValue::as_i64).unwrap_or(-1) as i32;
        let y = tobj.get("y").and_then(JsonValue::as_i64).unwrap_or(-1) as i32;
        let Some(idx) = map.idx(x, y) else {
            continue;
        };
        let terrain = tobj
            .get("terrain")
            .and_then(JsonValue::as_str)
            .map(parse_terrain)
            .unwrap_or(Terrain::Plain);
        let tile_height = tobj.get("height").and_then(JsonValue::as_i64).unwrap_or(1) as i32;
        let cover = tobj.get("cover").and_then(JsonValue::as_bool).unwrap_or(false);
        let water = tobj
            .get("water")
            .and_then(JsonValue::as_bool)
            .unwrap_or(matches!(terrain, Terrain::Water | Terrain::RiceField));
        let bridge = tobj.get("bridge").and_then(JsonValue::as_bool).unwrap_or(false);
        let escape = tobj.get("escape").and_then(JsonValue::as_bool).unwrap_or(false);

        if bridge {
            bridge_tiles.insert((x, y));
        }
        if escape {
            escape_tiles.insert((x, y));
        }
        map.tiles[idx] = Tile {
            terrain,
            height: tile_height,
            cover,
            water,
        };
    }

    let units_arr = obj
        .get("units")
        .and_then(JsonValue::as_array)
        .ok_or_else(|| "missing 'units' array".to_string())?;
    let mut units = Vec::with_capacity(units_arr.len());

    for (idx, unit_val) in units_arr.iter().enumerate() {
        let uobj = unit_val
            .as_object()
            .ok_or_else(|| "unit entry must be an object".to_string())?;
        let id = uobj
            .get("id")
            .and_then(JsonValue::as_i64)
            .unwrap_or((idx + 1) as i64) as u32;
        let team_str = uobj.get("team").and_then(JsonValue::as_str).unwrap_or("player");
        let is_enemy = team_str == "enemy";
        let clan = uobj
            .get("clan")
            .and_then(JsonValue::as_i64)
            .unwrap_or(if is_enemy { 2 } else { 1 }) as u32;
        let job = uobj
            .get("job")
            .and_then(JsonValue::as_str)
            .map(parse_job)
            .unwrap_or(Job::Ashigaru);
        let x = uobj.get("x").and_then(JsonValue::as_i64).unwrap_or(0) as i32;
        let y = uobj.get("y").and_then(JsonValue::as_i64).unwrap_or(0) as i32;
        let hp = uobj.get("hp").and_then(JsonValue::as_i64).unwrap_or(90).max(1) as i32;
        let atk = uobj.get("atk").and_then(JsonValue::as_i64).unwrap_or(14).max(1) as i32;
        let mov = uobj.get("mov").and_then(JsonValue::as_i64).unwrap_or(3).max(1) as i32;
        let range = uobj.get("range").and_then(JsonValue::as_i64).unwrap_or(1).max(1) as i32;
        let leader = uobj.get("leader").and_then(JsonValue::as_bool).unwrap_or(false);
        let name = uobj
            .get("name")
            .and_then(JsonValue::as_str)
            .unwrap_or("")
            .to_string();
        let role = uobj
            .get("role")
            .and_then(JsonValue::as_str)
            .unwrap_or("")
            .to_string();
        let tag = uobj
            .get("tag")
            .and_then(JsonValue::as_str)
            .unwrap_or("")
            .to_string();
        let basis = uobj
            .get("basis")
            .and_then(JsonValue::as_str)
            .unwrap_or("")
            .to_string();
        let note = uobj
            .get("note")
            .and_then(JsonValue::as_str)
            .unwrap_or("")
            .to_string();

        units.push(ParsedUnit {
            id,
            clan,
            job,
            is_enemy,
            x,
            y,
            hp,
            atk,
            mov,
            range,
            leader,
            name,
            role,
            tag,
            basis,
            note,
        });
    }

    if units.is_empty() {
        return Err("scenario must define at least one unit".to_string());
    }

    Ok(ParsedScenario {
        slug,
        start_message,
        bridge_label,
        escape_label,
        map,
        bridge_tiles,
        escape_tiles,
        units,
    })
}
