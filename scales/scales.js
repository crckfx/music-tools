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
const rangeLabel  = document.getElementById('range-label');
const canvas      = document.getElementById('piano');
const container   = document.getElementById('container');

const piano = new PianoWidget(canvas, container, {
    whiteColor:         '#f0f0f8',
    blackColor:         '#18181f',
    borderColor:        '#4a4a5a',
    borderWidth:        1.5,
    pressColor:         '#4caf8a',
    markColor:          '#4caf8a',
    markRootColor:      '#80d4b0',
    markTextColor:      '#001a0e',
    whiteHeight:        Math.min(180, Math.floor(window.innerHeight * 0.38)),
});

/* --- range label --- */
function midiLabel(midi) {
    return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
function updateRangeLabel() {
    rangeLabel.textContent = `${midiLabel(piano.range.min)} – ${midiLabel(piano.range.max)}`;
}

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

/* --- mark calculation --- */
function applyMarks() {
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

function update() {
    const rootPC = parseInt(rootSelect.value);
    const rangeStart = 60 + rootPC;
    const rangeEnd   = rangeStart + 12 * OCTAVES;
    piano.setRange(rangeStart, rangeEnd);
    piano.clearPressedNotes();
    applyMarks();
    updateRangeLabel();
}

function shiftAndMark(delta) {
    piano.shiftRange(delta);
    applyMarks();
    updateRangeLabel();
}

rootSelect.addEventListener('change', update);
scaleSelect.addEventListener('change', update);
update();

document.getElementById('shift-oct-down').addEventListener('click',  () => shiftAndMark(-12));
document.getElementById('shift-semi-down').addEventListener('click', () => shiftAndMark(-1));
document.getElementById('shift-semi-up').addEventListener('click',   () => shiftAndMark(1));
document.getElementById('shift-oct-up').addEventListener('click',    () => shiftAndMark(12));

/* --- interactivity --- */
const activePointers = new Map();

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
