import { PianoWidget } from "../PianoWidget.js";

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const SCALES = {
    major:          [0, 2, 4, 5, 7, 9, 11],
    minor:          [0, 2, 3, 5, 7, 8, 10],
    harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
};

const OCTAVES = 2;

const rootSelect  = document.getElementById('root');
const scaleSelect = document.getElementById('scale');
const canvas      = document.getElementById('piano');
const container   = document.getElementById('container');

// No touchAction set here — touch-scroll remains active on the page.
// If the number of displayed keys overflows on portrait mobile, the user
// can reduce OCTAVES or add a narrower range for small viewports themselves.
const piano = new PianoWidget(canvas, container);

/* --- populate selects --- */
for (let i = 0; i < 12; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = NOTE_NAMES[i];
    rootSelect.appendChild(opt);
}
for (const key of Object.keys(SCALES)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key.replace(/_/g, ' ');
    scaleSelect.appendChild(opt);
}

/* --- scale update ---
   Range starts on the actual root note. If root is a black key, the widget
   handles the viewport alignment; no snapping needed here. */
function update() {
    const rootPC    = parseInt(rootSelect.value);
    const intervals = SCALES[scaleSelect.value];

    // Place root in octave 4: C4 = midi 60, so root = 60 + rootPC.
    const rangeStart = 60 + rootPC;
    const rangeEnd   = rangeStart + 12 * OCTAVES;

    piano.setRange(rangeStart, rangeEnd);
    piano.clearPressedNotes();

    const marked = [], roots = [];
    for (let m = rangeStart; m <= rangeEnd; m++) {
        const offset = (m % 12 - rootPC + 12) % 12;
        if (intervals.includes(offset)) {
            marked.push(m);
            if (offset === 0) roots.push(m);
        }
    }

    piano.setMarkedNotes(marked);
    piano.setMarkedRootNotes(roots);
}

rootSelect.addEventListener('change', update);
scaleSelect.addEventListener('change', update);
update();

/* --- shift controls ---
   The widget owns the shifting; the app just sends the signal. */
document.getElementById('shift-oct-down').addEventListener('click',  () => shiftAndMark(-12));
document.getElementById('shift-semi-down').addEventListener('click', () => shiftAndMark(-1));
document.getElementById('shift-semi-up').addEventListener('click',   () => shiftAndMark(1));
document.getElementById('shift-oct-up').addEventListener('click',    () => shiftAndMark(12));

function shiftAndMark(delta) {
    piano.shiftRange(delta);
    // re-run mark calculation against the new range
    const rootPC    = parseInt(rootSelect.value);
    const intervals = SCALES[scaleSelect.value];
    const marked = [], roots = [];
    for (let m = piano.range.min; m <= piano.range.max; m++) {
        const offset = (m % 12 - rootPC + 12) % 12;
        if (intervals.includes(offset)) {
            marked.push(m);
            if (offset === 0) roots.push(m);
        }
    }
    piano.setMarkedNotes(marked);
    piano.setMarkedRootNotes(roots);
}

/* --- interactivity ---
   Keys show as pressed while held. Multi-touch aware via pointerId map.
   Uses the same down/move/up/cancel/leave pattern as playable. */
const activePointers = new Map(); // pointerId → key

piano.onKeyEvent = (key, type, e) => {
    if (type === 'down' && key) {
        activePointers.set(e.pointerId, key);
        piano.addPressedNote(key.midi);
    }

    if (type === 'move') {
        const prev = activePointers.get(e.pointerId);
        if (!prev || !key || key.midi === prev.midi) return;
        piano.removePressedNote(prev.midi);
        piano.addPressedNote(key.midi);
        activePointers.set(e.pointerId, key);
    }

    if (type === 'up' || type === 'cancel' || type === 'leave') {
        const prev = activePointers.get(e.pointerId);
        if (prev) piano.removePressedNote(prev.midi);
        activePointers.delete(e.pointerId);
    }
};
