import { NOTE_NAMES } from "./global.js";

/* ===========================
   CONSTANTS
=========================== */
const WHITE_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

/* ===========================
   PIANO WIDGET
=========================== */
export class PianoWidget {
    static DEFAULTS = {
        blackHeightRatio: 0.61,
        blackWidthRatio: 0.65,
        minWhiteWidth: 36,
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
        dimWhiteColor: '#888888', // color for out-of-scale white keys
        dimBlackColor: '#888888', // color for out-of-scale black keys
        rangeMin: 48,
        rangeMax: 72,
    };

    constructor(canvas, container, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.container = container;
        this.config = { ...PianoWidget.DEFAULTS, ...options };

        this.range = { min: this.config.rangeMin, max: this.config.rangeMax };
        this.whiteKeys = [];
        this.blackKeys = [];
        this.markedNotes = new Set();
        this.markedRootNotes = new Set();
        this.pressedNotes = new Set();
        this.allowedNotes = null;   // null = all keys pass; Set = only these midi values are hittable
        this.dimmedNotes = new Set(); // purely visual: these keys render muted
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
        min = Math.max(0, min);
        max = Math.min(127, max);
        if (min >= max) return false;
        this.range = { min, max };
        this._buildKeys();
        this.render();
        return true;
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

    /**
     * Restrict which keys are hittable. Pass null to remove the gate (default).
     * Keys not in the set return null from keyAtPoint — all pointer handlers
     * already guard on `if (key)` so this propagates for free.
     */
    setAllowedNotes(notes) {
        this.allowedNotes = notes == null ? null : new Set(notes);
        this.render();
    }

    /**
     * Keys in this set render muted/dimmed. Purely visual — independent of
     * allowedNotes so you can dim without blocking (or block without dimming).
     */
    setDimmedNotes(notes) {
        this.dimmedNotes = new Set(notes);
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
            if (x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h) {
                if (this.allowedNotes && !this.allowedNotes.has(k.midi)) return null;
                return k;
            }
        }
        for (const k of this.whiteKeys) {
            if (x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h) {
                if (this.allowedNotes && !this.allowedNotes.has(k.midi)) return null;
                return k;
            }
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
        const endIsBlack = BLACK_PCS.has(this.range.max % 12);

        // Build full key range including compensating half-white if start is black
        const buildMin = startIsBlack ? this.range.min - 1 : this.range.min;
        const buildMax = endIsBlack ? this.range.max + 1 : this.range.max;

        // Count whites for width calculation
        let whiteCount = 0;
        for (let m = buildMin; m <= buildMax; m++) {
            if (WHITE_PCS.has(m % 12)) whiteCount++;
        }

        // Adjust divisor: half-whites at black edges count as 0.5
        let divisor = whiteCount;
        if (startIsBlack) divisor -= 0.5;
        if (endIsBlack) divisor -= 0.5;

        const naturalWhiteWidth = containerWidth / divisor;
        const whiteWidth = Math.max(naturalWhiteWidth, cfg.minWhiteWidth);
        const blackWidth = whiteWidth * cfg.blackWidthRatio;

        const whiteHeight = cfg.whiteHeight != null
            ? cfg.whiteHeight
            : Math.min(300, Math.max(180, Math.floor(containerWidth / 4)));
        const blackHeight = Math.round(whiteHeight * cfg.blackHeightRatio);

        this._whiteWidth = whiteWidth;
        this._blackWidth = blackWidth;

        const xOffset = startIsBlack ? whiteWidth / 2 : 0;

        const whiteIndexByMidi = new Map();
        let whiteIndex = 0;

        for (let m = buildMin; m <= buildMax; m++) {
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
            this.blackKeys.push({
                midi: m, type: 'black',
                x: leftKey.x + leftKey.w - blackWidth / 2,
                y: 0, w: blackWidth, h: blackHeight,
            });
        }

        // Optional: add left/right outer blacks for non-start-black ranges
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
        if (!endIsBlack && BLACK_PCS.has(rightOuter % 12)) {
            // When endIsBlack=false, range.max is a white key — find it directly.
            const lastRangeWhite = whiteIndexByMidi.get(this.range.max);
            if (lastRangeWhite != null) {
                const lastKey = this.whiteKeys[lastRangeWhite];
                this.blackKeys.push({
                    midi: rightOuter, type: 'black',
                    x: lastKey.x + lastKey.w - blackWidth / 2,
                    y: 0, w: blackWidth, h: blackHeight,
                });
            }
        }

        // Set canvas dimensions — authoritative from whiteWidth, not key geometry.
        const cssWidth = whiteWidth * divisor;
        const cssHeight = whiteHeight;
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = Math.round(cssWidth * dpr);
        this.canvas.height = Math.round(cssHeight * dpr);
        this.canvas.style.width = cssWidth + 'px';
        this.canvas.style.height = cssHeight + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this._cssWidth = cssWidth;
        this._cssHeight = cssHeight;

        const allKeys = [...this.whiteKeys, ...this.blackKeys];
        const firstKey = allKeys.find(k => k.midi === this.range.min);
        const lastKey = allKeys.find(k => k.midi === this.range.max);
        this.container.style.setProperty('--start-key-cx', `${firstKey.x + firstKey.w / 2}px`);
        this.container.style.setProperty('--end-key-cx', `${lastKey.x + lastKey.w / 2}px`);
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
            const isDimmed = this.dimmedNotes.has(k.midi);
            ctx.fillStyle = isDimmed ? cfg.dimWhiteColor : cfg.whiteColor;
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
            ctx.fillStyle = this.dimmedNotes.has(k.midi) ? cfg.dimBlackColor : cfg.blackColor;
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