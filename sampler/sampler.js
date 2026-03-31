/* ===========================
   INSTRUMENTS
   Curated subset of MusyngKite GM soundfont.
   release is in seconds — used as the R in [0, 0, 1, release] ADSR.
   attack and decay are 0 (let the sample handle its own onset/decay).
   sustain is 1 (full level while key is held).
=========================== */
export const INSTRUMENTS = {
    acoustic_grand_piano: { label: 'Grand Piano' },
    electric_piano_1: { label: 'Electric Piano' },
    harpsichord: { label: 'Harpsichord' },
    marimba: { label: 'Marimba' },
    vibraphone: { label: 'Vibraphone' },
    church_organ: { label: 'Church Organ' },
    acoustic_guitar_nylon: { label: 'Nylon Guitar' },
    flute: { label: 'Flute' },
    violin: { label: 'Violin' },
};

const RELEASE = 0.25;
export const DEFAULT_INSTRUMENT = 'acoustic_grand_piano';

/* ===========================
   SAMPLER ENGINE
=========================== */
export class SamplerEngine {
    constructor() {
        this.ctx = null;
        this.instrument = null;
        this.voices = new Map(); // midi → node returned by play()
        this._release = RELEASE;
    }

    get ready() {
        return this.ctx !== null && this.instrument !== null;
    }

    async init(onProgress) {
        if (this.ctx) {
            await this.ctx.close();
            this.ctx = null;
            this.instrument = null;
        }
        this.ctx = new AudioContext();
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        await this._load(DEFAULT_INSTRUMENT, onProgress);
    }

    async loadInstrument(name, onProgress) {
        if (!this.ctx) return;
        // Kill all voices before swapping instrument
        this.allOff();
        await this._load(name, onProgress);
    }

    async _load(name, onProgress) {
        const meta = INSTRUMENTS[name];
        if (!meta) return;

        onProgress?.(`loading ${meta.label}…`);

        this.instrument = await window.Soundfont.instrument(
            this.ctx,
            name,
            {
                soundfont: 'MusyngKite',
                gain: 8.0,
                destination: this.master, // hook instrument up to master
            },

        );

        if (meta.release) this._release = meta.release;
        onProgress?.('');
    }

    noteOn(midi, velocity = 100) {
        if (!this.ready) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        this._stopVoice(midi);

        const node = this.instrument.play(
            midi,
            this.ctx.currentTime,
            {
                // no note-specific gain because velocity is not implemented - use instrument gain instead
                // gain: velocity / 127,
                adsr: [0.0, 0.0, 1.0, this._release],
            }
        );

        this.voices.set(midi, node);
    }

    noteOff(midi) {
        if (!this.ready) return;
        const node = this.voices.get(midi);
        if (!node) return;
        // Triggers ADSR release phase starting now.
        // The node fades over this._release seconds then stops itself.
        node.stop(this.ctx.currentTime);
        this.voices.delete(midi);
    }

    _stopVoice(midi) {
        const node = this.voices.get(midi);
        if (!node) return;
        node.stop(this.ctx.currentTime);
        this.voices.delete(midi);
    }

    allOff() {
        for (const node of this.voices.values()) {
            node.stop(this.ctx.currentTime);
        }
        this.voices.clear();
    }
}
