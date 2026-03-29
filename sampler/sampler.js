/* ===========================
   SAMPLER ENGINE
   Wraps soundfont-player (window.Soundfont).
   Each noteOn triggers a sample node; noteOff releases it.
   Piano samples naturally decay so release is a soft fade,
   not a hard cut.
=========================== */
export class SamplerEngine {
    constructor() {
        this.ctx        = null;
        this.instrument = null;
        this.voices     = new Map(); // midi → AudioNode returned by .play()
    }

    get ready() {
        return this.ctx !== null && this.instrument !== null;
    }

    /* Call on user gesture. onProgress(message) receives loading updates. */
    async init(onProgress) {
        this.ctx = new AudioContext();
        if (this.ctx.state === 'suspended') await this.ctx.resume();

        onProgress('loading soundfont…');

        this.instrument = await window.Soundfont.instrument(
            this.ctx,
            'acoustic_grand_piano',
            {
                soundfont: 'MusyngKite',  // higher quality than FluidR3_GM
                gain: 2.0,
            }
        );

        onProgress('');
    }

    noteOn(midi) {
        if (!this.ready) return;

        // Retrigger: stop previous voice on this key cleanly
        this._stopVoice(midi, 0.02);

        const node = this.instrument.play(midi, this.ctx.currentTime, { gain: 1 });
        this.voices.set(midi, node);
    }

    noteOff(midi) {
        if (!this.ready) return;
        // For piano, a short fade rather than immediate cut feels right.
        // The sample continues to naturally decay once it reaches silence.
        this._stopVoice(midi, 0.25);
    }

    _stopVoice(midi, fadeTime) {
        const node = this.voices.get(midi);
        if (!node) return;
        // soundfont-player nodes expose .stop(when) which schedules
        // an internal gain fade before stopping the buffer source.
        node.stop(this.ctx.currentTime + fadeTime);
        this.voices.delete(midi);
    }

    allOff() {
        for (const midi of [...this.voices.keys()]) {
            this._stopVoice(midi, 0.05);
        }
    }
}
