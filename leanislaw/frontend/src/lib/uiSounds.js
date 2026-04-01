/** Short UI clicks via Web Audio (no asset files; unlocks on first gesture). */

const VARIANTS = {
    tap: { freq: 520, endFreq: 520, duration: 0.045, type: "sine", gain: 0.055 },
    tile: { freq: 400, endFreq: 340, duration: 0.04, type: "triangle", gain: 0.05 },
    primary: { freq: 660, endFreq: 580, duration: 0.06, type: "sine", gain: 0.065 },
    soft: { freq: 460, endFreq: 460, duration: 0.035, type: "sine", gain: 0.038 },
    taunt: { freq: 300, endFreq: 180, duration: 0.085, type: "triangle", gain: 0.052 },
};

let ctxRef = null;

function getCtx() {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctxRef) ctxRef = new AC();
    return ctxRef;
}

/**
 * @param {'tap' | 'tile' | 'primary' | 'soft' | 'taunt'} [variant]
 */
export function playUiSound(variant = "tap") {
    const ctx = getCtx();
    if (!ctx) return;
    const cfg = VARIANTS[variant] || VARIANTS.tap;
    if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
    }

    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = cfg.type;
    osc.frequency.setValueAtTime(cfg.freq, t0);
    if (cfg.endFreq !== cfg.freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, cfg.endFreq), t0 + cfg.duration);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(cfg.gain, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + cfg.duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + cfg.duration + 0.015);
}
