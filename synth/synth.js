export class SynthEngine {
    constructor() {
        this.ctx    = null;
        this.voices = new Map();
    }

    async init() {
        this.ctx = new AudioContext();
        if (this.ctx.state === 'suspended') await this.ctx.resume();
    }

    get ready() {
        return this.ctx !== null && this.ctx.state === 'running';
    }

    _freq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    _computeGain(voice, now) {
        if (now < voice.attackEnd) {
            // linear 0 → 1 during attack
            return (now - voice.startTime) / (voice.attackEnd - voice.startTime);
        } else if (now < voice.decayEnd) {
            // linear 1 → sustain during decay
            const t = (now - voice.attackEnd) / (voice.decayEnd - voice.attackEnd);
            return 1.0 + t * (voice.sustain - 1.0);
        } else {
            return voice.sustain;
        }
    }

    _kill(voice, releaseSecs) {
        const now         = this.ctx.currentTime;
        const currentGain = this._computeGain(voice, now);

        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(currentGain, now);
        voice.gain.gain.linearRampToValueAtTime(0, now + releaseSecs);
        voice.osc.stop(now + releaseSecs);
    }

    noteOn(midi) {
        if (!this.ready) return;

        const existing = this.voices.get(midi);
        if (existing) {
            this._kill(existing, 0.015);
            this.voices.delete(midi);
        }

        const ctx  = this.ctx;
        const now  = ctx.currentTime;
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.value = this._freq(midi);
        osc.connect(gain);
        gain.connect(ctx.destination);

        const attack  = 0.008;
        const decay   = 0.35;
        const sustain = 0.15;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(1.0, now + attack);
        gain.gain.linearRampToValueAtTime(sustain, now + attack + decay);

        osc.start(now);

        const voice = {
            osc, gain,
            startTime:  now,
            attackEnd:  now + attack,
            decayEnd:   now + attack + decay,
            sustain,
        };

        this.voices.set(midi, voice);
    }

    noteOff(midi) {
        if (!this.ready) return;
        const voice = this.voices.get(midi);
        if (!voice) return;
        this._kill(voice, 0.12);
        this.voices.delete(midi);
    }

    allOff() {
        for (const voice of this.voices.values()) {
            this._kill(voice, 0.04);
        }
        this.voices.clear();
    }
}