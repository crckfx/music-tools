import { PianoWidget } from "../PianoWidget.js";
import { SynthEngine  } from "./synth.js";

/* ===========================
   ELEMENTS
=========================== */
const overlay    = document.getElementById('start-overlay');
const startBtn   = document.getElementById('start-btn');
const app        = document.getElementById('app');
const rangeLabel = document.getElementById('range-label');
const canvas     = document.getElementById('piano');
const container  = document.getElementById('container');

/* ===========================
   WIDGET
   Custom colours to match the dark synth aesthetic.
   touch-action: none is essential — this is the playable surface.
=========================== */
const piano = new PianoWidget(canvas, container, {
    touchAction:        'none',
    whiteColor:         '#f0f0f8',
    blackColor:         '#18181f',
    borderColor:        '#4a4a5a',
    borderWidth:        1.5,
    pressColor:         '#9d8df7',   // soft accent purple for pressed keys
    markColor:          '#7c6af7',
    markRootColor:      '#a78bfa',
    markTextColor:      '#fff',
    whiteHeight:        180,
    blackHeightRatio:   0.61,
    blackWidthRatio:    0.65,
    minWhiteWidth:      28,
});

piano.setRange(48, 72); // C3–C5 default

/* ===========================
   SYNTH ENGINE
=========================== */
const synth = new SynthEngine();

/* ===========================
   RANGE LABEL UTILITY
=========================== */
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function midiLabel(midi) {
    const name   = NOTE_NAMES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${name}${octave}`;
}

function updateRangeLabel() {
    rangeLabel.textContent = `${midiLabel(piano.range.min)} – ${midiLabel(piano.range.max)}`;
}

updateRangeLabel();

/* ===========================
   NUDGE CONTROLS
=========================== */
function nudge(delta) {
    piano.shiftRange(delta);
    // Kill any hanging voices — fingers may still be down
    // but the notes they referenced are now stale.
    synth.allOff();
    piano.clearPressedNotes();
    activePointers.clear();
    updateRangeLabel();
}

document.getElementById('oct-down').addEventListener('click',  () => nudge(-12));
document.getElementById('semi-down').addEventListener('click', () => nudge(-1));
document.getElementById('semi-up').addEventListener('click',   () => nudge(1));
document.getElementById('oct-up').addEventListener('click',    () => nudge(12));

/* ===========================
   POINTER HANDLER
   Map-based multitouch: each pointerId tracks its current key
   independently. noteOn/noteOff fired per pointer.
=========================== */
const activePointers = new Map(); // pointerId → key

piano.onKeyEvent = (key, type, e) => {
    if (type === 'down' && key) {
        activePointers.set(e.pointerId, key);
        piano.addPressedNote(key.midi);
        synth.noteOn(key.midi);
    }

    if (type === 'move') {
        const prev = activePointers.get(e.pointerId);
        if (!prev) return;                         // pointer wasn't down
        if (!key || key.midi === prev.midi) return; // off-canvas or same key

        piano.removePressedNote(prev.midi);
        synth.noteOff(prev.midi);
        piano.addPressedNote(key.midi);
        synth.noteOn(key.midi);
        activePointers.set(e.pointerId, key);
    }

    if (type === 'up' || type === 'cancel' || type === 'leave') {
        const prev = activePointers.get(e.pointerId);
        if (prev) {
            piano.removePressedNote(prev.midi);
            synth.noteOff(prev.midi);
        }
        activePointers.delete(e.pointerId);
    }
};

/* ===========================
   PAGE VISIBILITY
   Kill all voices when tab is hidden to avoid stuck notes.
=========================== */
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        synth.allOff();
        piano.clearPressedNotes();
        activePointers.clear();
    }
});

/* ===========================
   START OVERLAY
   AudioContext must be created inside a user gesture.
   We gate the whole app behind the start button for this.
=========================== */
startBtn.addEventListener('click', async () => {
    await synth.init();

    // Fade overlay out
    overlay.classList.add('fade-out');
    setTimeout(() => { overlay.style.display = 'none'; }, 600);

    // Reveal app
    app.classList.add('visible');
});
