// ─── Okhsl-based colour utilities ────────────────────────────────────────────
//
// Full Okhsl implementation derived from Björn Ottosson's source (MIT licence):
//   https://bottosson.github.io/posts/colorpicker/
//   https://bottosson.github.io/posts/gamutclipping/
//
// shiftLightness converts to Okhsl, shifts l, keeps h and s constant,
// converts back. Because Okhsl s is normalised to the gamut shape for each
// hue, holding s constant across lightness levels produces a consistently
// vivid result — including for blue, which degrades badly in naive OKLCH shift.

function srgbToLinear(x) {
    return x >= 0.04045 ? ((x + 0.055) / 1.055) ** 2.4 : x / 12.92;
}
function linearToSrgb(x) {
    return x >= 0.0031308 ? 1.055 * x ** (1 / 2.4) - 0.055 : 12.92 * x;
}

function linearSrgbToOklab(r, g, b) {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ];
}

function oklabToLinearSrgb(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    return [
        +4.0767416621 * l_ ** 3 - 3.3077115913 * m_ ** 3 + 0.2309699292 * s_ ** 3,
        -1.2684380046 * l_ ** 3 + 2.6097574011 * m_ ** 3 - 0.3413193965 * s_ ** 3,
        -0.0041960863 * l_ ** 3 - 0.7034186147 * m_ ** 3 + 1.7076147010 * s_ ** 3,
    ];
}

function toe(x) {
    const k1 = 0.206, k2 = 0.03, k3 = (1 + k1) / (1 + k2);
    return 0.5 * (k3 * x - k1 + Math.sqrt((k3 * x - k1) ** 2 + 4 * k2 * k3 * x));
}
function toeInv(x) {
    const k1 = 0.206, k2 = 0.03, k3 = (1 + k1) / (1 + k2);
    return (x * x + k1 * x) / (k3 * (x + k2));
}

function computeMaxSaturation(a, b) {
    let k0, k1, k2, k3, k4, wl, wm, ws;
    if (-1.88170328 * a - 0.80936493 * b > 1) {
        [k0,k1,k2,k3,k4] = [1.19086277, 1.76576728, 0.59662641, 0.75515197, 0.56771245];
        [wl,wm,ws] = [4.0767416621, -3.3077115913, 0.2309699292];
    } else if (1.81444104 * a - 1.19445276 * b > 1) {
        [k0,k1,k2,k3,k4] = [0.73956515, -0.45954404, 0.08285427, 0.12541070, 0.14503204];
        [wl,wm,ws] = [-1.2684380046, 2.6097574011, -0.3413193965];
    } else {
        [k0,k1,k2,k3,k4] = [1.35733652, -0.00915799, -1.15130210, -0.50559606, 0.00692167];
        [wl,wm,ws] = [-0.0041960863, -0.7034186147, 1.7076147010];
    }
    let S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;
    const kl = 0.3963377774 * a + 0.2158037573 * b;
    const km = -0.1055613458 * a - 0.0638541728 * b;
    const ks = -0.0894841775 * a - 1.2914855480 * b;
    const l_ = 1 + S * kl, m_ = 1 + S * km, s_ = 1 + S * ks;
    const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
    const f  = wl * l    + wm * m    + ws * s;
    const f1 = wl * (3 * kl * l_ * l_) + wm * (3 * km * m_ * m_) + ws * (3 * ks * s_ * s_);
    const f2 = wl * (6 * kl * kl * l_) + wm * (6 * km * km * m_) + ws * (6 * ks * ks * s_);
    S -= f * f1 / (f1 * f1 - 0.5 * f * f2);
    return S;
}

function findCusp(a, b) {
    const S = computeMaxSaturation(a, b);
    const [r, g, bl] = oklabToLinearSrgb(1, S * a, S * b);
    const Lc = Math.cbrt(1 / Math.max(r, g, bl, 0));
    return [Lc, Lc * S];
}

function findGamutIntersection(a, b, L1, C1, L0, cusp) {
    const [cL, cC] = cusp || findCusp(a, b);
    let t;
    if ((L1 - L0) * cC - (cL - L0) * C1 <= 0) {
        t = cC * L0 / (C1 * cL + cC * (L0 - L1));
    } else {
        t = cC * (L0 - 1) / (C1 * (cL - 1) + cC * (L0 - L1));
        const dL = L1 - L0, dC = C1;
        const kl = 0.3963377774*a+0.2158037573*b, km = -0.1055613458*a-0.0638541728*b, ks = -0.0894841775*a-1.2914855480*b;
        const L = L0*(1-t)+t*L1, C = t*C1;
        const l_=L+C*kl, m_=L+C*km, s_=L+C*ks;
        const ldt=3*(dL+dC*kl)*l_*l_, mdt=3*(dL+dC*km)*m_*m_, sdt=3*(dL+dC*ks)*s_*s_;
        const ldt2=6*(dL+dC*kl)**2*l_, mdt2=6*(dL+dC*km)**2*m_, sdt2=6*(dL+dC*ks)**2*s_;
        const rr=4.0767416621*l_**3-3.3077115913*m_**3+0.2309699292*s_**3-1;
        const r1=4.0767416621*ldt-3.3077115913*mdt+0.2309699292*sdt;
        const r2=4.0767416621*ldt2-3.3077115913*mdt2+0.2309699292*sdt2;
        const ur=r1/(r1*r1-0.5*rr*r2); const tr=ur>=0?-rr*ur:Infinity;
        const gg=-1.2684380046*l_**3+2.6097574011*m_**3-0.3413193965*s_**3-1;
        const g1=-1.2684380046*ldt+2.6097574011*mdt-0.3413193965*sdt;
        const g2=-1.2684380046*ldt2+2.6097574011*mdt2-0.3413193965*sdt2;
        const ug=g1/(g1*g1-0.5*gg*g2); const tg=ug>=0?-gg*ug:Infinity;
        const bb=-0.0041960863*l_**3-0.7034186147*m_**3+1.7076147010*s_**3-1;
        const b1=-0.0041960863*ldt-0.7034186147*mdt+1.7076147010*sdt;
        const b2=-0.0041960863*ldt2-0.7034186147*mdt2+1.7076147010*sdt2;
        const ub=b1/(b1*b1-0.5*bb*b2); const tb=ub>=0?-bb*ub:Infinity;
        t += Math.min(tr, tg, tb);
    }
    return t;
}

