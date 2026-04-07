import { PianoWidget } from "../PianoWidget.js";
import { GUITAR_TUNINGS, SCALES } from "../data.js";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

/* ═══════════════════════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════════════════════ */

const rootSelect        = document.getElementById('root');
const scaleSelect       = document.getElementById('scale');
const tuningSelect      = document.getElementById('tuning');
const minFretInput      = document.getElementById('min-fret');
const fretSpanSelect    = document.getElementById('fret-span');
const notesPerStrSelect = document.getElementById('notes-per-string');
const stringOrderSelect = document.getElementById('string-order');
const patternSelect     = document.getElementById('pattern');
const dedupPrefSelect   = document.getElementById('dedup-pref');
const showRootCheck     = document.getElementById('show-root');
const noteSpacingSelect = document.getElementById('note-spacing');
const lineWidthSelect   = document.getElementById('line-width');
const showNamesCheck    = document.getElementById('show-names');
const rangeLabel        = document.getElementById('range-label');
const fretBadge         = document.getElementById('fret-badge');
const tabTitle          = document.getElementById('tab-title');
const tabOutput         = document.getElementById('tab-output');
const copyBtn           = document.getElementById('copy-btn');
const canvas            = document.getElementById('piano');
const container         = document.getElementById('container');

const padBeforeSelect = document.getElementById('pad-before');
const padAfterSelect  = document.getElementById('pad-after');

/* ═══════════════════════════════════════════════════════════
   PIANO WIDGET
═══════════════════════════════════════════════════════════ */

const css = prop => getComputedStyle(document.documentElement).getPropertyValue(prop).trim();

const piano = new PianoWidget(canvas, container, {
    whiteColor:    '#f0f0f8',
    blackColor:    '#18181f',
    borderColor:   '#4a4a5a',
    borderWidth:   2.0,
    pressColor:    css('--accent'),
    markColor:     css('--accent'),
    markRootColor: css('--accent-bright'),
    markTextColor: '#1a1200',
});

/* ═══════════════════════════════════════════════════════════
   POPULATE SELECTS
═══════════════════════════════════════════════════════════ */

for (let i = 0; i < 12; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = NOTE_NAMES[i];
    rootSelect.appendChild(opt);
}

for (const [key, { name }] of Object.entries(SCALES)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = name;
    scaleSelect.appendChild(opt);
}

