import { PianoWidget } from "../PianoWidget.js";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const SCALES = {
    major:              { name: 'Major',              intervals: [0,2,4,5,7,9,11] },
    natural_minor:      { name: 'Natural Minor',      intervals: [0,2,3,5,7,8,10] },
    harmonic_minor:     { name: 'Harmonic Minor',     intervals: [0,2,3,5,7,8,11] },
    melodic_minor:      { name: 'Melodic Minor',      intervals: [0,2,3,5,7,9,11] },
    pentatonic_major:   { name: 'Pentatonic Major',   intervals: [0,2,4,7,9] },
    pentatonic_minor:   { name: 'Pentatonic Minor',   intervals: [0,3,5,7,10] },
    blues:              { name: 'Blues',              intervals: [0,3,5,6,7,10] },
    dorian:             { name: 'Dorian',             intervals: [0,2,3,5,7,9,10] },
    phrygian:           { name: 'Phrygian',           intervals: [0,1,3,5,7,8,10] },
    lydian:             { name: 'Lydian',             intervals: [0,2,4,6,7,9,11] },
    mixolydian:         { name: 'Mixolydian',         intervals: [0,2,4,5,7,9,10] },
    locrian:            { name: 'Locrian',            intervals: [0,1,3,5,6,8,10] },
    whole_tone:         { name: 'Whole Tone',         intervals: [0,2,4,6,8,10] },
    diminished:         { name: 'Diminished (HW)',    intervals: [0,1,3,4,6,7,9,10] },
};

// Tunings: midi array ordered low string → high string (index 0 = thickest)
const TUNINGS = {
    standard:    { name: 'Standard',    labels: ['E','A','D','G','B','e'], midi: [40,45,50,55,59,64] },
    drop_d:      { name: 'Drop D',      labels: ['D','A','D','G','B','e'], midi: [38,45,50,55,59,64] },
    open_g:      { name: 'Open G',      labels: ['D','G','D','G','B','d'], midi: [38,43,50,55,59,62] },
    open_e:      { name: 'Open E',      labels: ['E','B','E','G#','B','e'],midi: [40,47,52,56,61,64] },
    dadgad:      { name: 'DADGAD',      labels: ['D','A','D','G','A','d'], midi: [38,45,50,55,57,62] },
    eb_standard: { name: 'Eb Standard', labels: ['Eb','Ab','Db','Gb','Bb','eb'], midi: [39,44,49,54,58,63] },
};

/* ═══════════════════════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════════════════════ */

const rootSelect         = document.getElementById('root');
const scaleSelect        = document.getElementById('scale');
const tuningSelect       = document.getElementById('tuning');
const minFretInput       = document.getElementById('min-fret');
const fretSpanSelect     = document.getElementById('fret-span');
const notesPerStrSelect  = document.getElementById('notes-per-string');
const stringOrderSelect  = document.getElementById('string-order');
const patternSelect      = document.getElementById('pattern');
const skipEmptyCheck     = document.getElementById('skip-empty');
const noteSpacingSelect  = document.getElementById('note-spacing');
const lineWidthSelect    = document.getElementById('line-width');
const showNamesCheck     = document.getElementById('show-names');
const rangeLabel         = document.getElementById('range-label');
const fretBadge          = document.getElementById('fret-badge');
const tabTitle           = document.getElementById('tab-title');
const tabOutput          = document.getElementById('tab-output');
const copyBtn            = document.getElementById('copy-btn');
const canvas             = document.getElementById('piano');
const container          = document.getElementById('container');

/* ═══════════════════════════════════════════════════════════
   PIANO WIDGET
═══════════════════════════════════════════════════════════ */