function getCs(L, a_, b_) {
    const cusp = findCusp(a_, b_);
    const [cL, cC] = cusp;
    const C_max = findGamutIntersection(a_, b_, L, 1, L, cusp);
    const k = C_max / Math.min(L * cC/cL, (1-L) * cC/(1-cL));
    const S = 0.11516993+1/(7.44778970+4.15901240*b_+a_*(-2.19557347+1.75198401*b_+a_*(-2.13704948-10.02301043*b_+a_*(-4.24894561+5.38770819*b_+4.69891013*a_))));
    const T = 0.11239642+1/(1.61320320-0.68124379*b_+a_*(0.40370612+0.90148123*b_+a_*(-0.27087943+0.61223990*b_+a_*(0.00299215-0.45399568*b_-0.14661872*a_))));
    const Ca=L*S, Cb=(1-L)*T;
    const C_mid = 0.9*k*Math.sqrt(Math.sqrt(1/(1/Ca**4+1/Cb**4)));
    const Ca0=L*0.4, Cb0=(1-L)*0.8;
    const C_0 = Math.sqrt(1/(1/Ca0**2+1/Cb0**2));
    return [C_0, C_mid, C_max];
}

function srgbToOkhsl(r, g, b) {
    const [L, a, bv] = linearSrgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
    const C = Math.sqrt(a*a + bv*bv);
    const a_ = C > 1e-6 ? a/C : 1, b_ = C > 1e-6 ? bv/C : 0;
    const h = 0.5 + 0.5 * Math.atan2(-bv, -a) / Math.PI;
    const [C_0, C_mid, C_max] = getCs(L, a_, b_);
    let s;
    if (C < C_mid) {
        const k1=0.8*C_0, k2=1-k1/C_mid;
        s = C/(k1+k2*C) * 0.8;
    } else {
        const k0=C_mid, k1=0.2*C_mid*C_mid*1.5625/C_0, k2=1-k1/(C_max-C_mid);
        s = 0.8 + 0.2*(C-k0)/(k1+k2*(C-k0));
    }
    return [h, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, toe(L)))];
}

function okhslToSrgb(h, s, l) {
    if (l === 1) return [1,1,1];
    if (l === 0) return [0,0,0];
    const a_ = Math.cos(2*Math.PI*h), b_ = Math.sin(2*Math.PI*h);
    const L = toeInv(l);
    const [C_0, C_mid, C_max] = getCs(L, a_, b_);
    let C;
    if (s < 0.8) {
        const t=s/0.8, k1=0.8*C_0, k2=1-k1/C_mid;
        C = t*k1/(1-k2*t);
    } else {
        const t=(s-0.8)/0.2, k0=C_mid, k1=0.2*C_mid*C_mid*1.5625/C_0, k2=1-k1/(C_max-C_mid);
        C = k0+t*k1/(1-k2*t);
    }
    const [r,g,b] = oklabToLinearSrgb(L, C*a_, C*b_);
    return [Math.max(0,Math.min(1,linearToSrgb(r))), Math.max(0,Math.min(1,linearToSrgb(g))), Math.max(0,Math.min(1,linearToSrgb(b)))];
}

function hexToRgb(hex) {
    const n = parseInt(hex.replace('#',''), 16);
    return [(n>>16)/255, ((n>>8)&255)/255, (n&255)/255];
}
function rgbToHex(r,g,b) {
    return '#'+[r,g,b].map(x=>Math.round(Math.max(0,Math.min(1,x))*255).toString(16).padStart(2,'0')).join('');
}

/** Shift a hex colour by ΔL in Okhsl (l is 0–100 scale). H and S are preserved. */
export function shiftLightness(hex, deltaL) {
    const [r, g, b] = hexToRgb(hex);
    const [h, s, l] = srgbToOkhsl(r, g, b);
    const l2 = Math.max(0, Math.min(1, l + deltaL / 100));
    const [ro, go, bo] = okhslToSrgb(h, s, l2);
    return rgbToHex(ro, go, bo);
}
/** Derive rgba glow from a hex colour at a given opacity. */
export function hexToGlow(hex, alpha = 0.18) {
    const n = parseInt(hex.replace('#',''), 16);
    const r = (n>>16) & 255;
    const g = (n>>8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
}