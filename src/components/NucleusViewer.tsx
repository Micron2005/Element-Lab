"use client";

import { useEffect, useMemo, useState } from "react";
import { decayChain, neutronHit, nucleusRef, type NuclearStep, type NucleusRef } from "../lib/nuclearScene";
import { PlaybackControls, prepareCanvas, useCanvasWidth, usePlayback } from "./usePlayback";
import { useReducedMotion } from "./useReducedMotion";
import "./viewer.css";

const STEP_SECONDS = 3.2;
const PROTON = "#ff7b6b";
const NEUTRON = "#8fb3c9";

type Mode = "decay" | "neutron";

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

const KIND_LABEL: Record<NuclearStep["kind"], string> = {
  stable: "Stable",
  "neutron-drip": "Neutron drips off",
  "proton-drip": "Proton drips off",
  fission: "Fission",
  alpha: "Alpha decay",
  "beta-minus": "Beta-minus decay",
  "beta-plus": "Beta-plus decay",
  "neutron-capture": "Neutron capture",
  bounce: "Bounce",
  "quasi-fission": "Quasi-fission",
  "fusion-fission": "Fusion-fission",
  fusion: "Fusion",
  evaporation: "Evaporation",
};

function nucleusRadius(a: number, scale: number) {
  return Math.min(85, 11 * Math.cbrt(Math.max(1, a))) * scale;
}

