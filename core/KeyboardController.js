/* ═══════════════════════════════════════════════════════════
   KeyboardController
   FL Studio-style computer keyboard → MIDI note mapping.

   Layout (e.code, physical keys, layout-agnostic):

   num row  →  black keys, q-octave base
   q row    →  white keys, q-octave base
   a row    →  black keys, z-octave base
   z row    →  white keys, z-octave base

   White key offsets from row base C:
     C=0  D=2  E=4  F=5  G=7  A=9  B=11  C=12  D=14  E=16  F=17  G=19

   Black key offsets from row base C:
     C#=1  D#=3  F#=6  G#=8  A#=10  C#=13  D#=15  F#=18

   (Keys that would fall on E#/B# have no assignment — they simply
   return null. KeyA is not in any map → "a = nothing" as expected.)

   Defaults: z-row = C4 (MIDI 60), q-row = C5 (MIDI 72).
═══════════════════════════════════════════════════════════ */

// Semitone offsets from the row's base C, keyed by e.code.
const Q_WHITE = {
    KeyQ: 0,  KeyW: 2,  KeyE: 4,  KeyR: 5,  KeyT: 7,
    KeyY: 9,  KeyU: 11, KeyI: 12, KeyO: 14, KeyP: 16,
    BracketLeft: 17, BracketRight: 19,
};

const NUM_BLACK = {
    Digit2: 1,  Digit3: 3,
    Digit5: 6,  Digit6: 8,  Digit7: 10,
    Digit9: 13, Digit0: 15, Equal: 18,
};

const Z_WHITE = {
    KeyZ: 0,  KeyX: 2,  KeyC: 4,  KeyV: 5,  KeyB: 7,
    KeyN: 9,  KeyM: 11, Comma: 12, Period: 14, Slash: 16,
};

const A_BLACK = {
    KeyS: 1,  KeyD: 3,
    KeyG: 6,  KeyH: 8,  KeyJ: 10,
    KeyL: 13, Semicolon: 15,
};

// e.codes that should have their default browser action suppressed
// when the controller is active (prevents page scroll, tab focus etc.)
const MAPPED_CODES = new Set([
    ...Object.keys(Q_WHITE),
    ...Object.keys(NUM_BLACK),
    ...Object.keys(Z_WHITE),
    ...Object.keys(A_BLACK),
    'Quote',
]);

export class KeyboardController {

    /**
     * @param {object}   opts
     * @param {function} opts.onNoteOn   (midi: number) => void
     * @param {function} opts.onNoteOff  (midi: number) => void
     * @param {number}  [opts.qOctave=5] Starting octave for q-row (q = C5)
     * @param {number}  [opts.zOctave=4] Starting octave for z-row (z = C4)
     */
    constructor({ onNoteOn, onNoteOff, qOctave = 5, zOctave = 4 } = {}) {
        this.onNoteOn  = onNoteOn  ?? (() => {});
        this.onNoteOff = onNoteOff ?? (() => {});
        this.qOctave   = qOctave;
        this.zOctave   = zOctave;
        this._held     = new Set(); // e.code strings currently pressed

        this._dn = this._keydown.bind(this);
        this._up = this._keyup.bind(this);
        document.addEventListener('keydown', this._dn);
        document.addEventListener('keyup',   this._up);
    }

    setQOctave(n) { this.qOctave = n; }
    setZOctave(n) { this.zOctave = n; }

    /** Shift both rows together (mirrors piano octave nudge buttons). */
    shiftOctave(delta) {
        this.qOctave += delta;
        this.zOctave += delta;
    }

    /** Release all held notes — call on visibility change, settings change etc. */
    allOff() {
        for (const code of this._held) {
            const midi = this._midiForCode(code);
            if (midi !== null) this.onNoteOff(midi);
        }
        this._held.clear();
    }

    destroy() {
        this.allOff();
        document.removeEventListener('keydown', this._dn);
        document.removeEventListener('keyup',   this._up);
    }

    // ─────────────────────────────────────────────────────────
    //  Internal
    // ─────────────────────────────────────────────────────────

    /** Returns the MIDI note number for a physical key code, or null. */
    _midiForCode(code) {
        // (octave + 1) * 12 gives MIDI for C in that octave
        // e.g. octave 4 → 5*12 = 60 = C4
        const qBase = (this.qOctave + 1) * 12;
        const zBase = (this.zOctave + 1) * 12;

        if (code in Q_WHITE)   return qBase + Q_WHITE[code];
        if (code in NUM_BLACK) return qBase + NUM_BLACK[code];
        if (code in Z_WHITE)   return zBase + Z_WHITE[code];
        if (code in A_BLACK)   return zBase + A_BLACK[code];
        return null;
    }

    _shouldIgnore(e) {
        // Never steal from modifier combos (browser shortcuts)
        if (e.metaKey || e.ctrlKey || e.altKey) return true;
        // Never steal from text inputs
        const tag = document.activeElement?.tagName;
        return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    }

    _keydown(e) {
        if (e.repeat)              return;
        if (this._shouldIgnore(e)) return;  // focus in input etc.

        // From here: we *might* consume this key
        const midi = this._midiForCode(e.code);
        if (midi === null)          return;  // not a mapped note key at all

        // Only now do we know we're actually consuming it
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
        }

        if (this._held.has(e.code)) return;
        this._held.add(e.code);
        this.onNoteOn(midi);
    }

    _keyup(e) {
        // No shouldIgnore check on keyup — we always want to release
        // a note that was pressed, even if focus moved to an input.
        if (!this._held.has(e.code)) return;
        this._held.delete(e.code);

        const midi = this._midiForCode(e.code);
        if (midi !== null) this.onNoteOff(midi);
    }
}