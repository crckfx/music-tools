import { hexToGlow, shiftLightness } from "./colour.js";

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiLabel(midi) {
    const name = NOTE_NAMES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${name}${octave}`;
}

export function makeKeyboardHandlers(piano, engine) {
    // conditional for now, figure out something more clever later
    if (engine) {
        return {
            onNoteOn(midi) {
                if (piano.allowedNotes && !piano.allowedNotes.has(midi)) return;
                if (piano.pressedNotes.has(midi)) return;
                piano.addPressedNote(midi);
                engine.noteOn(midi);
            },
            onNoteOff(midi) {
                piano.removePressedNote(midi);
                engine.noteOff(midi);
            }
        };
    } else {
        return {
            onNoteOn(midi) {
                if (piano.allowedNotes && !piano.allowedNotes.has(midi)) return;
                if (piano.pressedNotes.has(midi)) return;
                piano.addPressedNote(midi);
            },
            onNoteOff(midi) {
                piano.removePressedNote(midi);
            }
        };
    }
}

// ─── profile derivation constants ───────────────────────────────────────────
//
//  dim:    averaged from 4 hand-authored pairs (−22.3, −18.5, −24.0, −27.3)
//          → −23 mean; using −22 to stay on the less-punishing end.
//  bright: one data point (tabs: +12.3); used as-is.
//  glow:   every authored entry is accent at 0x2e/255 ≈ 18% opacity.
//
const DIM_L = -22;
const BRIGHT_L = +12;

// ─── profiles ────────────────────────────────────────────────────────────────

export const app_profiles = {
    chords: {
        colors: { accent: '#e05c7a' },
    },
    playable: {
        colors: { accent: '#6ab0e0' },
    },
    sampler: {
        colors: { accent: '#e8a045' },
    },
    scales: {
        colors: { accent: '#4caf8a' },
    },
    showcase: {
        colors: { accent: '#bb1e8c' },
        title: "PianoWidget",
    },
    synth: {
        colors: { accent: '#7c6af7' },
    },
    tabs: {
        colors: { accent: '#c9a227' },
    },
};

// ─── apply ───────────────────────────────────────────────────────────────────

export function applyProfile(name) {
    const profile = app_profiles[name];
    if (!profile?.colors) return;

    const c = profile.colors;
    const accent = c.accent;
    const root = document.documentElement;

    c.accentBright = c.accentBright ?? shiftLightness(accent, BRIGHT_L);
    c.accentDim = c.accentDim ?? shiftLightness(accent, DIM_L);
    c.accentGlow = c.accentGlow ?? hexToGlow(accent);

    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-bright', c.accentBright);
    root.style.setProperty('--accent-dim', c.accentDim);
    root.style.setProperty('--accent-glow', c.accentGlow);
}

export function applyProfileToElement(el, name) {
    const profile = app_profiles[name];
    if (!profile?.colors) return;

    const c = profile.colors;
    const accent = c.accent;

    c.accentBright = c.accentBright ?? shiftLightness(accent, BRIGHT_L);
    c.accentDim = c.accentDim ?? shiftLightness(accent, DIM_L);
    c.accentGlow = c.accentGlow ?? hexToGlow(accent);

    el.style.setProperty('--accent', accent);
    el.style.setProperty('--accent-bright', c.accentBright);
    el.style.setProperty('--accent-dim', c.accentDim);
    el.style.setProperty('--accent-glow', c.accentGlow);

    console.log(c.accentBright);
}