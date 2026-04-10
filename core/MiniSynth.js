/* ═══════════════════════════════════════════════════════════
   MINI SYNTH
   Self-contained Web Audio synth. AudioContext is created
   lazily on first noteOn (which is always inside a user
   gesture), satisfying autoplay policy with no extra button.
═══════════════════════════════════════════════════════════ */

export class MiniSynth {
    constructor() {
        this._ctx    = null;
        this._voices = new Map(); // midi → { osc, gain }
    }

    _getCtx() {
        if (!this._ctx) {
            this._ctx = new AudioContext();
        }
        if (this._ctx.state === 'suspended') this._ctx.resume();
        return this._ctx;
    }

    // midi number → frequency in Hz
    static _freq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    noteOn(midi, velocity = 0.7) {
        const ctx = this._getCtx();
        this.noteOff(midi); // kill any retrigger

        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type      = 'triangle';
        osc.frequency.value = MiniSynth._freq(midi);

        // Attack
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(velocity, ctx.currentTime + 0.01);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        this._voices.set(midi, { osc, gain });
    }

    noteOff(midi) {
        const voice = this._voices.get(midi);
        if (!voice) return;
        const { osc, gain } = voice;
        const ctx  = this._ctx;
        const now  = ctx.currentTime;
        // Release
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        osc.stop(now + 0.35);
        this._voices.delete(midi);
    }

    allOff() {
        for (const midi of [...this._voices.keys()]) this.noteOff(midi);
    }
}