for (const [key, { name, labels }] of Object.entries(GUITAR_TUNINGS)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${name}  (${labels.join('')})`;
    tuningSelect.appendChild(opt);
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */

function midiLabel(midi) {
    return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/* ═══════════════════════════════════════════════════════════
   TAB GENERATION ENGINE
═══════════════════════════════════════════════════════════ */

/**
 * For each string in the tuning, find all MIDI notes that:
 *   - fall within the fret window [minFret, minFret + fretSpan - 1]
 *   - belong to the scale (checked by pitch class)
 *
 * Returns an array of arrays (one per string, low->high), each element:
 *   { stringIdx, fret, midi }
 */
function mapScaleToStrings(rootPC, intervals, tuningMidi, minFret, fretSpan) {
    const maxFret  = minFret + fretSpan - 1;
    const scalePCs = new Set(intervals.map(i => (rootPC + i) % 12));

    return tuningMidi.map((openMidi, stringIdx) => {
        const found = [];
        for (let fret = minFret; fret <= maxFret; fret++) {
            const midi = openMidi + fret;
            if (midi < 0) continue;
            if (scalePCs.has(((midi % 12) + 12) % 12)) {
                found.push({ stringIdx, fret, midi });
            }
        }
        return found;  // ascending fret order
    });
}

/**
 * Apply the notes-per-string limit, keeping the lowest-fret notes first.
 */
function applyNotesPerString(stringNotes, notesPerStr) {
    if (notesPerStr === 0) return stringNotes;  // 0 = auto, keep all
    return stringNotes.map(notes =>
        notes.length > notesPerStr ? notes.slice(0, notesPerStr) : notes
    );
}

/**
 * When the same MIDI pitch appears on multiple strings within the window,
 * return whichever instance wins under the given preference.
 */
function pickPreferred(a, b, pref) {
    switch (pref) {
        case 'lowest-fret':    return a.fret      <= b.fret      ? a : b;
        case 'highest-fret':   return a.fret      >= b.fret      ? a : b;
        case 'lowest-string':  return a.stringIdx <= b.stringIdx ? a : b;
        case 'highest-string': return a.stringIdx >= b.stringIdx ? a : b;
    }
}

/**
 * Build an ordered sequence of { stringIdx, fret, midi }, deduplicated by
 * MIDI pitch according to dedupPref, then ordered by direction pattern.
 *
 * stringOrder: 'low-first' | 'high-first'
 * pattern:     'asc' | 'desc' | 'both'
 * dedupPref:   'lowest-fret' | 'highest-fret' | 'lowest-string' | 'highest-string'
 */
function buildSequence(stringNotes, stringOrder, pattern, dedupPref) {
    let ordered = [...stringNotes];
    if (stringOrder === 'high-first') ordered = [...ordered].reverse();
    ordered = ordered.filter(s => s.length > 0);

    const ascending = [];
    const seen = new Map(); // midi -> index in ascending

    for (const notes of ordered) {
        for (const note of notes) {
            if (seen.has(note.midi)) {
                const idx = seen.get(note.midi);
                ascending[idx] = pickPreferred(ascending[idx], note, dedupPref);
            } else {
                seen.set(note.midi, ascending.length);
                ascending.push(note);
            }
        }
    }

    if (pattern === 'asc')  return ascending;
    if (pattern === 'desc') return [...ascending].reverse();
    // 'both': ascending then descending, endpoint not repeated
    return [...ascending, ...[...ascending].reverse().slice(1)];
}

/* ═══════════════════════════════════════════════════════════
   ASCII TAB RENDERER
═══════════════════════════════════════════════════════════ */

/**
 * Convert a sequence of { stringIdx, fret, midi } into formatted ASCII tab.
 *
 * Each note becomes one column. Columns wrap into lines at lineWidth.
 *
 * Block layout per line (in order):
 *   1. String rows       — always, high e at top
 *   2. Root marker row   — always; '^' under root notes, blank when no root in block
 *                          rootPC=null suppresses markers (row still present as blank)
 *   3. Note names row    — optional (showNames)
 *   4. One blank line    — always, separates blocks
 *
 * @param {Array}        sequence
 * @param {Object}       tuning      - { labels, midi }
 * @param {number|null}  rootPC      - pitch class to mark with '^', or null to suppress
 * @param {number}       lineWidth   - max note-column chars per line
 * @param {number}       noteSpacing - dash padding after each fret number
 * @param {boolean}      showNames
 */
function renderAsciiTab(sequence, tuning, rootPC, lineWidth, noteSpacing, showNames, padBefore, padAfter) {
    if (sequence.length === 0) {
        return '(no scale notes found in this fret window)\n\n'
             + 'Try: widening the Span or adjusting Start Fret.';
    }

    const n        = tuning.midi.length;
    const labelFor = si => tuning.labels[si].padStart(2);
    const INDENT   = '   ';

    const makeEmptyColumn = () => ({
        cells:    Array.from({ length: n }, () => '-'),
        colWidth: 1,
        midi:     null,
    });

    const noteColumns = sequence.map(note => {
        const fretStr  = String(note.fret);
        const colWidth = fretStr.length + noteSpacing;
        const cells    = Array.from({ length: n }, (_, si) =>
            si === note.stringIdx
                ? fretStr.padEnd(colWidth, '-')
                : '-'.repeat(colWidth)
        );
        return { cells, colWidth, midi: note.midi };
    });

    const columns = [
        ...Array.from({ length: padBefore }, makeEmptyColumn),
        ...noteColumns,
    ];

    const lines = [];
    let current = [], usedWidth = 0;

    for (const col of columns) {
        if (usedWidth + col.colWidth > lineWidth && current.length > 0) {
            lines.push(current);
            current   = [];
            usedWidth = 0;
        }
        current.push(col);
        usedWidth += col.colWidth;
    }
    if (current.length) lines.push(current);

    const lastLine  = lines[lines.length - 1];
    const lastUsed  = lastLine.reduce((sum, c) => sum + c.colWidth, 0);
    const fillCount = padAfter === -1 ? lineWidth - lastUsed : padAfter;
    for (let i = 0; i < fillCount; i++) lastLine.push(makeEmptyColumn());

    const out = [];

    for (const block of lines) {

        for (let si = n - 1; si >= 0; si--) {
            const row = block.map(c => c.cells[si]).join('');
            out.push(`${labelFor(si)}|${row}|`);
        }

        const hasRoot = rootPC !== null &&
                        block.some(c => c.midi !== null && ((c.midi % 12) + 12) % 12 === rootPC);
        if (hasRoot) {
            const markerRow = block.map(c => {
                const isRoot = c.midi !== null && ((c.midi % 12) + 12) % 12 === rootPC;
                return (isRoot ? '^' : ' ').padEnd(c.cells[0].length);
            }).join('');
            out.push(INDENT + markerRow);
        } else {
            out.push('');
        }

        if (showNames) {
            const nameRow = block.map(c => {
                const name = c.midi !== null ? NOTE_NAMES[((c.midi % 12) + 12) % 12] : '';
                return name.padEnd(c.cells[0].length);
            }).join('');
            out.push(INDENT + nameRow);
        }

        out.push('');
    }

    return out.join('\n').trimEnd();
}

/* ═══════════════════════════════════════════════════════════
   MAIN UPDATE
═══════════════════════════════════════════════════════════ */

function update() {
    // ── Read controls ─────────────────────────────────────────
    const rootPC      = parseInt(rootSelect.value);
    const scaleKey    = scaleSelect.value;
    const tuningKey   = tuningSelect.value;
    const minFret     = Math.max(0, Math.min(22, parseInt(minFretInput.value) || 0));
    const fretSpan    = parseInt(fretSpanSelect.value);
    const notesPerStr = parseInt(notesPerStrSelect.value);
    const stringOrder = stringOrderSelect.value;
    const pattern     = patternSelect.value;
    const dedupPref   = dedupPrefSelect.value;
    const showRoot    = showRootCheck.checked;
    const noteSpacing = parseInt(noteSpacingSelect.value);
    const lineWidth   = parseInt(lineWidthSelect.value);
    const showNames   = showNamesCheck.checked;

    const scale  = SCALES[scaleKey];
    const tuning = GUITAR_TUNINGS[tuningKey];

    // Clamp fret input (handles manual out-of-range typing)
    if (parseInt(minFretInput.value) !== minFret) minFretInput.value = minFret;

    // ── Fret badge ────────────────────────────────────────────
    const maxFret = minFret + fretSpan - 1;
    fretBadge.textContent = `fret ${minFret}–${maxFret}`;

    // ── Piano range ───────────────────────────────────────────
    const pianoMin = Math.min(...tuning.midi) + minFret;
    const pianoMax = Math.max(...tuning.midi) + maxFret;
    piano.setRange(pianoMin, pianoMax);
    rangeLabel.textContent = `${midiLabel(pianoMin)} – ${midiLabel(pianoMax)}`;

    // ── Generate sequence ─────────────────────────────────────
    const rawStringNotes = mapScaleToStrings(rootPC, scale.intervals, tuning.midi, minFret, fretSpan);
    const limitedNotes   = applyNotesPerString(rawStringNotes, notesPerStr);
    const sequence       = buildSequence(limitedNotes, stringOrder, pattern, dedupPref);

    // ── Mark piano ────────────────────────────────────────────
    const baseSequence = buildSequence(limitedNotes, stringOrder, 'asc', dedupPref);
    const markedMidis  = new Set(baseSequence.map(n => n.midi));
    const rootMidis    = new Set([...markedMidis].filter(m => ((m % 12) + 12) % 12 === rootPC));
    piano.setMarkedNotes([...markedMidis]);
    piano.setMarkedRootNotes([...rootMidis]);

    // ── Render tab ────────────────────────────────────────────
    // Pass null for rootPC when showRoot is off — renderer treats null as no markers
    const effectiveRootPC = showRoot ? rootPC : null;
    const padBefore   = parseInt(padBeforeSelect.value);
    const padAfter    = padAfterSelect.value === 'fill' ? -1 : parseInt(padAfterSelect.value);
    const tabText     = renderAsciiTab(sequence, tuning, effectiveRootPC, lineWidth, noteSpacing, showNames, padBefore, padAfter);
    tabOutput.textContent = tabText;

    // ── Tab title ─────────────────────────────────────────────
    const rootName = NOTE_NAMES[rootPC];
    const posStr   = minFret === 0 ? 'Open pos.' : `Fret ${minFret}`;
    tabTitle.textContent = `${rootName} ${scale.name}  ·  ${posStr}  ·  ${tuning.name}`;
}

/* ═══════════════════════════════════════════════════════════
   SHIFT HELPERS
═══════════════════════════════════════════════════════════ */

function shiftFret(delta) {
    const current = parseInt(minFretInput.value) || 0;
    minFretInput.value = Math.max(0, current + delta);
    update();
}

/* ═══════════════════════════════════════════════════════════
   EVENT BINDINGS
═══════════════════════════════════════════════════════════ */

[
    rootSelect, scaleSelect, tuningSelect,
    fretSpanSelect, notesPerStrSelect, stringOrderSelect,
    patternSelect, noteSpacingSelect, lineWidthSelect, dedupPrefSelect,
    padBeforeSelect, padAfterSelect,
].forEach(el => el.addEventListener('change', update));

minFretInput.addEventListener('input', update);
showRootCheck.addEventListener('change', update);
showNamesCheck.addEventListener('change', update);

document.getElementById('shift-oct-down').addEventListener('click',  () => shiftFret(-12));
document.getElementById('shift-semi-down').addEventListener('click', () => shiftFret(-1));
document.getElementById('shift-semi-up').addEventListener('click',   () => shiftFret(1));
document.getElementById('shift-oct-up').addEventListener('click',    () => shiftFret(12));

copyBtn.addEventListener('click', () => {
    const text = tabOutput.textContent;
    if (!text || text.startsWith('(')) return;

    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            copyBtn.textContent = 'copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.textContent = 'copy';
                copyBtn.classList.remove('copied');
            }, 2000);
        }).catch(() => selectAllText());
    } else {
        selectAllText();
    }
});

function selectAllText() {
    const range = document.createRange();
    range.selectNodeContents(tabOutput);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
}

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */

update();