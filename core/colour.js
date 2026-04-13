// ─── colour utilities ────────────────────────────────────────────────────────

function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
}

function rgbToLinear(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToOklab(r, g, b) {
    const l = Math.cbrt(0.4122214708*r + 0.5363325363*g + 0.0514459929*b);
    const m = Math.cbrt(0.2119034982*r + 0.6806995451*g + 0.1073969566*b);
    const s = Math.cbrt(0.0883024619*r + 0.2817188376*g + 0.6299787005*b);
    return [
        0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
        1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
        0.0259040371*l + 0.4072384752*m - 0.4321384727*s,
    ];
}

function oklabToLinear(L, a, b) {
    const l = L + 0.3963377774*a + 0.2158037573*b;
    const m = L - 0.1055613458*a - 0.0638541728*b;
    const s = L - 0.0894841775*a - 1.2914855480*b;
    return [l**3, m**3, s**3];
}

function linearToSrgb(c) {
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1/2.4) - 0.055;
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

/** Shift a hex colour by ΔL in oklch (L is 0–100 scale). C and H are preserved. */
export function shiftLightness(hex, deltaL) {
    const [r, g, b] = hexToRgb(hex).map(rgbToLinear);
    const [L, a, bv] = linearToOklab(r, g, b);

    const C  = Math.sqrt(a*a + bv*bv);
    const H  = Math.atan2(bv, a);
    const L2 = clamp01(L + deltaL / 100);
    const a2 = C * Math.cos(H);
    const b2 = C * Math.sin(H);

    const [lr, lg, lb] = oklabToLinear(L2, a2, b2);
    const out = [lr, lg, lb]
        .map(c => Math.round(clamp01(linearToSrgb(c)) * 255))
        .map(c => c.toString(16).padStart(2, '0'))
        .join('');
    return '#' + out;
}

/** Derive rgba glow from a hex colour at a given opacity. */
export function hexToGlow(hex, alpha = 0.18) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
}
