import { PianoWidget } from "../PianoWidget.js";

const canvas    = document.getElementById('piano');
const container = document.getElementById('container');

// touchAction: 'none' blocks all browser touch handling on the canvas,
// giving us full control over pointer events. This kills touch-scroll on
// the canvas itself — acceptable here since the piano is the whole interface.
const piano = new PianoWidget(canvas, container, { touchAction: 'none' });
piano.setRange(48, 72); // C3–C5

/* --- multitouch state ---
   Each active pointer (finger or mouse button) is tracked independently.
   pointerId → key object from the last resolved position for that pointer. */
const activePointers = new Map();

piano.onKeyEvent = (key, type, e) => {
    if (type === 'down' && key) {
        activePointers.set(e.pointerId, key);
        piano.addPressedNote(key.midi);
    }

    if (type === 'move') {
        const prev = activePointers.get(e.pointerId);
        // No prev means this pointer isn't down; ignore hover moves.
        // Null key means pointer moved off all keys (captured but off-canvas).
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
