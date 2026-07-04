# SRPG Docs

この `docs/` フォルダーは GitHub Pages 用の公開資料として使う。

## 参照

- [初期設計メモ](initial_design.md)
- [Rust コア概要](core_api.md)
- [プレイ画面](play/)
- [アーキテクチャ方針](architecture.md)

## 方針

- Rust 側でルールと戦術判定を持つ
- WASM 側でゲーム状態を公開する
- JS 側で描画と入力を担当する
