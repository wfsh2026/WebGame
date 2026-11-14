export class CombatSound {
  private context?: AudioContext;
  private last = new Map<string, number>();
  private voices = 0;
  enabled = true;

  unlock(): void {
    if (!this.enabled || typeof AudioContext === 'undefined') return;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  }

  play(flavor: string, strength: number, pan: number): void {
    const audio = this.context;
    if (!this.enabled || !audio || audio.state !== 'running' || this.voices >= 8 || document.hidden) return;
    const now = audio.currentTime;
    if (now - (this.last.get(flavor) ?? -1) < .075) return;
    this.last.set(flavor, now); this.voices += 1;
    const pickup = flavor === 'pickup' || flavor === 'level-up' || flavor.startsWith('drop-');
    const perfect = flavor === 'perfect-block';
    const metal = perfect || flavor === 'block' || flavor === 'absorb' || pickup;
    const heavy = flavor === 'hammer' || flavor === 'hurt' || flavor === 'kill';
    const frost = flavor === 'frost'; const fire = flavor === 'fireball';
    const electric = flavor.includes('thunder');
    const duration = perfect ? .32 : flavor === 'level-up' ? .5 : heavy || fire ? .2 : .11;
    const frequency = perfect ? 1560 : flavor === 'level-up' ? 660 : flavor === 'pickup' ? 1180 : metal ? 980 : electric ? 680 : frost ? 1400 : heavy ? 110 : 390;
    const pitch = frequency * (.94 + Math.random() * .12);
    const oscillator = audio.createOscillator(); const gain = audio.createGain(); const stereo = audio.createStereoPanner();
    oscillator.type = metal || electric ? 'triangle' : heavy ? 'sine' : 'sawtooth';
    oscillator.frequency.setValueAtTime(pitch, now);
    oscillator.frequency.exponentialRampToValueAtTime(pitch * (perfect ? 1.35 : pickup ? 1.65 : metal ? .72 : .25), now + duration);
    const volume = .025 * strength;
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    stereo.pan.value = pan;
    oscillator.connect(gain); gain.connect(stereo); stereo.connect(audio.destination);
    const samples = Math.ceil(audio.sampleRate * duration);
    const buffer = audio.createBuffer(1, samples, audio.sampleRate); const data = buffer.getChannelData(0);
    for (let index = 0; index < samples; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / samples);
    const noise = audio.createBufferSource(); const filter = audio.createBiquadFilter();
    noise.buffer = buffer; filter.type = heavy || fire ? 'lowpass' : 'highpass'; filter.frequency.value = heavy ? 550 : frost ? 3500 : 1800;
    noise.connect(filter); filter.connect(gain); if (!pickup) { noise.start(now); noise.stop(now + duration); }
    oscillator.start(now); oscillator.stop(now + duration);
    oscillator.onended = () => { noise.disconnect(); filter.disconnect(); oscillator.disconnect(); gain.disconnect(); stereo.disconnect(); this.voices -= 1; };
  }

  dispose(): void { if (this.context) void this.context.close().catch(() => {}); this.context = undefined; }
}
