const decoder = new TextDecoder();

async function loadWasm() {
  const response = await fetch("./wasm/wasm_app.wasm");
  if (!response.ok) {
    throw new Error(`failed to load wasm: ${response.status}`);
  }

  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const exports = instance.exports;

  if (typeof exports.srpg_init === "function") {
    exports.srpg_init();
  }

  function readRenderData() {
    if (typeof exports.srpg_refresh_render === "function") {
      exports.srpg_refresh_render();
    }

    const ptr = exports.srpg_render_ptr();
    const len = exports.srpg_render_len();
    return decoder.decode(new Uint8Array(exports.memory.buffer, ptr, len));
  }

  const api = {
    get_render_data: readRenderData,
    click_tile(x, y) {
      exports.srpg_click_tile(x | 0, y | 0);
    },
    begin_move() {
      if (typeof exports.srpg_begin_move === "function") {
        exports.srpg_begin_move();
      }
    },
    cancel_move() {
      if (typeof exports.srpg_cancel_move === "function") {
        exports.srpg_cancel_move();
      }
    },
    attack_selected() {
      if (typeof exports.srpg_attack_selected === "function") {
        exports.srpg_attack_selected();
      }
    },
    use_ability(index) {
      exports.srpg_use_ability(index | 0);
    },
    toggle_view() {
      exports.srpg_toggle_view();
    },
    end_turn() {
      exports.srpg_end_turn();
    },
    reset() {
      exports.srpg_reset();
    },
  };

  window.srpgGame = api;
  return api;
}

window.createSrpgGame = loadWasm;
