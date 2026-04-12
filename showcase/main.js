import { PianoWidget } from "../core/PianoWidget.js";
import { SynthEngine } from "../synth/synth.js";
import { app_profiles, midiLabel, NOTE_NAMES } from "../core/global.js";
import { KeyboardController } from "../core/KeyboardController.js";

const colors = app_profiles.showcase.colors;

/* ===========================
   ELEMENTS
=========================== */
const overlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const app = document.getElementById('app');
const rangeLabel = document.getElementById('range-label');
const canvas = document.getElementById('piano');
const container = document.getElementById('container');

const rangeLengthInput = document.getElementById('num-keys');

/* ===========================
   WIDGET
   Custom colours to match the dark synth aesthetic.
   touch-action: none is essential — this is the playable surface.
=========================== */
const piano = new PianoWidget(canvas, container, {
    touchAction: 'none',
    whiteColor: '#f0f0f8',
    blackColor: '#18181f',
    borderColor: '#4a4a5a',
    borderWidth: 1.5,
    // pressColor: '#9d8df7',   // soft accent purple for pressed keys
    pressColor: colors.accent,   // soft accent purple for pressed keys
    markColor: colors.accentBright,
    markRootColor: colors.accentBright,
    markTextColor: '#fff',
    blackHeightRatio: 0.61,
    blackWidthRatio: 0.65,
    minWhiteWidth: 28,
});

// console.log(rangeLengthInput.value);
piano.setRange(48, 48+Number(rangeLengthInput.value)); // C3–C5 default

/* ===========================
   SYNTH ENGINE
=========================== */
const synth = new SynthEngine();

/* ===========================
   RANGE LABEL UTILITY
=========================== */
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



document.getElementById('oct-down').addEventListener('click', () => nudge(-12));
document.getElementById('semi-down').addEventListener('click', () => nudge(-1));
document.getElementById('semi-up').addEventListener('click', () => nudge(1));
document.getElementById('oct-up').addEventListener('click', () => nudge(12));

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


// test tweaking the widget's range
function modifyRangeSize(length) {
    const min = piano.range.min;
    const newMax = piano.range.min + length;

    synth.allOff();
    piano.clearPressedNotes();
    activePointers.clear();
 
    piano.setRange(min, newMax);
    
    updateRangeLabel();
}
rangeLengthInput.addEventListener('input', ()=> {
    const newLength = Number(rangeLengthInput.value);
    modifyRangeSize(newLength);
});


// ---------------------------------------------------------------
// keyboard handling
function playNote(midi) {
    if (piano.allowedNotes && !piano.allowedNotes.has(midi)) return;
    if (piano.pressedNotes.has(midi)) return;
    piano.addPressedNote(midi);
    synth.noteOn(midi);
}

function releaseNote(midi) {
    piano.removePressedNote(midi);
    synth.noteOff(midi);
}

const kb = new KeyboardController({ onNoteOn: playNote, onNoteOff: releaseNote, zOctave: 3, qOctave: 4, });
// ---------------------------------------------------------------

