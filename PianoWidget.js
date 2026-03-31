/* ===========================
   CONSTANTS
=========================== */
const WHITE_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/* ===========================
   PIANO WIDGET
=========================== */
export class PianoWidget {
    static DEFAULTS = {
        blackHeightRatio: 0.61,
        blackWidthRatio: 0.65,
        minWhiteWidth: 28,
        insetTop: 0,
        insetSides: 5,
        insetBottom: 5,
        whiteColor: '#fff',
        blackColor: '#222',
        borderColor: '#444',
        borderWidth: 1.5,
        pressColor: '#f0a500',
        markColor: '#538cc5',
        markRootColor: '#1a7bdb',
        markTextColor: '#fff',
        markRadiusRatio: 0.28,   // circle radius as fraction of white key width
        touchAction: null,   // null = don't set; 'none' = block all touch scroll
    };

    constructor(canvas, container, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.container = container;
        this.config = { ...PianoWidget.DEFAULTS, ...options };

        this.range = { min: 60, max: 84 };
        this.whiteKeys = [];
        this.blackKeys = [];
        this.markedNotes = new Set();
        this.markedRootNotes = new Set();
        this.pressedNotes = new Set();
        this.onKeyEvent = null;

        if (this.config.touchAction) {
            this.canvas.style.touchAction = this.config.touchAction;
        }

        this.canvas.style.webkitTouchCallout = 'none';
        this.canvas.style.userSelect = 'none';
        this.canvas.style.webkitUserSelect = 'none';

        this._buildKeys();
        this.render();
        this._bindPointer();

        this._resizeObserver = new ResizeObserver(() => {
            this._buildKeys();
            this.render();
        });
        this._resizeObserver.observe(this.container);

        this._dprHandler = () => { this._buildKeys(); this.render(); };
        this._dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        this._dprMediaQuery.addEventListener('change', this._dprHandler);
    }

    destroy() {
        this._resizeObserver.disconnect();
        this._dprMediaQuery.removeEventListener('change', this._dprHandler);
    }
    /* ===========================
       PUBLIC API
    =========================== */
    setRange(min, max) {
        this.range = { min, max };
        this._buildKeys();
        this.render();
    }

    shiftRange(delta) {
        this.setRange(this.range.min + delta, this.range.max + delta);
    }

    setMarkedNotes(notes) {
        this.markedNotes = new Set(notes);
        this.render();
    }

    setMarkedRootNotes(notes) {
        this.markedRootNotes = new Set(notes);
        this.render();
    }

    setPressedNotes(notes) {
        this.pressedNotes = new Set(notes);
        this.render();
    }

    addPressedNote(midi) {
        this.pressedNotes.add(midi);
        this.render();
    }

    removePressedNote(midi) {
        this.pressedNotes.delete(midi);
        this.render();
    }

    clearPressedNotes() {
        this.pressedNotes.clear();
        this.render();
    }

    /** Returns the key object under (x, y) in CSS pixels, or null.
     *  Black keys are checked first as they overlap white key regions. */
    keyAtPoint(x, y) {
        for (const k of this.blackKeys) {
            if (x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h) return k;
        }
        for (const k of this.whiteKeys) {
            if (x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h) return k;
        }
        return null;
    }

