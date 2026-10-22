"use client";

import { useEffect, useMemo } from "react";
import { realTimeAt, type MixScene, type ScenePhase } from "../lib/bench/scene";
import { PlaybackControls, prepareCanvas, seededRandom, useCanvasWidth, usePlayback } from "./usePlayback";
import "./viewer.css";

const DURATION_SECONDS = 16;

interface Particle {
  species: number;
  color: string;
  solvent: boolean;
  layer: [number, number];
  uniform: [number, number];
  phase: number;
  phase2: number;
  drop: number;
  rank: number;
  cluster: number;
  row: number;
  strand: number;
}

interface Bubble {
  x: number;
  phase: number;
  size: number;
}

interface Model {
  particles: Particle[];
  bubbles: Bubble[];
  participants: number[][];
  solventShare: number;
}

const CLUSTERS: [number, number][] = [
  [0.25, 0.7],
  [0.7, 0.78],
  [0.45, 0.45],
  [0.78, 0.4],
];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

function buildModel(scene: MixScene): Model {
  const total = scene.species.reduce((sum, item) => sum + item.count, 0) || 1;
  const rand = seededRandom(total * 7919 + scene.species.length * 104729);
  const order = scene.species.map((item, index) => ({ item, index })).sort((a, b) => b.item.density - a.item.density);
  const bands = new Map<number, [number, number]>();
  let filled = 0;
  for (const { item, index } of order) {
    const share = item.count / total;
    bands.set(index, [1 - filled - share, 1 - filled]);
    filled += share;
  }
  const speciesCount = Math.max(1, scene.species.length);
  const particles: Particle[] = [];
  scene.species.forEach((item, index) => {
    const band = bands.get(index) ?? [0, 1];
    for (let k = 0; k < item.count; k += 1) {
      particles.push({
        species: index,
        color: item.color,
        solvent: item.category === "solvent",
        layer: [rand(), lerp(band[0], band[1], rand())],
        uniform: [rand(), rand()],
        phase: rand() * Math.PI * 2,
        phase2: rand() * Math.PI * 2,
        drop: (item.pourIndex + rand() * 0.75) / speciesCount,
        rank: rand(),
        cluster: Math.floor(rand() * CLUSTERS.length),
        row: Math.floor(rand() * 5),
        strand: rand(),
      });
    }
  });
  const bubbles = Array.from({ length: 40 }, () => ({ x: rand(), phase: rand(), size: 1.5 + rand() * 3 }));
  const participants = scene.effects.map((effect) =>
    scene.species.flatMap((item, index) => (effect.species.includes(item.id) ? [index] : [])),
  );
  const solventShare =
    scene.species.filter((item) => item.category === "solvent").reduce((sum, item) => sum + item.count, 0) / total;
  return { particles, bubbles, participants, solventShare };
}

function findPhase(scene: MixScene, id: ScenePhase["id"]) {
  return scene.phases.find((phase) => phase.id === id);
}

function progress(phase: ScenePhase | undefined, t: number) {
  if (!phase) return 0;
  if (phase.end <= phase.start) return t >= phase.end ? 1 : 0;
  return clamp((t - phase.start) / (phase.end - phase.start));
}

