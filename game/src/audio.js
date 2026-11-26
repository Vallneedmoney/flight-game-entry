// All sound is synthesized with WebAudio: no audio files, nothing fetched.
// A turbine whine that follows throttle and the burner, filtered wind that
// grows with speed, and short sounds for the gun, rockets, lock-on, kills
// and explosions. The context is created on the first user gesture, so
// browsers never block it.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let lastLockBeep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);

      // Turbine: two high saws through a low-pass, a jet whine rather
      // than a prop drone.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 110;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 110 * 1.5;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 900;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();

      // Wind: looped noise through a band-pass that opens with speed.
      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSource.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noiseBurst(dur, vol, filterFreq, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  return {
    unlock() {
      ensure();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    // Called every frame while flying: throttle 0..1, speed in m/s,
    // afterburner true while the burner is lit.
    update(throttle, speed, flying, afterburner = false) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const engineLevel = flying ? 0.04 + throttle * 0.06 + (afterburner ? 0.05 : 0) : 0;
      engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
      const freq = 95 + throttle * 130 + speed * 0.5 + (afterburner ? 90 : 0);
      engineOsc.frequency.setTargetAtTime(freq, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(freq * 1.5, t, 0.08);
      windGain.gain.setTargetAtTime(flying ? Math.min(0.14, speed * 0.0007) : 0, t, 0.15);
      windFilter.frequency.setTargetAtTime(400 + speed * 5, t, 0.15);
    },
    gun() {
      noiseBurst(0.05, 0.16, 2400);
    },
    rocket() {
      noiseBurst(0.5, 0.25, 1200);
      blip(220, 0.4, 'sawtooth', 0.1);
    },
    explosion() {
      noiseBurst(0.9, 0.4, 300);
      blip(70, 0.8, 'sine', 0.3);
    },
    hit() {
      blip(1560, 0.05, 'square', 0.1);
    },
    lock(locked) {
      if (!ctx) return;
      const now = ctx.currentTime;
      if (now - lastLockBeep < (locked ? 0.25 : 0.6)) return;
      lastLockBeep = now;
      blip(locked ? 1320 : 880, 0.07, 'sine', locked ? 0.16 : 0.08);
    },
    landing() {
      blip(523, 0.16, 'triangle', 0.25);
      blip(659, 0.16, 'triangle', 0.25, 0.1);
      blip(784, 0.3, 'triangle', 0.25, 0.2);
    },
    crash() {
      noiseBurst(0.9, 0.35, 300);
      blip(55, 0.7, 'square', 0.22, 0.05);
    },
    warning() {
      blip(440, 0.12, 'square', 0.12);
      blip(440, 0.12, 'square', 0.12, 0.18);
    },
  };
}