    /* ===========================
       BUILD KEYS & GEOMETRY
    =========================== */
    _buildKeys() {
        const cfg = this.config;
        this.whiteKeys = [];
        this.blackKeys = [];

        const containerWidth = this.container.clientWidth || 640;
        const startIsBlack = BLACK_PCS.has(this.range.min % 12);
        const buildMin = startIsBlack ? this.range.min - 1 : this.range.min;

        let whiteCount = 0;
        for (let m = buildMin; m <= this.range.max; m++) {
            if (WHITE_PCS.has(m % 12)) whiteCount++;
        }

        const divisor = startIsBlack ? whiteCount - 1 + cfg.blackWidthRatio / 2 : whiteCount;
        const naturalWhiteWidth = containerWidth / divisor;
        const whiteWidth = Math.max(naturalWhiteWidth, cfg.minWhiteWidth);
        const blackWidth = whiteWidth * cfg.blackWidthRatio;

        // height: explicit override wins, otherwise ratio of visible container width
        const whiteHeight = cfg.whiteHeight != null
            ? cfg.whiteHeight
            : Math.min(300, Math.max(180, Math.floor(containerWidth / 4)));
        const blackHeight = Math.round(whiteHeight * cfg.blackHeightRatio);

        this._whiteWidth = whiteWidth;
        this._blackWidth = blackWidth;

        const xOffset = startIsBlack ? whiteWidth - blackWidth / 2 : 0;

        const whiteIndexByMidi = new Map();
        let whiteIndex = 0;

        for (let m = buildMin; m <= this.range.max; m++) {
            if (!WHITE_PCS.has(m % 12)) continue;
            whiteIndexByMidi.set(m, whiteIndex);
            this.whiteKeys.push({
                midi: m, type: 'white',
                x: whiteIndex * whiteWidth - xOffset,
                y: 0, w: whiteWidth, h: whiteHeight,
            });
            whiteIndex++;
        }

        for (let m = buildMin; m <= this.range.max; m++) {
            if (!BLACK_PCS.has(m % 12)) continue;
            const leftMidi = m - 1;
            if (!whiteIndexByMidi.has(leftMidi)) continue;
            const leftIdx = whiteIndexByMidi.get(leftMidi);
            const leftKey = this.whiteKeys[leftIdx];
            const rightKey = this.whiteKeys[leftIdx + 1];
            if (!rightKey) continue;
            this.blackKeys.push({
                midi: m, type: 'black',
                x: leftKey.x + leftKey.w - blackWidth / 2,
                y: 0, w: blackWidth, h: blackHeight,
            });
        }

        if (!startIsBlack) {
            const leftOuter = this.range.min - 1;
            if (leftOuter >= 0 && BLACK_PCS.has(leftOuter % 12)) {
                this.blackKeys.unshift({
                    midi: leftOuter, type: 'black',
                    x: this.whiteKeys[0].x - blackWidth / 2,
                    y: 0, w: blackWidth, h: blackHeight,
                });
            }
        }

        const rightOuter = this.range.max + 1;
        if (BLACK_PCS.has(rightOuter % 12)) {
            const lastWhite = this.whiteKeys[this.whiteKeys.length - 1];
            this.blackKeys.push({
                midi: rightOuter, type: 'black',
                x: lastWhite.x + lastWhite.w - blackWidth / 2,
                y: 0, w: blackWidth, h: blackHeight,
            });
        }

        const lastWhite = this.whiteKeys[this.whiteKeys.length - 1];
        const cssWidth = lastWhite.x + lastWhite.w;
        const cssHeight = whiteHeight;
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = Math.round(cssWidth * dpr);
        this.canvas.height = Math.round(cssHeight * dpr);
        this.canvas.style.width = cssWidth + 'px';
        this.canvas.style.height = cssHeight + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this._cssWidth = cssWidth;
        this._cssHeight = cssHeight;
    }
    /* ===========================
       POINTER SURFACE
    =========================== */
    _bindPointer() {
        const canvas = this.canvas;

        // Coordinates are always in CSS pixels; key geometry is in CSS pixels;
        // hit testing therefore needs no DPR adjustment.
        const toCoords = (e) => {
            const rect = canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        };

        canvas.addEventListener('pointerdown', (e) => {
            canvas.setPointerCapture(e.pointerId);
            const { x, y } = toCoords(e);
            if (this.onKeyEvent) this.onKeyEvent(this.keyAtPoint(x, y), 'down', e);
        });

        canvas.addEventListener('pointermove', (e) => {
            const { x, y } = toCoords(e);
            // With capture active, moves fire even off-canvas; keyAtPoint returns null there.
            if (this.onKeyEvent) this.onKeyEvent(this.keyAtPoint(x, y), 'move', e);
        });

        canvas.addEventListener('pointerup', (e) => {
            const { x, y } = toCoords(e);
            if (this.onKeyEvent) this.onKeyEvent(this.keyAtPoint(x, y), 'up', e);
        });

        canvas.addEventListener('pointercancel', (e) => {
            if (this.onKeyEvent) this.onKeyEvent(null, 'cancel', e);
        });

        canvas.addEventListener('pointerleave', (e) => {
            // With capture active this won't fire mid-drag, but handles
            // hover-exit and any pre-capture edge cases.
            if (this.onKeyEvent) this.onKeyEvent(null, 'leave', e);
        });
    }

    /* ===========================
       RENDER
    =========================== */
    render() {
        const ctx = this.ctx;
        const cfg = this.config;
        ctx.clearRect(0, 0, this._cssWidth, this._cssHeight);

        // --- white key bases ---
        for (const k of this.whiteKeys) {
            ctx.fillStyle = cfg.whiteColor;
            ctx.fillRect(k.x, k.y, k.w, k.h);

            if (this.pressedNotes.has(k.midi)) {
                ctx.fillStyle = cfg.pressColor;
                ctx.fillRect(
                    k.x + cfg.insetSides,
                    k.y + cfg.insetTop,
                    k.w - 2 * cfg.insetSides,
                    k.h - cfg.insetTop - cfg.insetBottom
                );
            }

            ctx.strokeStyle = cfg.borderColor;
            ctx.lineWidth = cfg.borderWidth;
            ctx.strokeRect(k.x, k.y, k.w, k.h);
        }

        // --- black key bases ---
        for (const k of this.blackKeys) {
            ctx.fillStyle = cfg.blackColor;
            ctx.fillRect(k.x, k.y, k.w, k.h);

            if (this.pressedNotes.has(k.midi)) {
                ctx.fillStyle = cfg.pressColor;
                ctx.fillRect(
                    k.x + cfg.insetSides,
                    k.y + cfg.insetTop,
                    k.w - 2 * cfg.insetSides,
                    k.h - cfg.insetTop - cfg.insetBottom
                );
            }
        }

        // --- mark circles + labels (top layer) ---
        const radius = this._whiteWidth * cfg.markRadiusRatio;
        for (const k of [...this.whiteKeys, ...this.blackKeys]) {
            if (!this.markedNotes.has(k.midi) && !this.markedRootNotes.has(k.midi)) continue;

            const isRoot = this.markedRootNotes.has(k.midi);
            const cx = k.x + k.w / 2;
            const cy = k.y + k.h - radius - cfg.insetBottom - 4;

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = isRoot ? cfg.markRootColor : cfg.markColor;
            ctx.fill();

            ctx.fillStyle = cfg.markTextColor;
            ctx.font = `bold ${Math.round(radius * 1.1)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(NOTE_NAMES[k.midi % 12], cx, cy);
        }

        // --- outer border ---
        ctx.strokeStyle = cfg.borderColor;
        ctx.lineWidth = cfg.borderWidth;
        ctx.strokeRect(0, 0, this._cssWidth, this._cssHeight);
    }
}
