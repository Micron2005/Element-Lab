"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { angleAt, embed3D } from "@/lib/play/geometry3d";
import type { Atom3D } from "@/lib/play/geometry3d";
import type { AtomSymbol } from "@/lib/play/atoms";
import type { MolBond, MolGraph } from "@/lib/play/molecule";
import { useReducedMotion } from "./useReducedMotion";
import { Term } from "./Term";

const SCALE = 100;
const INITIAL_YAW = -0.48;
const INITIAL_PITCH = 0.24;
const COVALENT_RADIUS: Record<AtomSymbol, number> = {
  H: 0.31,
  C: 0.76,
  N: 0.71,
  O: 0.66,
  F: 0.57,
  Cl: 1.02,
  S: 1.05,
  P: 1.07,
};
const ATOMIC_WEIGHT: Record<AtomSymbol, number> = {
  H: 1.008,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  F: 18.998,
  Cl: 35.45,
  S: 32.06,
  P: 30.974,
};
const ATOM_COLORS: Record<AtomSymbol, { light: string; middle: string; dark: string; text: string }> = {
  H: { light: "#ffffff", middle: "#f5f5f5", dark: "#b8bec8", text: "#111827" },
  C: { light: "#a8b0bb", middle: "#4b5563", dark: "#151a21", text: "#ffffff" },
  N: { light: "#a6bdff", middle: "#4169e1", dark: "#1e3270", text: "#ffffff" },
  O: { light: "#ffd0c6", middle: "#ef4444", dark: "#762321", text: "#ffffff" },
  F: { light: "#d1ffb5", middle: "#7ddc5a", dark: "#2e6530", text: "#17220f" },
  Cl: { light: "#a9f4b6", middle: "#22c55e", dark: "#14532d", text: "#102218" },
  S: { light: "#fff4a8", middle: "#facc15", dark: "#82630b", text: "#241f08" },
  P: { light: "#ffd0a3", middle: "#f97316", dark: "#7c3210", text: "#28130a" },
};

function rotate(atom: Atom3D, yaw: number, pitch: number) {
  const yawCos = Math.cos(yaw);
  const yawSin = Math.sin(yaw);
  const pitchCos = Math.cos(pitch);
  const pitchSin = Math.sin(pitch);
  const x = atom.x * yawCos + atom.z * yawSin;
  const depth = -atom.x * yawSin + atom.z * yawCos;
  const y = atom.y * pitchCos - depth * pitchSin;
  const z = atom.y * pitchSin + depth * pitchCos;
  return { x: x * SCALE, y: -y * SCALE, z: z * SCALE };
}

function bondOffsets(order: number) {
  if (order === 3) return [-7, 0, 7];
  if (order === 2) return [-4.5, 4.5];
  return [0];
}

function centerAngle(graph: MolGraph) {
  const byId = new Map(graph.atoms.map((atom, index) => [atom.id, { atom, index }]));
  const neighbors = new Map(graph.atoms.map(({ id }) => [id, [] as string[]]));
  for (const bond of graph.bonds) {
    neighbors.get(bond.a)?.push(bond.b);
    neighbors.get(bond.b)?.push(bond.a);
  }
  const center = graph.atoms
    .map((atom, index) => ({ atom, index, neighbors: neighbors.get(atom.id) ?? [] }))
    .filter((item) => item.neighbors.length >= 2)
    .sort((a, b) =>
      b.neighbors.length - a.neighbors.length ||
      ATOMIC_WEIGHT[b.atom.el] - ATOMIC_WEIGHT[a.atom.el] ||
      a.index - b.index
    )[0];
  if (!center) return null;
  const [aId, bId] = center.neighbors.slice(0, 2);
  if (!byId.has(aId) || !byId.has(bId)) return null;
  return { centerId: center.atom.id, aId, bId };
}