function drawNucleus(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  z: number,
  n: number,
  scale: number,
  options: { stretch?: number; wobble?: number; glow?: number; flipLast?: number; label?: string } = {},
) {
  const a = Math.max(1, z + n);
  const radius = nucleusRadius(a, scale);
  const nucleon = Math.max(1.2, radius / (1.13 * Math.sqrt(a)));
  const stretch = options.stretch ?? 0;
  const wobble = options.wobble ?? 0;
  if (options.glow) {
    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius * 1.8);
    gradient.addColorStop(0, `rgba(255,230,150,${0.45 * options.glow})`);
    gradient.addColorStop(1, "rgba(255,230,150,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  let lastNeutron = -1;
  for (let k = 0; k < a; k += 1) {
    if (Math.floor(((k + 1) * z) / a) === Math.floor((k * z) / a)) lastNeutron = k;
  }
  for (let k = 0; k < a; k += 1) {
    const r = 1.13 * nucleon * Math.sqrt(k + 0.5);
    const theta = k * 2.39996;
    let x = r * Math.cos(theta) * (1 + stretch + wobble);
    let y = r * Math.sin(theta) / (1 + 0.4 * stretch + wobble * 0.5);
    if (stretch > 0) y *= 1 - 0.55 * stretch * Math.exp(-((x / radius) ** 2) * 3);
    x += cx;
    y += cy;
    const proton = Math.floor(((k + 1) * z) / a) > Math.floor((k * z) / a);
    let color = proton ? PROTON : NEUTRON;
    if (k === lastNeutron && options.flipLast !== undefined) {
      color = options.flipLast >= 1 ? PROTON : NEUTRON;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(options.flipLast * 20)})`;
      ctx.beginPath();
      ctx.arc(x, y, nucleon * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, nucleon, 0, Math.PI * 2);
    ctx.fill();
  }
  if (options.label) {
    ctx.fillStyle = "#d6e2df";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    const width = ctx.canvas.clientWidth || ctx.canvas.width;
    const height = ctx.canvas.clientHeight || ctx.canvas.height;
    const halfLabel = ctx.measureText(options.label).width / 2;
    const labelX = Math.max(halfLabel + 2, Math.min(width - halfLabel - 2, cx));
    const labelY = Math.min(height - 4, cy + radius * (1 + stretch * 0.3) + 16);
    ctx.fillText(options.label, labelX, labelY);
  }
  return radius;
}

function label(ref: NucleusRef) {
  return `${ref.symbol}-${ref.z + ref.n}`;
}

function drawIncoming(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Math.max(0, x - 40), y);
  ctx.lineTo(x - 6, y);
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.stroke();
  drawParticle(ctx, x, y, 4, NEUTRON, "n");
}

function drawParticle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, text?: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  if (text) {
    ctx.fillStyle = color;
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    const width = ctx.canvas.clientWidth || ctx.canvas.width;
    const height = ctx.canvas.clientHeight || ctx.canvas.height;
    const halfLabel = ctx.measureText(text).width / 2;
    const labelX = Math.max(halfLabel + 2, Math.min(width - halfLabel - 2, x));
    const labelY = Math.max(12, Math.min(height - 4, y - radius - 5));
    ctx.fillText(text, labelX, labelY);
  }
}

function drawStep(ctx: CanvasRenderingContext2D, w: number, h: number, step: NuclearStep, p: number, time: number, incoming: boolean) {
  const cx = w / 2;
  const cy = h * 0.55;
  const scale = Math.min(1, h / 300, w / 340);
  const from = step.from;
  const fromR = nucleusRadius(from.z + from.n, scale);
  const wobble = (amount: number) => Math.sin(time * 9) * amount;
  const reach = Math.max(w, h) * 0.55;

  if (step.kind === "stable") {
    drawNucleus(ctx, cx, cy, from.z, from.n, scale, { wobble: wobble(0.015), label: `${label(from)} · stable` });
    return;
  }

  if (step.kind === "neutron-capture") {
    const target = step.to[0] ?? from;
    if (p < 0.4) {
      drawNucleus(ctx, cx, cy, from.z, from.n, scale, { label: label(from) });
      drawIncoming(ctx, lerp(12, cx - fromR - 8, ease(p / 0.4)), cy);
      return;
    }
    const q = (p - 0.4) / 0.6;
    const radius = drawNucleus(ctx, cx, cy, target.z, target.n, scale, { glow: 1 - q, wobble: wobble(0.03 * (1 - q)), label: label(target) });
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const length = q * reach;
    for (let d = 0; d <= length; d += 3) {
      const x = cx + radius + d * 0.8;
      const y = cy - radius * 0.4 - d * 0.6 + Math.sin(d * 0.35) * 5;
      if (d === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#ffe066";
    ctx.font = "12px Arial";
    ctx.fillText("γ", cx + radius + 16, cy - radius - 8);
    return;
  }

  if (step.kind === "bounce") {
    const projectile = step.projectile;
    if (!projectile) {
      drawNucleus(ctx, cx, cy, from.z, from.n, scale, { label: label(from) });
      return;
    }
    const projectileRadius = nucleusRadius(projectile.z + projectile.n, scale);
    const startX = projectileRadius + 8;
    const contactX = Math.max(startX, cx - fromR - projectileRadius + 4);
    const x =
      p < 0.55
        ? lerp(startX, contactX, ease(p / 0.55))
        : lerp(contactX, startX, ease((p - 0.55) / 0.45));
    const wobbleAmount = p > 0.42 ? Math.sin(time * 15) * 0.045 : 0;
    drawNucleus(ctx, cx, cy, from.z, from.n, scale, {
      wobble: wobbleAmount,
      label: label(from),
    });
    drawNucleus(ctx, x, cy, projectile.z, projectile.n, scale, {
      label: label(projectile),
    });
    return;
  }

  if (step.kind === "quasi-fission") {
    const projectile = step.projectile;
    const fragments = step.to;
    if (!projectile || fragments.length < 2) {
      drawNucleus(ctx, cx, cy, from.z, from.n, scale, { label: label(from) });
      return;
    }
    const projectileRadius = nucleusRadius(projectile.z + projectile.n, scale);
    const startX = projectileRadius + 8;
    const contactX = Math.max(startX, cx - fromR - projectileRadius + 4);
    if (p < 0.27) {
      drawNucleus(ctx, cx, cy, from.z, from.n, scale, { label: label(from) });
      drawNucleus(
        ctx,
        lerp(startX, contactX, ease(p / 0.27)),
        cy,
        projectile.z,
        projectile.n,
        scale,
        { label: label(projectile) },
      );
      return;
    }
    if (p < 0.62) {
      const q = ease((p - 0.27) / 0.35);
      const compound = nucleusRef(from.z + projectile.z, from.n + projectile.n);
      drawNucleus(ctx, cx, cy, compound.z, compound.n, scale, {
        stretch: q * 0.7,
        wobble: wobble(0.025),
        label: `${label(compound)}*`,
      });
      return;
    }
    const q = ease((p - 0.62) / 0.38);
    const [left, right] = fragments;
    const edge = Math.max(
      nucleusRadius(left.z + left.n, scale),
      nucleusRadius(right.z + right.n, scale),
    );
    const maxDistance = Math.max(4, w / 2 - edge - 12);
    const distance = lerp(4, maxDistance, q);
    drawNucleus(ctx, cx - distance, cy, left.z, left.n, scale, {
      label: label(left),
    });
    drawNucleus(ctx, cx + distance, cy, right.z, right.n, scale, {
      label: label(right),
    });
    return;
  }

  if (step.kind === "fusion") {
    const projectile = step.projectile;
    const compound = step.to[0];
    if (!projectile || !compound) {
      drawNucleus(ctx, cx, cy, from.z, from.n, scale, { label: label(from) });
      return;
    }
    const projectileRadius = nucleusRadius(projectile.z + projectile.n, scale);
    const startX = projectileRadius + 8;
    const contactX = Math.max(startX, cx - fromR - projectileRadius + 4);
    if (p < 0.4) {
      drawNucleus(ctx, cx, cy, from.z, from.n, scale, { label: label(from) });
      drawNucleus(
        ctx,
        lerp(startX, contactX, ease(p / 0.4)),
        cy,
        projectile.z,
        projectile.n,
        scale,
        { label: label(projectile) },
      );
      return;
    }
    const q = ease((p - 0.4) / 0.6);
    drawNucleus(ctx, cx, cy, compound.z, compound.n, scale, {
      glow: 1 - q,
      wobble: wobble(0.035 * (1 - q)),
      label: `${label(compound)}*`,
    });
    return;
  }

  if (step.kind === "fusion-fission") {
    const projectile = step.projectile;
    const fragments = step.to;
    if (!projectile || fragments.length < 2) {
      drawNucleus(ctx, cx, cy, from.z, from.n, scale, { label: label(from) });
      return;
    }
    const projectileRadius = nucleusRadius(projectile.z + projectile.n, scale);
    const startX = projectileRadius + 8;
    const contactX = Math.max(startX, cx - fromR - projectileRadius + 4);
    if (p < 0.22) {
      drawNucleus(ctx, cx, cy, from.z, from.n, scale, { label: label(from) });
      drawNucleus(
        ctx,
        lerp(startX, contactX, ease(p / 0.22)),
        cy,
        projectile.z,
        projectile.n,
        scale,
        { label: label(projectile) },
      );
      return;
    }
    if (p < 0.67) {
      const q = (p - 0.22) / 0.45;
      const compound = nucleusRef(from.z + projectile.z, from.n + projectile.n);
      drawNucleus(ctx, cx, cy, compound.z, compound.n, scale, {
        stretch: ease(q) * 0.85,
        glow: 1 - q,
        wobble: wobble(0.025),
        label: `${label(compound)}*`,
      });
      return;
    }
    const q = ease((p - 0.67) / 0.33);
    const [left, right] = fragments;
    const edge = Math.max(
      nucleusRadius(left.z + left.n, scale),
      nucleusRadius(right.z + right.n, scale),
    );
    const maxDistance = Math.max(4, w / 2 - edge - 12);
    const distance = lerp(4, maxDistance, q);
    drawNucleus(ctx, cx - distance, cy, left.z, left.n, scale, {
      label: label(left),
    });
    drawNucleus(ctx, cx + distance, cy, right.z, right.n, scale, {
      label: label(right),
    });
    return;
  }

  if (step.kind === "evaporation") {
    const particles = step.emitted
      .filter((item) => item.type === "n" || item.type === "p" || item.type === "alpha")
      .flatMap((item) => Array.from({ length: item.count }, () => item.type));
    const particleSpan = 0.64;
    const interval = particleSpan / Math.max(1, particles.length);
    particles.forEach((type, index) => {
      const start = 0.08 + index * interval;
      if (p < start || p > start + interval) return;
      const progress = ease((p - start) / interval);
      const angle = -Math.PI / 2 + ((index % 5) - 2) * 0.48;
      const distance = fromR + progress * reach * 0.72;
      const x = cx + Math.cos(angle) * distance;
      const y = cy + Math.sin(angle) * distance * 0.72;
      if (type === "alpha") {
        drawNucleus(ctx, x, y, 2, 2, scale * 0.55, { label: "α" });
      } else {
        const color = type === "p" ? PROTON : NEUTRON;
        drawParticle(ctx, x, y, 4, color, type);
      }
    });

    if (step.emitted.some((item) => item.type === "gamma") && p >= 0.68 && p <= 0.94) {
      const q = Math.sin(((p - 0.68) / 0.26) * Math.PI);
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach * 0.55);
      gradient.addColorStop(0, `rgba(255,245,180,${q * 0.5})`);
      gradient.addColorStop(1, "rgba(255,245,180,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }

    if (p < 0.58) {
      const shrink = 1 - 0.15 * ease(p / 0.58);
      ctx.save();
      ctx.globalAlpha = 1 - 0.3 * ease(p / 0.58);
      drawNucleus(ctx, cx, cy, from.z, from.n, scale * shrink, {
        wobble: wobble(0.02),
        label: label(from),
      });
      ctx.restore();
    }
    if (p >= 0.48 && step.to.length > 0) {
      const q = ease((p - 0.48) / 0.52);
      const alpha = Math.min(1, 0.25 + q);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (step.to.length === 1) {
        const product = step.to[0];
        drawNucleus(ctx, cx, cy, product.z, product.n, scale, {
          glow: 0.3 * (1 - q),
          label: label(product),
        });
      } else {
        const [left, right] = step.to;
        const edge = Math.max(
          nucleusRadius(left.z + left.n, scale),
          nucleusRadius(right.z + right.n, scale),
        );
        const maxDistance = Math.max(4, w / 2 - edge - 12);
        const distance = lerp(4, maxDistance, q);
        drawNucleus(ctx, cx - distance, cy, left.z, left.n, scale, {
          label: label(left),
        });
        drawNucleus(ctx, cx + distance, cy, right.z, right.n, scale, {
          label: label(right),
        });
      }
      ctx.restore();
    }
    return;
  }

  if (step.kind === "fission") {
    const pre = incoming ? 0.25 : 0;
    if (p < pre) {
      drawNucleus(ctx, cx, cy, from.z, from.n, scale, { label: label(from) });
      drawIncoming(ctx, lerp(12, cx - fromR - 8, ease(p / pre)), cy);
      return;
    }
    const p2 = (p - pre) / (1 - pre);
    if (p2 < 0.45 || step.to.length < 2) {
      const stretch = ease(p2 / 0.45) * 0.9;
      drawNucleus(ctx, cx, cy, from.z, from.n, scale, {
        stretch,
        wobble: wobble(0.03),
        label: label(from),
      });
      return;
    }
    const q = (p2 - 0.45) / 0.55;
    if (q < 0.25) {
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach * 0.6);
      gradient.addColorStop(0, `rgba(255,255,230,${(0.25 - q) * 3})`);
      gradient.addColorStop(1, "rgba(255,255,230,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }
    const [left, right] = step.to;
    const edge = Math.max(nucleusRadius(left.z + left.n, scale), nucleusRadius(right.z + right.n, scale));
    const distance = Math.min(w / 2 - edge - 8, fromR * 0.6 + ease(q) * w * 0.28);
    drawNucleus(ctx, cx - distance, cy, left.z, left.n, scale, { label: label(left) });
    drawNucleus(ctx, cx + distance, cy, right.z, right.n, scale, { label: label(right) });
    const neutrons = step.emitted.find((item) => item.type === "n")?.count ?? 0;
    for (let k = 0; k < neutrons; k += 1) {
      const angle = -Math.PI / 2 + (k - (neutrons - 1) / 2) * 0.7 + (k % 2 ? Math.PI : 0);
      drawParticle(ctx, cx + Math.cos(angle) * q * reach, cy + Math.sin(angle) * q * reach * 0.6, 4, NEUTRON, "n");
    }
    return;
  }

  const target = step.to[0] ?? from;
  const split = step.kind === "beta-minus" || step.kind === "beta-plus" ? 0.4 : 0.35;
  if (p < split) {
    const flip = step.kind === "beta-minus" ? p / split : undefined;
    drawNucleus(ctx, cx, cy, from.z, from.n, scale, { wobble: wobble(0.04 * (p / split)), flipLast: flip, label: label(from) });
    return;
  }
  const q = ease((p - split) / (1 - split));
  const radius = drawNucleus(ctx, cx, cy, target.z, target.n, scale, { glow: 1 - q, label: label(target) });
  const outX = (angle: number, factor = 1) => cx + Math.cos(angle) * (radius + q * reach * factor);
  const outY = (angle: number, factor = 1) => cy + Math.sin(angle) * (radius + q * reach * factor) * 0.7;
  if (step.kind === "alpha") {
    drawNucleus(ctx, outX(-0.4), outY(-0.4), 2, 2, scale, { label: "α" });
  } else if (step.kind === "beta-minus" || step.kind === "beta-plus") {
    const positron = step.kind === "beta-plus";
    drawParticle(ctx, outX(-0.5), outY(-0.5), 3, positron ? "#ffd166" : "#5ee1ff", positron ? "e⁺" : "e⁻");
    drawParticle(ctx, outX(2.6, 0.8), outY(2.6, 0.8), 2, "rgba(220,220,255,0.6)", "ν");
  } else if (step.kind === "neutron-drip") {
    drawParticle(ctx, outX(-0.6), outY(-0.6), 4, NEUTRON, "n");
  } else if (step.kind === "proton-drip") {
    drawParticle(ctx, outX(-0.6), outY(-0.6), 4, PROTON, "p");
  }
}

export default function NucleusViewer({
  z,
  n,
  steps: suppliedSteps,
}: {
  z: number;
  n: number;
  steps?: NuclearStep[];
}) {
  const [mode, setMode] = useState<Mode>("decay");
  const defaultSteps = useMemo(
    () => (mode === "decay" ? decayChain(z, n) : [neutronHit(z, n)]),
    [mode, z, n],
  );
  const steps = suppliedSteps ?? defaultSteps;
  const hasSuppliedSteps = suppliedSteps !== undefined;
  const stepSeconds = !hasSuppliedSteps && mode === "neutron" ? STEP_SECONDS * 1.5 : STEP_SECONDS;
  const reducedMotion = useReducedMotion();
  const playback = usePlayback(steps.length * stepSeconds, hasSuppliedSteps, reducedMotion);
  const { ref, width } = useCanvasWidth();
  const { t } = playback;
  const index = Math.max(0, Math.min(steps.length - 1, Math.floor(t * steps.length)));
  const step = steps[index];
  const local = t >= 1 ? 1 : t * steps.length - index;

  useEffect(() => {
    const prepared = prepareCanvas(ref.current, width);
    if (prepared && step) {
      drawStep(
        prepared.ctx,
        prepared.w,
        prepared.h,
        step,
        local,
        t * steps.length * stepSeconds,
        !hasSuppliedSteps && mode === "neutron",
      );
    }
  }, [ref, width, step, local, t, steps.length, stepSeconds, mode, hasSuppliedSteps]);

  function choose(next: Mode) {
    setMode(next);
    playback.restart();
  }

  return (
    <div className="viewer">
      {!hasSuppliedSteps && (
        <div className="viewer-modes" role="group" aria-label="What to watch">
          <button
            type="button"
            className={`button ${mode === "decay" ? "button-primary" : "button-secondary"}`}
            onClick={() => choose("decay")}
          >
            Watch it decay
          </button>
          <button
            type="button"
            className={`button ${mode === "neutron" ? "button-primary" : "button-secondary"}`}
            onClick={() => choose("neutron")}
          >
            Fire a neutron at it
          </button>
        </div>
      )}
      <div className="viewer-stage">
        <canvas ref={ref} role="img" aria-label={step ? step.caption : "Nucleus animation"} />
        {step && (
          <div className="viewer-hud">
            <div>
              <strong>
                Step {index + 1} of {steps.length}
              </strong>
              {KIND_LABEL[step.kind]}
            </div>
            <div className="viewer-clock">
              <strong>Energy</strong>
              {step.kind === "stable" ? "—" : `${step.energyMeV.toFixed(1)} MeV`}
            </div>
          </div>
        )}
      </div>
      <PlaybackControls playback={playback} label={hasSuppliedSteps ? "Fusion" : "Nucleus"} />
      <ol className="viewer-steps">
        {steps.map((item, itemIndex) => (
          <li key={`${item.kind}-${itemIndex}`} className={itemIndex === index ? "is-current" : undefined}>
            {item.caption}
            {item.kind !== "stable" && item.halfLife ? ` · half-life ${item.halfLife}` : ""}
          </li>
        ))}
      </ol>
      <p className="muted small">
        Animated from the rough model on this page, not measured data. A nucleus on screen is not a real new element.
      </p>
    </div>
  );
}
