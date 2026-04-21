import { Numbin } from "./Numbin.js";
import { midiLabel } from "../../core/global.js";

export class MidiNumbin extends Numbin {
    constructor(el, options = {}) {
        super(el, {
            min: 0,
            max: 127,
            step: 1,
            typeable: false,
            ...options,
        });

        // Base class sets type="number" for non-typeable, but we display
        // strings like "C4" so we need type="text".
        this.input.type = 'text';

        // Seed _midi from the integer the base class read from dataset.value.
        const n = parseInt(this.input.value, 10);
        this._midi = Number.isFinite(n) ? Math.max(this.min, Math.min(this.max, n)) : this.min;
        this.lastValid = this._midi;

        // Replace the raw integer display with the note label.
        this.input.value = midiLabel(this._midi);
    }

    get value() {
        return this._midi;
    }

    set value(v) {
        if (!Number.isFinite(v)) return;

        const n = Math.max(this.min, Math.min(this.max, v));
        if (n === this._midi) return;

        this._midi = n;
        this.lastValid = n;
        this.input.value = midiLabel(n);

        // _trusted flag tells the base class input validator to let this through.
        const e = new Event("input", { bubbles: true });
        e._trusted = true;
        this.input.dispatchEvent(e);
    }
}