export default function Molecule3D({ graph, label }: { graph: MolGraph; label: string }) {
  const embedded = useMemo(() => embed3D(graph), [graph]);
  const idPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reducedMotion = useReducedMotion();
  const [spinOverride, setSpinOverride] = useState<boolean | null>(null);
  const spinning = spinOverride ?? !reducedMotion;
  const [yaw, setYaw] = useState(INITIAL_YAW);
  const [pitch, setPitch] = useState(INITIAL_PITCH);
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!spinning) return;
    let frame = 0;
    let previous = 0;
    const tick = (time: number) => {
      if (previous > 0) setYaw((current) => current + Math.min(time - previous, 50) * 0.00032);
      previous = time;
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [spinning]);

  const projected = useMemo(() => {
    const rotated = embedded.atoms.map((atom) => ({ atom, ...rotate(atom, yaw, pitch) }));
    const minDepth = Math.min(...rotated.map((atom) => atom.z), 0);
    const maxDepth = Math.max(...rotated.map((atom) => atom.z), 0);
    const depthRange = Math.max(1, maxDepth - minDepth);
    return rotated.map((item) => {
      const depth = (item.z - minDepth) / depthRange;
      const depthScale = 0.9 + depth * 0.12;
      const radius = COVALENT_RADIUS[item.atom.el] * 35 * depthScale;
      return { ...item, depth, radius, opacity: 0.72 + depth * 0.28 };
    });
  }, [embedded, yaw, pitch]);

  const projectedById = new Map(projected.map((atom) => [atom.atom.id, atom]));
  const atomDepth = new Map(projected.map((atom) => [atom.atom.id, atom.z]));
  const drawItems: (
    | { kind: "atom"; depth: number; atom: (typeof projected)[number] }
    | { kind: "bond"; depth: number; bond: MolBond; a: (typeof projected)[number]; b: (typeof projected)[number] }
  )[] = [];
  for (const bond of embedded.bonds) {
    const a = projectedById.get(bond.a);
    const b = projectedById.get(bond.b);
    if (a && b) drawItems.push({ kind: "bond", depth: ((atomDepth.get(bond.a) ?? 0) + (atomDepth.get(bond.b) ?? 0)) / 2, bond, a, b });
  }
  for (const atom of projected) drawItems.push({ kind: "atom", depth: atom.z, atom });
  drawItems.sort((a, b) => a.depth - b.depth);

  const padding = 14;
  const minX = Math.min(...projected.map((atom) => atom.x - atom.radius), 0) - padding;
  const maxX = Math.max(...projected.map((atom) => atom.x + atom.radius), 0) + padding;
  const minY = Math.min(...projected.map((atom) => atom.y - atom.radius), 0) - padding;
  const maxY = Math.max(...projected.map((atom) => atom.y + atom.radius), 0) + padding;
  const viewWidth = Math.max(1, maxX - minX);
  const viewHeight = Math.max(1, maxY - minY);
  const measuredAngle = useMemo(() => {
    const center = centerAngle(graph);
    if (!center) return null;
    return angleAt(embedded, center.centerId, center.aId, center.bId);
  }, [embedded, graph]);

  function rotateFromKeyboard(event: KeyboardEvent<SVGSVGElement>) {
    const turn = 0.14;
    if (event.key === "ArrowLeft") setYaw((current) => current - turn);
    else if (event.key === "ArrowRight") setYaw((current) => current + turn);
    else if (event.key === "ArrowUp") setPitch((current) => Math.max(-Math.PI / 2, current - turn));
    else if (event.key === "ArrowDown") setPitch((current) => Math.min(Math.PI / 2, current + turn));
    else return;
    event.preventDefault();
    setSpinOverride(false);
  }

  function startDrag(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    setSpinOverride(false);
  }

  function moveDrag(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    current.x = event.clientX;
    current.y = event.clientY;
    setYaw((value) => value + dx * 0.012);
    setPitch((value) => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, value + dy * 0.012)));
  }

  function endDrag(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="molecule3d">
      <svg
        className="molecule3d-scene"
        viewBox={`${minX} ${minY} ${viewWidth} ${viewHeight}`}
        role="img"
        tabIndex={0}
        aria-label={`${label} Drag or use arrow keys to rotate`}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={rotateFromKeyboard}
      >
        <defs>
          {projected.map(({ atom }) => {
            const color = ATOM_COLORS[atom.el];
            const gradientId = `${idPrefix}-gradient-${atom.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
            return (
              <radialGradient key={gradientId} id={gradientId} cx="32%" cy="26%" r="76%">
                <stop offset="0%" stopColor={color.light} />
                <stop offset="52%" stopColor={color.middle} />
                <stop offset="100%" stopColor={color.dark} />
              </radialGradient>
            );
          })}
        </defs>
        {drawItems.map((item) => {
          if (item.kind === "bond") {
            const dx = item.b.x - item.a.x;
            const dy = item.b.y - item.a.y;
            const distance = Math.hypot(dx, dy) || 1;
            const ux = dx / distance;
            const uy = dy / distance;
            const px = -uy;
            const py = ux;
            return (
              <g key={`bond-${item.bond.a}-${item.bond.b}`} opacity={0.76 + ((item.a.depth + item.b.depth) / 2) * 0.24}>
                {bondOffsets(item.bond.order).map((offset) => (
                  <line
                    key={offset}
                    x1={item.a.x + ux * item.a.radius + px * offset}
                    y1={item.a.y + uy * item.a.radius + py * offset}
                    x2={item.b.x - ux * item.b.radius + px * offset}
                    y2={item.b.y - uy * item.b.radius + py * offset}
                    stroke="#d7e3e1"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                ))}
              </g>
            );
          }
          const { atom, radius, opacity } = item.atom;
          const color = ATOM_COLORS[atom.el];
          const gradientId = `${idPrefix}-gradient-${atom.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
          return (
            <g key={`atom-${atom.id}`} opacity={opacity}>
              <circle cx={item.atom.x} cy={item.atom.y} r={radius} fill={`url(#${gradientId})`} stroke="rgb(0 0 0 / 45%)" strokeWidth="1.5" />
              <text
                x={item.atom.x}
                y={item.atom.y}
                fill={color.text}
                fontSize={Math.max(11, radius * 0.8)}
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="central"
                pointerEvents="none"
              >
                {atom.el}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="molecule3d-controls">
        <button type="button" className="button button-secondary" aria-pressed={spinning} onClick={() => setSpinOverride(!spinning)}>
          Spin
        </button>
        <button type="button" className="button button-secondary" onClick={() => {
          setYaw(INITIAL_YAW);
          setPitch(INITIAL_PITCH);
        }}>
          Reset view
        </button>
      </div>
      {measuredAngle !== null && (
        <p className="molecule3d-angle">Measured <Term id="bond-angle">bond angle</Term> in the model: {measuredAngle.toFixed(1)}°</p>
      )}
    </div>
  );
}
