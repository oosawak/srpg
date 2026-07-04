# srpg

戦国 SRPG の実験リポジトリです。

## 設計メモ

- [初期設計メモ](docs/initial_design.md)
- [Rust コア概要](docs/core_api.md)
- [プレイ画面](docs/play/)
- [アーキテクチャ方針](docs/architecture.md)

## 方針

- Rust 側でルールと AI を持つ
- WASM / JS 側で描画と入力を担当する
- `rustgames` の構成を参考にしつつ、このリポジトリ向けに最小構成から作る
- まずは外部依存なしで骨組みを固める

## 構成

- `srpg_core/` ルール本体
- `wasm_app/` WASM 公開 API
- `docs/` GitHub Pages 用資料
