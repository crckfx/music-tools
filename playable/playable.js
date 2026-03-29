import { PianoWidget } from "../PianoWidget.js";

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const canvas     = document.getElementById('piano');
const container  = document.getElementById('container');
const rangeLabel = document.getElementById('range-label');

const piano = new PianoWidget(canvas, container, {
    touchAction:        'none',
    whiteColor:         '#f0f0f8',
    blackColor:         '#18181f',
    borderColor:        '#4a4a5a',
    borderWidth:        1.5,
    pressColor:         '#6ab0e0',
    markColor:          '#6ab0e0',
    markRootColor:      '#a0d4f0',
    markTextColor:      '#001020',
    whiteHeight:        Math.min(180, Math.floor(window.innerHeight * 0.38)),
});

piano.setRange(48, 72);

/* --- range label --- */
function midiLabel(midi) {
    return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
function updateRangeLabel() {
    rangeLabel.textContent = `${midiLabel(piano.range.min)} – ${midiLabel(piano.range.max)}`;
}
updateRangeLabel();

/* --- nudge --- */
function nudge(delta) {
    piano.shiftRange(delta);
    piano.clearPressedNotes();
    activePointers.clear();
    updateRangeLabel();
}

document.getElementById('oct-down').addEventListener('click',  () => nudge(-12));
document.getElementById('semi-down').addEventListener('click', () => nudge(-1));
document.getElementById('semi-up').addEventListener('click',   () => nudge(1));
document.getElementById('oct-up').addEventListener('click',    () => nudge(12));

/* --- multitouch --- */
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
