// WebAudio procedural SFX & pentatonic BGM engine (no external audio files)
(function initSrpgSound() {
  const STORAGE_MUTE_KEY = "srpg.play.muted";
  const STORAGE_VOL_KEY = "srpg.play.volume";

  let audioCtx = null;
  let masterGain = null;
  let sfxGain = null;
  let bgmGain = null;
  let bgmTimerId = 0;
  let bgmStep = 0;
  let unlocked = false;

  const state = {
    muted: loadMuted(),
    volume: loadVolume(),
    bgmPlaying: false,
  };

  function loadMuted() {
    try {
      return window.localStorage.getItem(STORAGE_MUTE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function loadVolume() {
    try {
      const raw = Number.parseFloat(window.localStorage.getItem(STORAGE_VOL_KEY));
      if (Number.isFinite(raw)) return Math.max(0, Math.min(1, raw));
    } catch {
      // ignore
    }
    return 0.65;
  }

  function saveSettings() {
    try {
      window.localStorage.setItem(STORAGE_MUTE_KEY, state.muted ? "1" : "0");
      window.localStorage.setItem(STORAGE_VOL_KEY, String(state.volume));
    } catch {
      // ignore
    }
  }

  function ensureContext() {
    if (audioCtx) return audioCtx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      audioCtx = new AudioCtx();
      masterGain = audioCtx.createGain();
      sfxGain = audioCtx.createGain();
      bgmGain = audioCtx.createGain();

      sfxGain.gain.value = 0.85;
      bgmGain.gain.value = 0.24;

      sfxGain.connect(masterGain);
      bgmGain.connect(masterGain);
      masterGain.connect(audioCtx.destination);
      applyMasterGain();
      return audioCtx;
    } catch {
      return null;
    }
  }

  function applyMasterGain() {
    if (!masterGain || !audioCtx) return;
    const target = state.muted ? 0 : state.volume;
    masterGain.gain.setTargetAtTime(target, audioCtx.currentTime, 0.02);
  }

  function unlock() {
    const ctx = ensureContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    unlocked = true;
    applyMasterGain();
    return true;
  }

  function playTone({
    freq = 440,
    endFreq = null,
    type = "triangle",
    duration = 0.12,
    gain = 0.22,
    attack = 0.008,
    delay = 0,
    bus = "sfx",
  }) {
    if (!unlocked || state.muted || state.volume <= 0) return;
    const ctx = ensureContext();
    if (!ctx || ctx.state === "suspended") return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(gain, now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(env);
    env.connect(bus === "bgm" ? bgmGain : sfxGain);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playNoise({ duration = 0.08, gain = 0.16, filterFreq = 1200, filterType = "bandpass", delay = 0 }) {
    if (!unlocked || state.muted || state.volume <= 0) return;
    const ctx = ensureContext();
    if (!ctx || ctx.state === "suspended") return;

    const now = ctx.currentTime + delay;
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);

    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(sfxGain);

    src.start(now);
    src.stop(now + duration + 0.02);
  }

  const sfx = {
    ui() {
      playTone({ freq: 620, endFreq: 760, type: "sine", duration: 0.055, gain: 0.14 });
    },
    select() {
      // Crisp wooden hyoshigi-like click
      playTone({ freq: 880, endFreq: 660, type: "triangle", duration: 0.065, gain: 0.18 });
      playNoise({ duration: 0.035, gain: 0.08, filterFreq: 2400 });
    },
    move() {
      // Soft earth/wood footstep thud
      playTone({ freq: 170, endFreq: 88, type: "sine", duration: 0.08, gain: 0.22 });
      playNoise({ duration: 0.05, gain: 0.09, filterFreq: 650, filterType: "lowpass" });
    },
    attack(job = "Ashigaru") {
      if (job === "Teppo") {
        // Matchlock crack
        playNoise({ duration: 0.18, gain: 0.34, filterFreq: 900, filterType: "lowpass" });
        playTone({ freq: 180, endFreq: 45, type: "sawtooth", duration: 0.14, gain: 0.24 });
      } else if (job === "Yumi") {
        // Bow twang + whoosh
        playTone({ freq: 340, endFreq: 190, type: "triangle", duration: 0.11, gain: 0.22 });
        playNoise({ duration: 0.1, gain: 0.12, filterFreq: 2200, delay: 0.03 });
      } else {
        // Blade/spear slash
        playNoise({ duration: 0.12, gain: 0.22, filterFreq: 2800 });
        playTone({ freq: 720, endFreq: 240, type: "sawtooth", duration: 0.11, gain: 0.14 });
      }
    },
    hit() {
      // Armor impact
      playTone({ freq: 140, endFreq: 52, type: "triangle", duration: 0.14, gain: 0.3 });
      playNoise({ duration: 0.09, gain: 0.2, filterFreq: 850, filterType: "lowpass" });
    },
    defeat() {
      // Low taiko drop for fallen unit
      playTone({ freq: 165, endFreq: 42, type: "sine", duration: 0.36, gain: 0.36 });
      playTone({ freq: 246, endFreq: 110, type: "triangle", duration: 0.3, gain: 0.18, delay: 0.05 });
      playNoise({ duration: 0.22, gain: 0.16, filterFreq: 500, filterType: "lowpass" });
    },
    heal() {
      // Pentatonic rally chime
      playTone({ freq: 587.33, type: "triangle", duration: 0.16, gain: 0.16, delay: 0 });
      playTone({ freq: 659.25, type: "triangle", duration: 0.16, gain: 0.16, delay: 0.07 });
      playTone({ freq: 880.0, type: "sine", duration: 0.26, gain: 0.18, delay: 0.14 });
    },
    cutin() {
      // Dramatic Sengoku ability cut-in: taiko + blade whoosh + rising koto chime
      playTone({ freq: 145, endFreq: 62, type: "sine", duration: 0.26, gain: 0.34, delay: 0 });
      playNoise({ duration: 0.15, gain: 0.18, filterFreq: 2600, filterType: "bandpass", delay: 0.01 });
      playTone({ freq: 587.33, type: "triangle", duration: 0.18, gain: 0.18, delay: 0.03 });
      playTone({ freq: 659.25, type: "triangle", duration: 0.2, gain: 0.18, delay: 0.08 });
      playTone({ freq: 880.0, type: "sine", duration: 0.32, gain: 0.22, delay: 0.13 });
    },
    turnStart(isPlayer = true) {
      if (isPlayer) {
        // Rising taiko + horn
        playTone({ freq: 130, endFreq: 85, type: "sine", duration: 0.22, gain: 0.28 });
        playTone({ freq: 293.66, type: "triangle", duration: 0.22, gain: 0.15, delay: 0.06 });
        playTone({ freq: 440.0, type: "triangle", duration: 0.28, gain: 0.16, delay: 0.14 });
      } else {
        // Low ominous enemy drum
        playTone({ freq: 110, endFreq: 68, type: "sine", duration: 0.26, gain: 0.32 });
        playTone({ freq: 220, endFreq: 196, type: "sawtooth", duration: 0.24, gain: 0.11, delay: 0.08 });
      }
    },
    victory() {
      // Japanese Yo-scale victory fanfare (D4 E4 G4 A4 D5)
      const notes = [293.66, 329.63, 392.0, 440.0, 587.33];
      notes.forEach((n, idx) => {
        playTone({
          freq: n,
          type: idx === notes.length - 1 ? "triangle" : "sine",
          duration: idx === notes.length - 1 ? 0.55 : 0.2,
          gain: 0.2,
          delay: idx * 0.1,
        });
      });
      playTone({ freq: 146.83, endFreq: 98, type: "sine", duration: 0.4, gain: 0.28, delay: 0 });
    },
    defeatEnd() {
      // Solemn Miyako-bushi descent (D4 C4 A3 G3 D3)
      const notes = [293.66, 261.63, 220.0, 196.0, 146.83];
      notes.forEach((n, idx) => {
        playTone({
          freq: n,
          type: "triangle",
          duration: idx === notes.length - 1 ? 0.65 : 0.24,
          gain: 0.18,
          delay: idx * 0.14,
        });
      });
    },
  };

  // Gentle Sengoku In-scale koto + soft taiko pulse loop (16 steps, 340ms/step)
  const BGM_MELODY = [
    293.66, 0, 329.63, 0,
    440.0, 0, 392.0, 329.63,
    293.66, 0, 220.0, 0,
    261.63, 0, 293.66, 0,
  ];
  const BGM_BASS = [
    146.83, 0, 0, 0,
    110.0, 0, 0, 0,
    146.83, 0, 0, 0,
    130.81, 0, 110.0, 0,
  ];

  function startBgm() {
    if (state.bgmPlaying) return;
    if (!unlock()) return;
    state.bgmPlaying = true;
    bgmStep = 0;
    bgmTimerId = window.setInterval(() => {
      if (!state.bgmPlaying || state.muted || state.volume <= 0) return;
      if (!audioCtx || audioCtx.state !== "running") return;
      const i = bgmStep % BGM_MELODY.length;
      const note = BGM_MELODY[i];
      const bass = BGM_BASS[i];
      if (note > 0) {
        playTone({ freq: note, type: "triangle", duration: 0.28, gain: 0.16, attack: 0.01, bus: "bgm" });
      }
      if (bass > 0) {
        playTone({ freq: bass, endFreq: bass * 0.92, type: "sine", duration: 0.34, gain: 0.2, attack: 0.012, bus: "bgm" });
      }
      if (i % 4 === 0) {
        playTone({ freq: 92, endFreq: 56, type: "sine", duration: 0.18, gain: 0.15, attack: 0.005, bus: "bgm" });
      }
      bgmStep += 1;
    }, 360);
  }

  function stopBgm() {
    state.bgmPlaying = false;
    if (bgmTimerId) {
      window.clearInterval(bgmTimerId);
      bgmTimerId = 0;
    }
  }

  function setMuted(muted) {
    state.muted = Boolean(muted);
    saveSettings();
    applyMasterGain();
  }

  function toggleMute() {
    setMuted(!state.muted);
    return state.muted;
  }

  function setVolume(vol) {
    state.volume = Math.max(0, Math.min(1, Number(vol) || 0));
    saveSettings();
    applyMasterGain();
  }

  window.srpgSound = {
    unlock,
    startBgm,
    stopBgm,
    setMuted,
    toggleMute,
    setVolume,
    isMuted: () => state.muted,
    getVolume: () => state.volume,
    isBgmPlaying: () => state.bgmPlaying,
    play: (name, ...args) => {
      if (typeof sfx[name] === "function") {
        sfx[name](...args);
      }
    },
  };
})();
