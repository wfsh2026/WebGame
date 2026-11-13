// 合成轻柔环境音，无外部音频资源；仅由用户点击开启。
export class ForestSound {
  private context?: AudioContext;

  async start(): Promise<boolean> {
    try {
      this.stop();
      const context = new AudioContext();
      this.context = context;
      const master = context.createGain();
      master.gain.value = .025;
      master.connect(context.destination);
      const notes = [130.81, 196, 261.63];
      for (const frequency of notes) {
        const tone = context.createOscillator();
        tone.type = 'sine';
        tone.frequency.value = frequency;
        tone.connect(master);
        tone.start();
      }
      await context.resume();
      return context.state === 'running';
    } catch { this.stop(); return false; }
  }

  stop(): void {
    const context = this.context;
    this.context = undefined;
    if (context) { const closing = context.close(); void closing.catch(() => {}); }
  }
}
