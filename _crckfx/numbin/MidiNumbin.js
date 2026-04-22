import { Numbin } from "./Numbin.js";
import { midiLabel } from "../../core/global.js";

// NOTE_NAMES in chromatic order, matching standard convention.
const NOTE_MAP = { c:0, d:2, e:4, f:5, g:7, a:9, b:11 };

/**
 * Parse a typed string to a MIDI number, or return null if unparseable.
 * Accepts:
 *   - Raw integers: "60" → 60
 *   - Note names:   "C4", "A#3", "Bb2", "f#5" → MIDI number
 * Does NOT handle negative octaves (C-1 etc) — too edge-case for typing.
 */
export function parseMidiInput(str) {
    const s = str.trim();
    if (!s) return null;

    // Pure integer
    if (/^-?\d+$/.test(s)) {
        const n = parseInt(s, 10);
        return Number.isFinite(n) ? n : null;
    }

    // Note name: letter, optional accidental, octave number
    const m = s.match(/^([a-gA-G])([#b]?)(\d+)$/);
    if (!m) return null;

    const pc  = NOTE_MAP[m[1].toLowerCase()];
    const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    const oct = parseInt(m[3], 10);

    return (oct + 1) * 12 + pc + acc;
}

export class MidiNumbin extends Numbin {
    constructor(el, options = {}) {
        super(el, {
            min: 0,
            max: 127,
            step: 1,
            typeable: true,
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

        // Override base class blur — it does parseInt which fails on "C4" etc.
        // Our _commit handles parsing and revert instead.
        this.input.addEventListener('blur', () => this._commit());
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

    // Allow digits, letters a-g/A-G, #, b — block everything else.
    handleBeforeInput(e) {
        if (e.isComposing) return;
        const t = e.inputType;
        if (t.startsWith('delete')) return;
        if (!t.startsWith('insert')) return;
        const data = e.data ?? '';
        if (!/^[0-9a-gA-G#b]$/.test(data)) {
            e.preventDefault();
        }
    }

    // On Enter or blur: parse whatever's typed, apply if valid, revert if not.
    _commit() {
        const parsed = parseMidiInput(this.input.value);
        if (parsed !== null && parsed >= this.min && parsed <= this.max) {
            this.value = parsed;
        } else {
            // Revert to last valid display.
            this.input.value = midiLabel(this.lastValid);
        }
    }

    handleEnterKey(e) {
        this._commit();
        this.input.blur();
    }
}