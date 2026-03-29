export class SamplerEngine {
    constructor() {
        this.ctx        = null;
        this.master     = null;
        this.instrument = null;
        this.voices     = new Map();
    }

    get ready() {
        return this.ctx !== null && this.instrument !== null;
    }

    async init(onProgress) {
        this.ctx = new AudioContext();
        if (this.ctx.state === 'suspended') await this.ctx.resume();

        // Same master chain as synth so both pages hit the same output level.
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.85;

        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value      = 8;
        comp.ratio.value     = 5;
        comp.attack.value    = 0.003;
        comp.release.value   = 0.18;

        this.master.connect(comp);
        comp.connect(this.ctx.destination);

        onProgress('loading soundfont…');

        this.instrument = await window.Soundfont.instrument(
            this.ctx,
            'acoustic_grand_piano',
            {
                soundfont: 'MusyngKite',
                gain:      4.5,          // raised to match synth perceived loudness
                destination: this.master, // route samples through master chain too
            }
        );

        onProgress('');
    }

    noteOn(midi) {
        if (!this.ready) return;
        this._stopVoice(midi, 0.02);
        const node = this.instrument.play(midi, this.ctx.currentTime, { gain: 1 });
        this.voices.set(midi, node);
    }

    noteOff(midi) {
        if (!this.ready) return;
        this._stopVoice(midi, 0.25);
    }

    _stopVoice(midi, fadeTime) {
        const node = this.voices.get(midi);
        if (!node) return;
        node.stop(this.ctx.currentTime + fadeTime);
        this.voices.delete(midi);
    }

    allOff() {
        for (const midi of [...this.voices.keys()]) {
            this._stopVoice(midi, 0.05);
        }
    }
}
