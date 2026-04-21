import { PianoWidget } from "../core/PianoWidget.js";
import { SynthEngine } from "../synth/synth.js";
import { app_profiles, makeKeyboardHandlers, midiLabel, NOTE_NAMES } from "../core/global.js";
import { KeyboardController } from "../core/KeyboardController.js";
import { MidiNumbin } from "../_crckfx/numbin/MidiNumbin.js";

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
const rangeStartInput = document.getElementById('keys-range-start');

const dumbRow = document.querySelector('.dumb-row');
const dumbRowLeft = dumbRow.querySelector('.left');
const dumbRowRight = dumbRow.querySelector('.right');

const nb_keysRangeStart = document.getElementById('nb-keys-range-start');
const krsNumbin = new MidiNumbin(nb_keysRangeStart, {min: 0, max: 127});

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
    rangeMin: 48,
    rangeMax: 48 + Number(rangeLengthInput.value),

});

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

function syncControls() {
    rangeLengthInput.value = piano.range.max - piano.range.min;
    krsNumbin.value = piano.range.min;
    updateRangeLabel();
    updateDumbRow();
}

/* ===========================
   NUDGE CONTROLS
=========================== */
const nudgeBtns = {
    octDown: document.getElementById('oct-down'),
    semiDown: document.getElementById('semi-down'),
    semiUp: document.getElementById('semi-up'),
    octUp: document.getElementById('oct-up'),
};

function updateNudgeButtons() {
    nudgeBtns.octDown.disabled = piano.range.min - 12 < 0;
    nudgeBtns.semiDown.disabled = piano.range.min - 1 < 0;
    nudgeBtns.semiUp.disabled = piano.range.max + 1 > 127;
    nudgeBtns.octUp.disabled = piano.range.max + 12 > 127;
}

function nudge(delta) {
    piano.shiftRange(delta);
    // synth.allOff();
    // piano.clearPressedNotes();
    // activePointers.clear();
    syncControls();
    updateNudgeButtons();
}

nudgeBtns.octDown.addEventListener('click', () => nudge(-12));
nudgeBtns.semiDown.addEventListener('click', () => nudge(-1));
nudgeBtns.semiUp.addEventListener('click', () => nudge(1));
nudgeBtns.octUp.addEventListener('click', () => nudge(12));

syncControls();
updateNudgeButtons();

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
    const newMax = min + length;
    // synth.allOff();
    // piano.clearPressedNotes();
    // activePointers.clear();
    piano.setRange(min, newMax);
    syncControls();
    updateNudgeButtons();
}
rangeLengthInput.addEventListener('input', () => {
    modifyRangeSize(Number(rangeLengthInput.value));
});

rangeStartInput.addEventListener('input', () => {
    const newMin = krsNumbin.value;
    if (newMin === null) return;
    const length = piano.range.max - piano.range.min;
    const clampedMin = Math.min(newMin, 127 - length);
    // synth.allOff();
    // piano.clearPressedNotes();
    // activePointers.clear();
    piano.setRange(clampedMin, clampedMin + length);
    syncControls();
    updateNudgeButtons();
});

const kbOctaveSelect = document.getElementById('kb-octave');
kbOctaveSelect.addEventListener('change', () => {
    const z = Number(kbOctaveSelect.value);
    kb.allOff();
    // piano.clearPressedNotes();
    // synth.allOff();
    activePointers.clear();
    kb.setZOctave(z);
    kb.setQOctave(z + 1);
});

// ---------------------------------------------------------------
// keyboard handling
const kb = new KeyboardController({
    ...makeKeyboardHandlers(piano, synth),
    zOctave: 3, qOctave: 4,
});
// ---------------------------------------------------------------

function updateDumbRow() {
    dumbRowLeft.textContent = midiLabel(piano.range.min);
    dumbRowRight.textContent = midiLabel(piano.range.max);
}