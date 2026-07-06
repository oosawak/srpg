let wasm;
let cachedUint8Memory0 = null;
const textDecoder = new TextDecoder('utf-8');

function getUint8Memory0() {
  if (cachedUint8Memory0 === null || cachedUint8Memory0.buffer !== wasm.memory.buffer) {
    cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8Memory0;
}

function getStringFromWasm0(ptr, len) {
  return textDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}

function passArray8ToWasm0(array) {
  const ptr = wasm.animal_puzzle_alloc(array.length);
  getUint8Memory0().set(array, ptr);
  return [ptr, array.length];
}

function freeArray8(ptr, len) {
  wasm.animal_puzzle_dealloc(ptr, len);
}

async function loadWasm(moduleOrPath) {
  if (moduleOrPath instanceof WebAssembly.Module) {
    return await WebAssembly.instantiate(moduleOrPath, {});
  }

  const source = moduleOrPath ?? new URL('wasm_app_bg.wasm', import.meta.url);
  const response = source instanceof Response ? source : await fetch(source);
  const bytes = await response.arrayBuffer();
  return await WebAssembly.instantiate(bytes, {});
}

export default async function init(input = {}) {
  const moduleOrPath = input.module_or_path ?? input;
  const { instance } = await loadWasm(moduleOrPath);
  wasm = instance.exports;
  cachedUint8Memory0 = null;
  return wasm;
}

export function animal_puzzle_alloc(size) {
  return wasm.animal_puzzle_alloc(size);
}

export function animal_puzzle_dealloc(ptr, size) {
  wasm.animal_puzzle_dealloc(ptr, size);
}

export function animal_puzzle_init(size) {
  wasm.animal_puzzle_init(size);
}

export function animal_puzzle_reset() {
  wasm.animal_puzzle_reset();
}

export function animal_puzzle_size() {
  return wasm.animal_puzzle_size();
}

export function animal_puzzle_count() {
  return wasm.animal_puzzle_count();
}

export function animal_puzzle_is_occupied(row, col) {
  return wasm.animal_puzzle_is_occupied(row, col) !== 0;
}

export function animal_puzzle_is_valid(row, col) {
  return wasm.animal_puzzle_is_valid(row, col) !== 0;
}

export function animal_puzzle_toggle(row, col) {
  return wasm.animal_puzzle_toggle(row, col) !== 0;
}

export function animal_puzzle_is_solved() {
  return wasm.animal_puzzle_is_solved() !== 0;
}

export function animal_puzzle_set_zones(zones) {
  const [ptr, len] = passArray8ToWasm0(zones);
  const ok = wasm.animal_puzzle_set_zones(ptr, len) !== 0;
  freeArray8(ptr, len);
  return ok;
}

export function animal_puzzle_set_solution(solution) {
  const [ptr, len] = passArray8ToWasm0(solution);
  const ok = wasm.animal_puzzle_set_solution(ptr, len) !== 0;
  freeArray8(ptr, len);
  return ok;
}

export function animal_puzzle_zones() {
  const ptr = wasm.animal_puzzle_zones_ptr();
  const len = wasm.animal_puzzle_zones_len();
  return new Uint8Array(getUint8Memory0().slice(ptr, ptr + len));
}

export function animal_puzzle_animals() {
  const ptr = wasm.animal_puzzle_animals_ptr();
  const len = wasm.animal_puzzle_animals_len();
  return new Uint8Array(getUint8Memory0().slice(ptr, ptr + len));
}

export function animal_puzzle_generate(size, difficulty, nonce = 0) {
  const ptr = wasm.animal_puzzle_generate_raw(size, difficulty, nonce);
  const len = wasm.animal_puzzle_generate_len();
  return getStringFromWasm0(ptr, len);
}
