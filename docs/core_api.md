# SRPG Rust Core API

`srpg_core` に置く予定の最小 API の概要。

## 型

```rust
pub enum Terrain
pub struct Tile
pub enum ViewMode
pub struct ProjectedTile
pub enum Job
pub struct Stats
pub struct Trait
pub enum AbilityKind
pub struct Ability
pub struct Unit
pub struct Map
pub enum BattleState
pub struct BattleSnapshot
```

## 主な関数

```rust
pub fn default_abilities(job: Job) -> Vec<Ability>
pub fn evaluate_tactics(unit: &Unit, map: &Map) -> f32
```

## WASM からの公開

- `Game::new`
- `Game::update`
- `Game::apply_input`
- `Game::get_render_data`
- `Game::demo_map`
- `Game::default_stats`
- `Game::view_mode`
- `Game::toggle_view_mode`
- `Game::set_view_mode`

## 補足

現時点では外部クレートなしの最小実装にしてあるため、描画はまだプレースホルダー。
ただし、斜め見下ろしと真上 2D の切り替えに必要な座標データは Rust 側で返す。