function effectProgress(start: number, end: number, t: number) {
  if (end <= start) return t >= end ? 1 : 0;
  return clamp((t - start) / (end - start));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.replace(/./g, "$&$&") : clean.slice(0, 6), 16);
  if (Number.isNaN(value)) return [200, 200, 200];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgba(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp(alpha)})`;
}

function drawMix(ctx: CanvasRenderingContext2D, w: number, h: number, scene: MixScene, model: Model, t: number) {
  if (scene.finalShape === "empty" || model.particles.length === 0) {
    ctx.fillStyle = "#91a3a4";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Add ingredients, then press Run", w / 2, h / 2);
    return;
  }

  const time = t * DURATION_SECONDS;
  const strandShape = scene.finalShape === "strand";
  const extruding = strandShape || scene.forming === "extrude-air" || scene.forming === "extrude-bath";
  const x0 = extruding ? w * 0.06 : w * 0.16;
  const x1 = extruding ? w * 0.56 : w * 0.84;
  const y0 = h * 0.3;
  const y1 = h - 14;

  const pour = findPhase(scene, "pour");
  const mix = findPhase(scene, "mix");
  const final = findPhase(scene, "final");
  const reactPhase = findPhase(scene, "react") ?? findPhase(scene, "set");
  const reactStart = reactPhase?.start ?? final?.start ?? 1;
  const pourProgress = pour ? progress(pour, t) : 1;
  const mixProgress = progress(mix, t);
  const finalProgress = progress(final, t);

  const diffusion = mix ? ease(mixProgress) : ease(clamp((t - (pour?.end ?? 0)) / Math.max(0.01, 1 - (pour?.end ?? 0))));
  const mixed = scene.mixCompleteness * diffusion;
  const turns = (2 + 6 * scene.stirSpeed) * scene.stirSpeed;
  const swirl = mix ? Math.PI * 2 * turns * mixProgress : 0;

  const effects = scene.effects.map((effect, index) => ({
    effect,
    progress: effectProgress(effect.start, effect.end, t),
    members: new Set(model.participants[index]),
    active: t >= effect.start && t <= effect.end,
  }));
  const bondEffects = effects.filter((item) => item.effect.kind === "bonds" || item.effect.kind === "align");
  const digest = effects.filter((item) => item.effect.kind === "digest").reduce((max, item) => Math.max(max, item.progress * item.effect.strength), 0);
  const bondProgress = bondEffects.length
    ? bondEffects.reduce((sum, item) => sum + item.progress, 0) / bondEffects.length
    : 0;
  const bonded = scene.network * bondProgress * (1 - digest);
  const evaporation = effects
    .filter((item) => item.effect.kind === "evaporate")
    .reduce((max, item) => Math.max(max, item.progress), 0);

  const fillLevel = 0.86 * clamp(pourProgress * 1.15) * (1 - evaporation * model.solventShare * 0.6) * (scene.finalShape === "film" ? 1 - 0.7 * finalProgress : 1);
  const liquidTop = y1 - (y1 - y0 - 8) * Math.max(0.12, fillLevel);

  let tint: [number, number, number] = [90, 169, 255];
  let tintAlpha = 0.07;
  for (const item of effects) {
    if (item.effect.kind === "color" && item.effect.color && item.progress > 0) {
      tint = hexToRgb(item.effect.color);
      tintAlpha = 0.07 + 0.3 * item.progress * item.effect.strength;
    }
  }

  if (scene.atmosphere === "vacuum") {
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(160,190,200,0.45)";
    ctx.beginPath();
    ctx.ellipse((x0 + x1) / 2, y0 + 4, (x1 - x0) / 2 + 12, (y0 - 6) * 0.95, 0, Math.PI, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#9fb6bd";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.fillText("vacuum", (x0 + x1) / 2, y0 - 8);
  } else if (scene.atmosphere === "nitrogen") {
    ctx.fillStyle = "rgba(140,170,255,0.08)";
    ctx.fillRect(x0, y0 - 18, x1 - x0, liquidTop - y0 + 18);
    ctx.fillStyle = "#9fb0e6";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.fillText("N₂ blanket", (x0 + x1) / 2, y0 - 6);
  }

  if (scene.thermal > 0.55) {
    ctx.fillStyle = `rgba(255,110,60,${(scene.thermal - 0.5) * 1.2})`;
    ctx.fillRect(x0 - 6, y1 + 4, x1 - x0 + 12, 5);
  } else if (scene.thermal < 0.15) {
    ctx.fillStyle = "rgba(150,210,255,0.5)";
    ctx.fillRect(x0 - 6, y1 + 4, x1 - x0 + 12, 4);
  }

  ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${tintAlpha})`;
  ctx.fillRect(x0, liquidTop, x1 - x0, y1 - liquidTop);

  const nozzleY = y0 + (y1 - y0) * 0.7;
  const strandEnd = w - 12;
  if (extruding) {
    ctx.fillStyle = "#334447";
    ctx.fillRect(x1, nozzleY - 4, 14, 8);
    if (scene.forming === "extrude-bath") {
      ctx.fillStyle = "rgba(90,169,255,0.12)";
      ctx.fillRect(x1 + 22, nozzleY - 10, strandEnd - x1 - 18, y1 - nozzleY + 10);
      ctx.fillStyle = "#7fa9d8";
      ctx.font = "11px Arial";
      ctx.textAlign = "center";
      ctx.fillText("bath", (x1 + 22 + strandEnd) / 2, y1 - 6);
    }
  }

  const innerW = x1 - x0 - 12;
  const innerH = Math.max(10, y1 - liquidTop - 8);
  const jitter = (1.2 + 5 * scene.thermal) * (1 - 0.85 * bonded) * (scene.finalShape === "block" ? 1 - 0.9 * finalProgress : 1);
  const omega = 2 + 9 * scene.thermal;

  const positions: { x: number; y: number; alpha: number }[] = model.particles.map((particle) => {
    let [x, y] = [lerp(particle.layer[0], particle.uniform[0], mixed), lerp(particle.layer[1], particle.uniform[1], mixed)];
    if (swirl) {
      const u = (x - 0.5) * 2;
      const v = (y - 0.5) * 2;
      const radius = Math.min(1, Math.hypot(u, v));
      const angle = swirl * (0.5 + 0.5 * (1 - radius));
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      x = clamp((u * cos - v * sin) / 2 + 0.5);
      y = clamp((u * sin + v * cos) / 2 + 0.5);
    }
    let alpha = 1;
    for (const item of effects) {
      if (!item.members.has(particle.species) || item.progress <= 0) continue;
      const k = item.progress * item.effect.strength;
      if (item.effect.kind === "clump") {
        const [cx, cy] = CLUSTERS[particle.cluster];
        x = lerp(x, cx, k * 0.8);
        y = lerp(y, cy, k * 0.8);
      } else if (item.effect.kind === "align") {
        y = lerp(y, 0.2 + particle.row * 0.15, k * 0.8);
      } else if (item.effect.kind === "dissolve") {
        x = lerp(x, particle.uniform[0], item.progress);
        y = lerp(y, particle.uniform[1], item.progress);
      }
    }
    if (finalProgress > 0) {
      if (scene.finalShape === "film") {
        x = lerp(x, particle.uniform[0], finalProgress);
        y = lerp(y, 0.75 + particle.rank * 0.25, finalProgress);
      } else if (scene.finalShape === "clumps") {
        const [cx, cy] = CLUSTERS[particle.cluster];
        x = lerp(x, cx, finalProgress * 0.85);
        y = lerp(y, cy, finalProgress * 0.85);
      }
    }
    let px = x0 + 6 + x * innerW + Math.sin(time * omega + particle.phase) * jitter;
    let py = liquidTop + 4 + y * innerH + Math.cos(time * omega * 1.13 + particle.phase2) * jitter;
    if (particle.solvent && evaporation > 0) {
      py -= evaporation * (py - y0 + 60) * particle.rank;
      alpha *= 1 - evaporation * particle.rank;
    }
    if (strandShape && !particle.solvent && finalProgress > 0) {
      const k = ease(clamp(finalProgress * 1.6 - particle.rank * 0.6));
      const sx = lerp(x1 + 14, strandEnd, particle.strand);
      const sy = nozzleY + Math.sin(Math.PI * particle.strand) * 16 * (1 - scene.network * 0.7) + Math.sin(particle.phase) * 1.5;
      px = lerp(px, sx, k);
      py = lerp(py, sy, k);
    }
    if (pour && pourProgress < 1) {
      if (pourProgress < particle.drop) return { x: px, y: -20, alpha: 0 };
      const fall = ease(clamp((pourProgress - particle.drop) / 0.25));
      py = lerp(-10, py, fall);
      alpha *= 0.4 + 0.6 * fall;
    }
    return { x: px, y: py, alpha };
  });

  if (strandShape && finalProgress > 0) {
    ctx.strokeStyle = `rgba(230,240,236,${0.5 * finalProgress})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 30; k += 1) {
      const f = k / 30;
      const sx = lerp(x1 + 14, lerp(x1 + 14, strandEnd, clamp(finalProgress * 1.4)), f);
      const sy = nozzleY + Math.sin(Math.PI * f) * 16 * (1 - scene.network * 0.7) * clamp(finalProgress * 1.4);
      if (k === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  for (const item of bondEffects) {
    if (item.progress <= 0) continue;
    const members = model.particles
      .map((particle, index) => ({ particle, index }))
      .filter(({ particle }) => item.members.has(particle.species))
      .sort((a, b) => a.particle.rank - b.particle.rank);
    const linked = Math.floor(members.length * item.progress * item.effect.strength * (1 - digest));
    ctx.strokeStyle = item.effect.color ? rgba(item.effect.color, 0.55) : "rgba(235,245,240,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let a = 0; a < linked; a += 1) {
      const from = positions[members[a].index];
      if (from.alpha <= 0.1) continue;
      let best = -1;
      let bestDistance = 34 * 34;
      for (const other of members) {
        if (other.index === members[a].index) continue;
        const to = positions[other.index];
        const distance = (to.x - from.x) ** 2 + (to.y - from.y) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = other.index;
        }
      }
      if (best >= 0) {
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(positions[best].x, positions[best].y);
      }
    }
    ctx.stroke();
  }

  model.particles.forEach((particle, index) => {
    const position = positions[index];
    if (position.alpha <= 0.02) return;
    ctx.fillStyle = rgba(particle.color, position.alpha);
    ctx.beginPath();
    ctx.arc(position.x, position.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  });

  let bubbleIntensity = 0;
  for (const item of effects) {
    if (item.effect.kind !== "bubbles" || item.progress <= 0) continue;
    bubbleIntensity = Math.max(bubbleIntensity, item.effect.strength * (item.progress < 1 ? 1 : 0.25));
  }
  if (scene.boiling && t >= (pour?.end ?? 0)) bubbleIntensity = Math.max(bubbleIntensity, 0.8);
  if (scene.atmosphere === "vacuum" && mix && t >= mix.start && t <= mix.end) {
    bubbleIntensity = Math.max(bubbleIntensity, 0.6 * (1 - mixProgress));
  }
  const bubbleCount = Math.floor(model.bubbles.length * clamp(bubbleIntensity));
  const bubbleScale = scene.atmosphere === "vacuum" ? 1.6 : 1;
  ctx.strokeStyle = "rgba(230,245,255,0.6)";
  ctx.lineWidth = 1;
  for (let k = 0; k < bubbleCount; k += 1) {
    const bubble = model.bubbles[k];
    const rise = (time * (0.25 + 0.25 * bubbleScale) + bubble.phase) % 1;
    const bx = x0 + 6 + bubble.x * innerW + Math.sin(time * 3 + bubble.phase * 9) * 2;
    const by = y1 - 4 - rise * (y1 - liquidTop - 6);
    ctx.beginPath();
    ctx.arc(bx, by, bubble.size * bubbleScale, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (scene.finalShape === "foam" && finalProgress > 0) {
    ctx.strokeStyle = `rgba(230,245,255,${0.6 * finalProgress})`;
    model.bubbles.slice(0, 28).forEach((bubble) => {
      ctx.beginPath();
      ctx.arc(x0 + 6 + bubble.x * innerW, liquidTop + 4 + bubble.phase * innerH, bubble.size * 1.4, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  if (mix && scene.stirSpeed > 0 && t >= mix.start && t <= mix.end) {
    const angle = swirl * 6;
    const cx = (x0 + x1) / 2;
    const half = Math.min(26, (x1 - x0) * 0.2) * Math.cos(angle);
    ctx.strokeStyle = "#d6e2df";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - half, y1 - 9);
    ctx.lineTo(cx + half, y1 - 9);
    ctx.stroke();
    ctx.lineCap = "butt";
  }

  for (const item of effects) {
    if (item.progress <= 0 || item.progress >= 1) continue;
    const pulse = Math.sin(Math.PI * item.progress) * item.effect.strength;
    if (item.effect.kind === "heat") {
      ctx.fillStyle = `rgba(255,120,60,${0.28 * pulse})`;
      ctx.fillRect(x0, liquidTop, x1 - x0, y1 - liquidTop);
    } else if (item.effect.kind === "spark") {
      const rand = seededRandom(Math.floor(time * 14) + 1);
      ctx.fillStyle = `rgba(255,224,102,${0.9 * pulse})`;
      for (let k = 0; k < 7; k += 1) {
        ctx.beginPath();
        ctx.arc(x0 + rand() * (x1 - x0), liquidTop + rand() * (y1 - liquidTop), 2 + rand() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (finalProgress > 0) {
    if (scene.finalShape === "gel") {
      ctx.fillStyle = `rgba(73,213,194,${0.12 * finalProgress})`;
      ctx.beginPath();
      ctx.moveTo(x0, y1);
      for (let k = 0; k <= 24; k += 1) {
        const gx = lerp(x0, x1, k / 24);
        ctx.lineTo(gx, liquidTop + Math.sin(k * 0.9 + time * 2) * 2.5 * finalProgress);
      }
      ctx.lineTo(x1, y1);
      ctx.closePath();
      ctx.fill();
    } else if (scene.finalShape === "block") {
      ctx.strokeStyle = `rgba(240,189,105,${0.7 * finalProgress})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 3, liquidTop, x1 - x0 - 6, y1 - liquidTop - 3);
    }
  }

  if (scene.finalShape === "hazard" && t >= reactStart) {
    ctx.strokeStyle = `rgba(250,119,119,${0.5 + 0.5 * Math.sin(time * 8)})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8);
  }

  ctx.strokeStyle = "rgba(190,215,212,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y1);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1, y0);
  ctx.stroke();
}

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds % 60);
    return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
  }
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} h`;
  return `${(seconds / 86400).toFixed(1)} days`;
}