const piano = new PianoWidget(canvas, container, {
    whiteColor:    '#f0f0f8',
    blackColor:    '#18181f',
    borderColor:   '#4a4a5a',
    borderWidth:   1.5,
    pressColor:    '#c9a227',
    markColor:     '#c9a227',
    markRootColor: '#f0c84a',
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

for (const [key, { name, labels }] of Object.entries(TUNINGS)) {
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
 * Returns an array of arrays (one per string, low→high), each element:
 *   { stringIdx, fret, midi }
 */
function mapScaleToStrings(rootPC, intervals, tuningMidi, minFret, fretSpan) {
    const maxFret    = minFret + fretSpan - 1;
    const scalePCs   = new Set(intervals.map(i => (rootPC + i) % 12));
    const numStrings = tuningMidi.length;

    return tuningMidi.map((openMidi, stringIdx) => {
        const found = [];
        for (let fret = minFret; fret <= maxFret; fret++) {
            const midi = openMidi + fret;
            if (midi < 0) continue;
            if (scalePCs.has(((midi % 12) + 12) % 12)) {
                found.push({ stringIdx, fret, midi });
            }
        }
        return found;  // already in ascending fret order
    });
}

/**
 * Apply the notes-per-string limit.
 * When a string has more notes than the limit, we keep the ones that
 * sit closest to the start of the fret window (lowest frets first).
 */
function applyNotesPerString(stringNotes, notesPerStr) {
    if (notesPerStr === 0) return stringNotes;  // auto = keep all
    return stringNotes.map(notes =>
        notes.length > notesPerStr ? notes.slice(0, notesPerStr) : notes
    );
}

/**
 * Build an ordered sequence of { stringIdx, fret, midi } based on
 * the mapping rules, then apply the direction pattern.
 *
 * stringOrder: 'low-first' (low E → high e) | 'high-first' (high e → low E)
 * pattern:     'asc' | 'desc' | 'both'
 * skipEmpty:   drop strings with no scale notes in window
 */
function buildSequence(stringNotes, stringOrder, pattern, skipEmpty) {
    let ordered = [...stringNotes];  // copy, indexed 0=low … n-1=high
    if (stringOrder === 'high-first') ordered = [...ordered].reverse();

    if (skipEmpty) ordered = ordered.filter(s => s.length > 0);

    const ascending = [];
    for (const notes of ordered) ascending.push(...notes);

    if (pattern === 'asc')  return ascending;
    if (pattern === 'desc') return [...ascending].reverse();
    // 'both': up then down, omitting repeated endpoint
    return [...ascending, ...[...ascending].reverse().slice(1)];
}

/* ═══════════════════════════════════════════════════════════
   ASCII TAB RENDERER
═══════════════════════════════════════════════════════════ */

/**
 * Convert a sequence of { stringIdx, fret, midi } into formatted ASCII tab.
 *
 * Each note event becomes one column. Columns are split into lines that
 * fit within lineWidth characters (not counting the 2-char string label).
 *
 * @param {Array}   sequence
 * @param {Object}  tuning      - { labels, midi }
 * @param {number}  lineWidth   - max chars per tab line (label + bar not included)
 * @param {number}  noteSpacing - extra dash padding after each fret number
 * @param {boolean} showNames   - emit a note-name row above each line block
 */

function renderAsciiTab(sequence, tuning, rootPC, lineWidth, noteSpacing, showNames) {
    if (sequence.length === 0) {
        return '(no scale notes found in this fret window)\n\n'
             + 'Try: widening the Span, adjusting Start Fret,\n'
             + 'or disabling "Skip empty strings".';
    }

    const n    = tuning.midi.length;
    // labelFor: stringIdx 0 (low) → last display label, n-1 (high) → first label
    // Display order is high-e at top, so high stringIdx is drawn first.
    const labelFor = si => tuning.labels[si].padStart(2);

    // ── Build column objects ──────────────────────────────────
    const columns = sequence.map(note => {
        const fretStr  = String(note.fret);
        const colWidth = fretStr.length + noteSpacing;
        // Each string in the column: fret number (padded) or dashes
        const cells = Array.from({ length: n }, (_, si) =>
            si === note.stringIdx
                ? fretStr.padEnd(colWidth, '-')
                : '-'.repeat(colWidth)
        );
        return { cells, colWidth, midi: note.midi };
    });

    // ── Wrap columns into lines ───────────────────────────────
    const lines   = [];
    let current   = [];
    let usedWidth = 0;

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

    // ── Render each line block ────────────────────────────────
    const out = [];

    for (const block of lines) {
        
        // String rows: highest stringIdx first (high e at top)
        for (let si = n - 1; si >= 0; si--) {
            const label = labelFor(si);
            const row   = block.map(c => c.cells[si]).join('');
            out.push(`${label}|${row}|`);
        }

        // Root marker row — occupies the natural gap below the strings.
        // Only emitted if this block contains at least one root note,
        // so it collapses back to a plain empty line otherwise.
        const hasRoot = block.some(c => ((c.midi % 12) + 12) % 12 === rootPC);
        if (hasRoot) {
            const markerRow = block.map(c => {
                const isRoot = ((c.midi % 12) + 12) % 12 === rootPC;
                return (isRoot ? '^' : ' ').padEnd(c.cells[0].length);
            }).join('');
            out.push('   ' + markerRow);
        } else {
            out.push('');
        }
        
        // Optional note-name header row
        if (showNames) {
            const indent  = '   ';  // align with label width
            const nameRow = block.map(c => {
                const name = NOTE_NAMES[c.midi % 12];
                return name.padEnd(c.cells[0].length);
            }).join('');
            out.push(indent + nameRow);
        }
        
        out.push('');
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
    const skipEmpty   = skipEmptyCheck.checked;
    const noteSpacing = parseInt(noteSpacingSelect.value);
    const lineWidth   = parseInt(lineWidthSelect.value);
    const showNames   = showNamesCheck.checked;

    const scale  = SCALES[scaleKey];
    const tuning = TUNINGS[tuningKey];

    // Keep input clamped (handles manual typing out of range)
    if (parseInt(minFretInput.value) !== minFret) minFretInput.value = minFret;

    // ── Fret badge ────────────────────────────────────────────
    const maxFret = minFret + fretSpan - 1;
    fretBadge.textContent = `fret ${minFret}–${maxFret}`;

    // ── Piano range ───────────────────────────────────────────
    // Show the full MIDI range reachable across all strings in this fret window
    const pianoMin = Math.min(...tuning.midi) + minFret;
    const pianoMax = Math.max(...tuning.midi) + maxFret;
    piano.setRange(pianoMin, pianoMax);
    rangeLabel.textContent = `${midiLabel(pianoMin)} – ${midiLabel(pianoMax)}`;

    // ── Generate tab sequence ─────────────────────────────────
    const rawStringNotes   = mapScaleToStrings(rootPC, scale.intervals, tuning.midi, minFret, fretSpan);
    const limitedNotes     = applyNotesPerString(rawStringNotes, notesPerStr);
    const sequence         = buildSequence(limitedNotes, stringOrder, pattern, skipEmpty);

    // ── Mark piano ────────────────────────────────────────────
    // Use the ascending (base) sequence for marks regardless of pattern
    const baseSequence = buildSequence(limitedNotes, stringOrder, 'asc', skipEmpty);
    const markedMidis  = new Set(baseSequence.map(n => n.midi));
    const rootMidis    = new Set([...markedMidis].filter(m => ((m % 12) + 12) % 12 === rootPC));
    piano.setMarkedNotes([...markedMidis]);
    piano.setMarkedRootNotes([...rootMidis]);

    // ── Render tab ────────────────────────────────────────────
    // const tabText = renderAsciiTab(sequence, tuning, lineWidth, noteSpacing, showNames);
    const tabText = renderAsciiTab(sequence, tuning, rootPC, lineWidth, noteSpacing, showNames);
    tabOutput.textContent = tabText;

    // ── Tab title ─────────────────────────────────────────────
    const rootName = NOTE_NAMES[rootPC];
    const posStr   = minFret === 0 ? 'Open pos.' : `Fret ${minFret}`;
    tabTitle.textContent =
        `${rootName} ${scale.name}  ·  ${posStr}  ·  ${tuning.name}`;
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
    patternSelect, noteSpacingSelect, lineWidthSelect,
].forEach(el => el.addEventListener('change', update));

minFretInput.addEventListener('input', update);
skipEmptyCheck.addEventListener('change', update);
showNamesCheck.addEventListener('change', update);

document.getElementById('shift-oct-down').addEventListener('click',  () => shiftFret(-12));
document.getElementById('shift-semi-down').addEventListener('click', () => shiftFret(-1));
document.getElementById('shift-semi-up').addEventListener('click',   () => shiftFret(1));
document.getElementById('shift-oct-up').addEventListener('click',    () => shiftFret(12));

// Copy button with clipboard fallback
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
