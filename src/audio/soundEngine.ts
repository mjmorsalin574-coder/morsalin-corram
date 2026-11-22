import type { GameSettings } from '../types/game';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private sfxBus: GainNode | null = null;
  private roomSend: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private snapNoiseBuffer: AudioBuffer | null = null;
  private brushNoiseBuffer: AudioBuffer | null = null;
  private cupNoiseBuffer: AudioBuffer | null = null;

  private musicTimer: number | null = null;
  private musicStep = 0;

  private enabled = true;
  private volume = 0.75;
  private musicEnabled = true;
  private musicVolume = 0.35;
  private haptics = true;
  private appActive = true;

  // Smart polyphony & burst limiting for multi-coin break cascades
  private recentHits: number[] = [];

  public applySettings(settings: GameSettings) {
    this.enabled = settings.soundEnabled;
    this.volume = settings.soundVolume;
    this.musicEnabled = settings.musicEnabled;
    this.musicVolume = settings.musicVolume;
    this.haptics = settings.hapticsEnabled;
    this.syncMusicState();
  }

  public setAppActive(active: boolean) {
    this.appActive = active;
    if (!this.ctx) return;
    if (!active) {
      this.stopMusicLoop();
      if (this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    } else {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.syncMusicState();
    }
  }

  public unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      // Master compressor eliminates clipping on dense break-shot clusters
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 14;
      comp.ratio.value = 6;
      comp.attack.value = 0.002;
      comp.release.value = 0.09;
      comp.connect(ctx.destination);
      this.compressor = comp;

      // Dry SFX bus
      const sfxBus = ctx.createGain();
      sfxBus.gain.value = 1;
      sfxBus.connect(comp);
      this.sfxBus = sfxBus;

      // Subtle wooden parlor early-reflection room bus (gives acoustic depth to wood hits)
      const roomSend = ctx.createGain();
      roomSend.gain.value = 0.16;

      const delayA = ctx.createDelay(0.1);
      delayA.delayTime.value = 0.013;
      const delayB = ctx.createDelay(0.1);
      delayB.delayTime.value = 0.027;

      const roomFilter = ctx.createBiquadFilter();
      roomFilter.type = 'lowpass';
      roomFilter.frequency.value = 1550;

      const roomOut = ctx.createGain();
      roomOut.gain.value = 0.85;

      roomSend.connect(delayA);
      roomSend.connect(delayB);
      delayA.connect(roomFilter);
      delayB.connect(roomFilter);
      roomFilter.connect(roomOut);
      roomOut.connect(comp);
      this.roomSend = roomSend;

      // Ambient music bus
      const musicGain = ctx.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(comp);
      this.musicGain = musicGain;

      this.buildBuffers(ctx);
    }

    if (this.ctx && this.ctx.state === 'suspended' && this.appActive) {
      this.ctx.resume().catch(() => {});
    }
    this.syncMusicState();
  }

  private buildBuffers(ctx: AudioContext) {
    const sr = ctx.sampleRate;

    // 1. Sharp phenolic/wood micro-crack impulse (25ms)
    const snapLen = Math.floor(sr * 0.025);
    const snap = ctx.createBuffer(1, snapLen, sr);
    const snapData = snap.getChannelData(0);
    for (let i = 0; i < snapLen; i++) {
      const env = Math.exp(-i / (sr * 0.0032));
      snapData[i] = (Math.random() * 2 - 1) * env;
    }
    this.snapNoiseBuffer = snap;

    // 2. Soft boric-powder brush noise (140ms pink-ish envelope)
    const brushLen = Math.floor(sr * 0.14);
    const brush = ctx.createBuffer(1, brushLen, sr);
    const brushData = brush.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    for (let i = 0; i < brushLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.88 * b0 + white * 0.12;
      b1 = 0.72 * b1 + b0 * 0.28;
      const t = i / brushLen;
      const env = Math.sin(Math.min(1, t * 5) * (Math.PI / 2)) * Math.exp(-t * 3.4);
      brushData[i] = b1 * env * 2.2;
    }
    this.brushNoiseBuffer = brush;

    // 3. Soft cotton/leather pocket cup thump noise (90ms)
    const cupLen = Math.floor(sr * 0.09);
    const cup = ctx.createBuffer(1, cupLen, sr);
    const cupData = cup.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < cupLen; i++) {
      const white = Math.random() * 2 - 1;
      prev = 0.65 * prev + white * 0.35;
      cupData[i] = prev * Math.exp(-i / (sr * 0.02));
    }
    this.cupNoiseBuffer = cup;
  }

  private syncMusicState() {
    if (!this.ctx || !this.musicGain) return;
    const shouldPlay =
      this.appActive && this.musicEnabled && this.musicVolume > 0.01;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(
      shouldPlay ? this.musicVolume * 0.11 : 0,
      now,
      0.18
    );

    if (shouldPlay && this.musicTimer === null) {
      this.startMusicLoop();
    } else if (!shouldPlay && this.musicTimer !== null) {
      this.stopMusicLoop();
    }
  }

  private startMusicLoop() {
    if (typeof window === 'undefined' || this.musicTimer !== null) return;
    // Gentle warm acoustic parlor plucked motif (D minor pentatonic)
    const scaleNotes = [293.66, 349.23, 440.0, 523.25, 392.0, 349.23, 261.63, 329.63];

    const playNote = () => {
      if (!this.ctx || !this.musicGain || !this.appActive || !this.musicEnabled) return;
      if (this.ctx.state !== 'running') return;

      const now = this.ctx.currentTime;
      const freq = scaleNotes[this.musicStep % scaleNotes.length];
      this.musicStep = (this.musicStep + 1) % scaleNotes.length;

      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const noteGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, now);
      filter.frequency.exponentialRampToValueAtTime(420, now + 1.2);

      noteGain.gain.setValueAtTime(0.001, now);
      noteGain.gain.linearRampToValueAtTime(0.24, now + 0.035);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

      osc.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 1.45);

      if (this.musicStep % 4 === 1) {
        const bass = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bass.type = 'sine';
        bass.frequency.setValueAtTime(freq * 0.5, now);
        bassGain.gain.setValueAtTime(0.001, now);
        bassGain.gain.linearRampToValueAtTime(0.26, now + 0.12);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
        bass.connect(bassGain);
        bassGain.connect(this.musicGain);
        bass.start(now);
        bass.stop(now + 2.6);
      }
    };

    playNote();
    this.musicTimer = window.setInterval(playNote, 960);
  }

  private stopMusicLoop() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private routeSfx(node: AudioNode, sendRoom = true) {
    if (this.sfxBus) node.connect(this.sfxBus);
    if (sendRoom && this.roomSend) node.connect(this.roomSend);
  }

  public vibrate(durationMs = 15) {
    if (!this.haptics) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(durationMs);
      } catch {
        // Ignore on unsupported browsers
      }
    }
  }

  public playStrikerShot(powerRatio = 0.6) {
    if (!this.enabled || this.volume <= 0.01) return;
    this.unlock();
    if (!this.ctx || !this.sfxBus) return;

    const pwr = Math.max(0.15, Math.min(1, powerRatio));
    const now = this.ctx.currentTime;
    const master = this.volume;

    // 1. Finger-nail flick tap against acrylic striker rim
    if (this.snapNoiseBuffer) {
      const snap = this.ctx.createBufferSource();
      snap.buffer = this.snapNoiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2150 + pwr * 650;
      bp.Q.value = 1.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime((0.26 + pwr * 0.28) * master, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      snap.connect(bp);
      bp.connect(g);
      this.routeSfx(g, true);
      snap.start(now);
    }

    // 2. Short acrylic flick resonance (fixed modal tone, no laser sweep)
    const modal = this.ctx.createOscillator();
    const mGain = this.ctx.createGain();
    modal.type = 'triangle';
    modal.frequency.setValueAtTime(760 + pwr * 180, now);
    mGain.gain.setValueAtTime((0.12 + pwr * 0.14) * master, now);
    mGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
    modal.connect(mGain);
    this.routeSfx(mGain, true);
    modal.start(now);
    modal.stop(now + 0.025);

    // 3. Boric-powder glide brush across smooth plywood deck
    if (this.brushNoiseBuffer) {
      const brush = this.ctx.createBufferSource();
      brush.buffer = this.brushNoiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1600 + pwr * 900, now);
      bp.frequency.exponentialRampToValueAtTime(620, now + 0.08);
      bp.Q.value = 1.2;
      const bGain = this.ctx.createGain();
      bGain.gain.setValueAtTime(0.001, now);
      bGain.gain.linearRampToValueAtTime((0.1 + pwr * 0.16) * master, now + 0.01);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07 + pwr * 0.045);
      brush.connect(bp);
      bp.connect(bGain);
      this.routeSfx(bGain, false);
      brush.start(now);
    }

    if (pwr > 0.62) {
      this.vibrate(10);
    }
  }

  public playClack(impactSpeed: number, kind: 'coin' | 'striker' | 'wall') {
    if (!this.enabled || this.volume <= 0.01) return;
    if (impactSpeed < 0.85) return;

    const nowMs = performance.now();
    // Prune hits older than 50ms
    while (this.recentHits.length > 0 && nowMs - this.recentHits[0] > 50) {
      this.recentHits.shift();
    }
    // Prevent audio mud during massive 19-coin break clusters
    if (this.recentHits.length >= 6 && impactSpeed < 6) return;
    if (this.recentHits.length >= 9) return;
    this.recentHits.push(nowMs);

    this.unlock();
    if (!this.ctx || !this.sfxBus) return;

    // Natural loudness attenuation during overlapping cascade bursts
    const burstScale = Math.max(0.42, 1 - (this.recentHits.length - 1) * 0.09);
    const strength = Math.min(1, Math.max(0.08, impactSpeed / 19));
    const gainScale = strength * this.volume * burstScale;
    const microOffset = Math.min(0.004, (this.recentHits.length - 1) * 0.0008);
    const t = this.ctx.currentTime + microOffset;
    const jitter = 0.94 + Math.random() * 0.12;

    if (kind === 'wall') {
      // Wooden rail cushion thud: warm low hardwood body + brief edge knock
      const frameLow = this.ctx.createOscillator();
      const gLow = this.ctx.createGain();
      frameLow.type = 'sine';
      frameLow.frequency.setValueAtTime(182 * jitter, t);
      frameLow.frequency.exponentialRampToValueAtTime(118 * jitter, t + 0.032);
      gLow.gain.setValueAtTime(gainScale * 0.42, t);
      gLow.gain.exponentialRampToValueAtTime(0.001, t + 0.042);
      frameLow.connect(gLow);
      this.routeSfx(gLow, true);
      frameLow.start(t);
      frameLow.stop(t + 0.046);

      const railKnock = this.ctx.createOscillator();
      const gKnock = this.ctx.createGain();
      railKnock.type = 'triangle';
      railKnock.frequency.setValueAtTime(425 * jitter, t);
      gKnock.gain.setValueAtTime(gainScale * 0.28, t);
      gKnock.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
      railKnock.connect(gKnock);
      this.routeSfx(gKnock, true);
      railKnock.start(t);
      railKnock.stop(t + 0.026);

      if (this.cupNoiseBuffer) {
        const thud = this.ctx.createBufferSource();
        thud.buffer = this.cupNoiseBuffer;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 580 + strength * 520;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(gainScale * 0.34, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.028);
        thud.connect(lp);
        lp.connect(ng);
        this.routeSfx(ng, true);
        thud.start(t);
      }

      // Heavy wall slam subtly resonates the birch deck
      if (impactSpeed > 9) {
        const deck = this.ctx.createOscillator();
        const dg = this.ctx.createGain();
        deck.type = 'sine';
        deck.frequency.setValueAtTime(98, t);
        dg.gain.setValueAtTime(gainScale * 0.22, t);
        dg.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
        deck.connect(dg);
        this.routeSfx(dg, false);
        deck.start(t);
        deck.stop(t + 0.06);
      }
      return;
    }

    // Coin-on-coin or Striker-on-coin real physical modal clack
    const isStriker = kind === 'striker';

    // 1. Crisp hard surface impact click transient
    if (this.snapNoiseBuffer) {
      const snap = this.ctx.createBufferSource();
      snap.buffer = this.snapNoiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = (isStriker ? 2250 : 2950) * jitter * (0.85 + strength * 0.3);
      bp.Q.value = isStriker ? 1.7 : 2.2;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(gainScale * (isStriker ? 0.62 : 0.52), t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.014);
      snap.connect(bp);
      bp.connect(ng);
      this.routeSfx(ng, true);
      snap.start(t);
    }

    // 2. Primary disc body resonance (fixed modal pitch, crisp decay)
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime((isStriker ? 1160 : 1680) * jitter, t);
    bodyGain.gain.setValueAtTime(gainScale * (isStriker ? 0.36 : 0.3), t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + (isStriker ? 0.024 : 0.018));
    bodyOsc.connect(bodyGain);
    this.routeSfx(bodyGain, true);
    bodyOsc.start(t);
    bodyOsc.stop(t + 0.028);

    // 3. Lower wooden/acrylic chest knock (heavier for striker)
    const lowOsc = this.ctx.createOscillator();
    const lowGain = this.ctx.createGain();
    lowOsc.type = 'sine';
    lowOsc.frequency.setValueAtTime((isStriker ? 495 : 710) * jitter, t);
    lowGain.gain.setValueAtTime(gainScale * (isStriker ? 0.34 : 0.2), t);
    lowGain.gain.exponentialRampToValueAtTime(0.001, t + 0.016);
    lowOsc.connect(lowGain);
    this.routeSfx(lowGain, true);
    lowOsc.start(t);
    lowOsc.stop(t + 0.02);

    // 4. High phenolic overtone crack on medium/hard impacts
    if (strength > 0.25) {
      const hiOsc = this.ctx.createOscillator();
      const hiGain = this.ctx.createGain();
      hiOsc.type = 'sine';
      hiOsc.frequency.setValueAtTime((isStriker ? 2480 : 3320) * jitter, t);
      hiGain.gain.setValueAtTime(gainScale * 0.16 * strength, t);
      hiGain.gain.exponentialRampToValueAtTime(0.001, t + 0.01);
      hiOsc.connect(hiGain);
      this.routeSfx(hiGain, true);
      hiOsc.start(t);
      hiOsc.stop(t + 0.012);
    }

    if (impactSpeed > 11 && isStriker) {
      this.vibrate(14);
    }
  }

  public playPocket(isQueen = false) {
    if (!this.enabled || this.volume <= 0.01) return;
    this.unlock();
    if (!this.ctx || !this.sfxBus) return;

    const now = this.ctx.currentTime;
    const master = this.volume;

    // 1. Pocket wooden rim lip tap as coin tips over the hole edge
    const rim = this.ctx.createOscillator();
    const rimGain = this.ctx.createGain();
    rim.type = 'triangle';
    rim.frequency.setValueAtTime(590 + Math.random() * 50, now);
    rimGain.gain.setValueAtTime(0.18 * master, now);
    rimGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
    rim.connect(rimGain);
    this.routeSfx(rimGain, true);
    rim.start(now);
    rim.stop(now + 0.022);

    // 2. Soft stitched cloth/leather pocket cup catch (~55ms later)
    const dropAt = now + 0.052;
    const cup = this.ctx.createOscillator();
    const cupGain = this.ctx.createGain();
    cup.type = 'sine';
    cup.frequency.setValueAtTime(162, dropAt);
    cup.frequency.exponentialRampToValueAtTime(98, dropAt + 0.065);
    cupGain.gain.setValueAtTime(0.32 * master, dropAt);
    cupGain.gain.exponentialRampToValueAtTime(0.001, dropAt + 0.075);
    cup.connect(cupGain);
    this.routeSfx(cupGain, true);
    cup.start(dropAt);
    cup.stop(dropAt + 0.08);

    if (this.cupNoiseBuffer) {
      const rustle = this.ctx.createBufferSource();
      rustle.buffer = this.cupNoiseBuffer;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.value = 520;
      lp.Q.value = 1.1;
      const rg = this.ctx.createGain();
      rg.gain.setValueAtTime(0.28 * master, dropAt);
      rg.gain.exponentialRampToValueAtTime(0.001, dropAt + 0.065);
      rustle.connect(lp);
      lp.connect(rg);
      this.routeSfx(rg, true);
      rustle.start(dropAt);
    }

    // Refined warm shimmer accent only for the Red Queen
    if (isQueen) {
      [880, 1318.5].forEach((freq, idx) => {
        if (!this.ctx) return;
        const t = dropAt + 0.02 + idx * 0.055;
        const chime = this.ctx.createOscillator();
        const cg = this.ctx.createGain();
        chime.type = 'sine';
        chime.frequency.setValueAtTime(freq, t);
        cg.gain.setValueAtTime(0.11 * master, t);
        cg.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        chime.connect(cg);
        this.routeSfx(cg, true);
        chime.start(t);
        chime.stop(t + 0.26);
      });
    }

    this.vibrate(isQueen ? 26 : 15);
  }

  public playFoul() {
    if (!this.enabled || this.volume <= 0.01) return;
    this.unlock();
    if (!this.ctx || !this.sfxBus) return;

    const now = this.ctx.currentTime;
    const master = this.volume;

    // Deep striker leather pocket thud
    const thud = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(128, now);
    thud.frequency.exponentialRampToValueAtTime(74, now + 0.09);
    tg.gain.setValueAtTime(0.32 * master, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    thud.connect(tg);
    this.routeSfx(tg, true);
    thud.start(now);
    thud.stop(now + 0.11);

    // Warm double muted wood cue (replaces harsh sawtooth)
    [220, 174.61].forEach((freq, idx) => {
      if (!this.ctx) return;
      const t = now + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      lp.type = 'lowpass';
      lp.frequency.value = 540;
      g.gain.setValueAtTime(0.15 * master, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(lp);
      lp.connect(g);
      this.routeSfx(g, true);
      osc.start(t);
      osc.stop(t + 0.12);
    });

    this.vibrate(36);
  }

  public playWin() {
    if (!this.enabled || this.volume <= 0.01) return;
    this.unlock();
    if (!this.ctx || !this.sfxBus) return;

    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.075;
      osc.frequency.setValueAtTime(freq, t);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2400, t);
      lp.frequency.exponentialRampToValueAtTime(900, t + 0.36);
      gain.gain.setValueAtTime(0.18 * this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.connect(lp);
      lp.connect(gain);
      this.routeSfx(gain, true);
      osc.start(t);
      osc.stop(t + 0.4);
    });

    this.vibrate(32);
  }

  public playDefeat() {
    if (!this.enabled || this.volume <= 0.01) return;
    this.unlock();
    if (!this.ctx || !this.sfxBus) return;

    const now = this.ctx.currentTime;
    const notes = [392.0, 349.23, 293.66, 220.0];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.1;
      osc.frequency.setValueAtTime(freq, t);
      lp.type = 'lowpass';
      lp.frequency.value = 1200;
      gain.gain.setValueAtTime(0.15 * this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(lp);
      lp.connect(gain);
      this.routeSfx(gain, true);
      osc.start(t);
      osc.stop(t + 0.34);
    });

    this.vibrate(28);
  }

  public playUiTick() {
    if (!this.enabled || this.volume <= 0.01) return;
    this.unlock();
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.exponentialRampToValueAtTime(740, now + 0.014);
    gain.gain.setValueAtTime(0.065 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.016);
    osc.connect(gain);
    this.routeSfx(gain, false);
    osc.start(now);
    osc.stop(now + 0.02);
  }
}

export const soundEngine = new SoundEngine();