export default function MixViewer({ scene, resultLabel }: { scene: MixScene; resultLabel: string }) {
  const playback = usePlayback(DURATION_SECONDS, scene.finalShape !== "empty");
  const { ref, width } = useCanvasWidth();
  const model = useMemo(() => buildModel(scene), [scene]);
  const { t } = playback;

  useEffect(() => {
    const prepared = prepareCanvas(ref.current, width);
    if (prepared) drawMix(prepared.ctx, prepared.w, prepared.h, scene, model, t);
  }, [ref, width, scene, model, t]);

  const phase = scene.phases.find((item) => t >= item.start && t <= item.end) ?? scene.phases[scene.phases.length - 1];
  const reactStart = scene.phases.find((item) => item.id === "react" || item.id === "set")?.start ?? 1;
  const active = scene.effects
    .filter((effect) => t >= effect.start && t <= effect.end)
    .filter((effect, index, list) => list.findIndex((item) => item.eventId === effect.eventId) === index)
    .slice(0, 2);
  const showBlocked = t >= reactStart && scene.blocked.length > 0;
  const inFinal = phase?.id === "final";

  return (
    <div className="viewer">
      <div className="viewer-stage">
        <canvas ref={ref} role="img" aria-label={`Animation of the experiment: ${phase?.label ?? ""}`} />
        <div className="viewer-hud">
          <div>
            <strong>{phase?.id === "final" ? "Result" : phase?.id ?? ""}</strong>
            {phase?.label}
          </div>
          <div className="viewer-clock">
            <strong>Lab time</strong>
            {formatSeconds(realTimeAt(scene, t))}
          </div>
        </div>
      </div>
      <PlaybackControls playback={playback} label="Experiment" />
      <div className="viewer-captions" aria-live="polite">
        {inFinal && <div className="viewer-caption">Result: {resultLabel}</div>}
        {!inFinal && active.map((effect) => (
          <div className="viewer-caption" key={`${effect.eventId}-${effect.kind}`}>
            {effect.label}
          </div>
        ))}
        {showBlocked &&
          scene.blocked.slice(0, 2).map((item) => (
            <div className="viewer-caption viewer-caption-blocked" key={item.eventId}>
              Didn&apos;t happen: {item.label}
            </div>
          ))}
      </div>
      <div className="viewer-legend">
        {scene.species.map((item) => (
          <span key={item.id}>
            <i style={{ background: item.color }} />
            {item.name}
          </span>
        ))}
      </div>
    </div>
  );
}
