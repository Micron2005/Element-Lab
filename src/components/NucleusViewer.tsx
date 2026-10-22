"use client";

import { useEffect, useMemo, useState } from "react";
import { decayChain, neutronHit, type NuclearStep, type NucleusRef } from "../lib/nuclearScene";
import { PlaybackControls, prepareCanvas, useCanvasWidth, usePlayback } from "./usePlayback";
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
    ctx.fillText(options.label, cx, cy + radius * (1 + stretch * 0.3) + 16);
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
    ctx.fillText(text, x, y - radius - 5);
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

export default function NucleusViewer({ z, n }: { z: number; n: number }) {
  const [mode, setMode] = useState<Mode>("decay");
  const steps = useMemo(() => (mode === "decay" ? decayChain(z, n) : [neutronHit(z, n)]), [mode, z, n]);
  const stepSeconds = mode === "neutron" ? STEP_SECONDS * 1.5 : STEP_SECONDS;
  const playback = usePlayback(steps.length * stepSeconds, false);
  const { ref, width } = useCanvasWidth();
  const { t } = playback;
  const index = Math.min(steps.length - 1, Math.floor(t * steps.length));
  const step = steps[index];
  const local = t >= 1 ? 1 : t * steps.length - index;

  useEffect(() => {
    const prepared = prepareCanvas(ref.current, width);
    if (prepared && step) {
      drawStep(prepared.ctx, prepared.w, prepared.h, step, local, t * steps.length * stepSeconds, mode === "neutron");
    }
  }, [ref, width, step, local, t, steps.length, stepSeconds, mode]);

  function choose(next: Mode) {
    setMode(next);
    playback.restart();
  }

  return (
    <div className="viewer">
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
      <PlaybackControls playback={playback} label="Nucleus" />
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
