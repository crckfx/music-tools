import { PianoWidget  } from "../PianoWidget.js";
import { SamplerEngine } from "./sampler.js";

/* ===========================
   ELEMENTS
=========================== */
const overlay    = document.getElementById('start-overlay');
const startBtn   = document.getElementById('start-btn');
const loadStatus = document.getElementById('load-status');
const app        = document.getElementById('app');
const rangeLabel = document.getElementById('range-label');
const canvas     = document.getElementById('piano');
const container  = document.getElementById('container');

/* ===========================
   WIDGET
   Warm amber press colour to match the page accent.
=========================== */
const piano = new PianoWidget(canvas, container, {
    touchAction:        'none',
    whiteColor:         '#f0f0f8',
    blackColor:         '#18181f',
    borderColor:        '#4a4a5a',
    borderWidth:        1.5,
    pressColor:         '#e8a045',
    markColor:          '#e8a045',
    markRootColor:      '#f0c070',
    markTextColor:      '#1a1000',
    whiteHeight:        180,
    blackHeightRatio:   0.61,
    blackWidthRatio:    0.65,
    minWhiteWidth:      28,
});

piano.setRange(48, 72); // C3–C5

/* ===========================
   SAMPLER ENGINE
=========================== */
const sampler = new SamplerEngine();

/* ===========================
   RANGE LABEL
=========================== */
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function midiLabel(midi) {
    return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function updateRangeLabel() {
    rangeLabel.textContent = `${midiLabel(piano.range.min)} – ${midiLabel(piano.range.max)}`;
}

updateRangeLabel();

/* ===========================
   NUDGE
=========================== */
function nudge(delta) {
    piano.shiftRange(delta);
    sampler.allOff();
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
=========================== */
const activePointers = new Map();

piano.onKeyEvent = (key, type, e) => {
    if (type === 'down' && key) {
        activePointers.set(e.pointerId, key);
        piano.addPressedNote(key.midi);
        sampler.noteOn(key.midi);
    }

    if (type === 'move') {
        const prev = activePointers.get(e.pointerId);
        if (!prev) return;
        if (!key || key.midi === prev.midi) return;
        piano.removePressedNote(prev.midi);
        sampler.noteOff(prev.midi);
        piano.addPressedNote(key.midi);
        sampler.noteOn(key.midi);
        activePointers.set(e.pointerId, key);
    }

    if (type === 'up' || type === 'cancel' || type === 'leave') {
        const prev = activePointers.get(e.pointerId);
        if (prev) {
            piano.removePressedNote(prev.midi);
            sampler.noteOff(prev.midi);
        }
        activePointers.delete(e.pointerId);
    }
};

/* ===========================
   PAGE VISIBILITY
=========================== */
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        sampler.allOff();
        piano.clearPressedNotes();
        activePointers.clear();
    }
});

/* ===========================
   START OVERLAY
   Soundfont download happens after user gesture (AudioContext
   requirement). Button is disabled during load.
=========================== */
startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;

    await sampler.init((msg) => {
        loadStatus.textContent = msg;
    });

    overlay.classList.add('fade-out');
    setTimeout(() => { overlay.style.display = 'none'; }, 600);
    app.classList.add('visible');
});
