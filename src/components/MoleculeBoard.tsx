"use client";

import { useRef, useState } from "react";
import { ATOMS, type AtomSymbol } from "@/lib/play/atoms";
import {
  EMPTY_GRAPH,
  addAtom,
  bondBetween,
  cycleBond,
  formula,
  freeValence,
  moveAtom,
  prettyFormula,
  removeAtom,
  type MolAtom,
  type MolGraph,
} from "@/lib/play/molecule";

const W = 360;
const H = 300;
const MARGIN = 26;
const SPOT_ANGLES = [0, 180, 120, 240, 60, 300, 90, 270, 30, 210, 150, 330].map((deg) => (deg * Math.PI) / 180);

function clampPoint(x: number, y: number) {
  return {
    x: Math.min(W - MARGIN, Math.max(MARGIN, x)),
    y: Math.min(H - MARGIN, Math.max(MARGIN, y)),
  };
}

function findSpot(graph: MolGraph, near?: MolAtom) {
  const isFree = (x: number, y: number) =>
    x >= MARGIN && x <= W - MARGIN && y >= MARGIN && y <= H - MARGIN &&
    graph.atoms.every((atom) => Math.hypot(atom.x - x, atom.y - y) >= 48);
  const centers = near ? [{ x: near.x, y: near.y, rings: [66, 100] }] : [{ x: W / 2, y: H / 2, rings: [0, 70, 120] }];
  for (const center of centers) {
    for (const ring of center.rings) {
      for (const angle of ring === 0 ? [0] : SPOT_ANGLES) {
        const x = center.x + Math.cos(angle) * ring;
        const y = center.y + Math.sin(angle) * ring;
        if (isFree(x, y)) return { x, y };
      }
    }
  }
  const step = graph.atoms.length * 37;
  return clampPoint(MARGIN + (step % (W - 2 * MARGIN)), MARGIN + ((step * 7) % (H - 2 * MARGIN)));
}

function bondOffsets(order: number) {
  if (order === 3) return [-6, 0, 6];
  if (order === 2) return [-4, 4];
  return [0];
}

function freeDots(graph: MolGraph, atom: MolAtom, radius: number) {
  const free = freeValence(graph, atom.id);
  if (free <= 0) return null;
  const neighbours = graph.bonds
    .filter((bond) => bond.a === atom.id || bond.b === atom.id)
    .map((bond) => graph.atoms.find((other) => other.id === (bond.a === atom.id ? bond.b : bond.a)))
    .filter((other): other is MolAtom => Boolean(other));
  let base = -Math.PI / 2;
  let spread = (Math.PI * 2) / free;
  if (neighbours.length) {
    const vx = neighbours.reduce((sum, other) => sum + (other.x - atom.x), 0);
    const vy = neighbours.reduce((sum, other) => sum + (other.y - atom.y), 0);
    base = Math.atan2(vy, vx) + Math.PI;
    spread = Math.min(spread, 0.75);
  }
  return Array.from({ length: free }, (_, index) => {
    const angle = base + (index - (free - 1) / 2) * spread;
    return (
      <circle
        key={index}
        className="mol-free-dot"
        cx={Math.cos(angle) * (radius + 7)}
        cy={Math.sin(angle) * (radius + 7)}
        r={2.6}
      />
    );
  });
}

export function MoleculeSvg({
  graph,
  selected,
  showFree = true,
  onAtomDown,
  onBondTap,
}: {
  graph: MolGraph;
  selected?: string | null;
  showFree?: boolean;
  onAtomDown?: (event: React.PointerEvent, id: string) => void;
  onBondTap?: (a: string, b: string) => void;
}) {
  const byId = new Map(graph.atoms.map((atom) => [atom.id, atom]));
  return (
    <>
      {graph.bonds.map((bond) => {
        const a = byId.get(bond.a);
        const b = byId.get(bond.b);
        if (!a || !b) return null;
        const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const px = -(b.y - a.y) / length;
        const py = (b.x - a.x) / length;
        return (
          <g key={`${bond.a}-${bond.b}`}>
            {bondOffsets(bond.order).map((offset) => (
              <line
                key={offset}
                className="mol-bond"
                x1={a.x + px * offset}
                y1={a.y + py * offset}
                x2={b.x + px * offset}
                y2={b.y + py * offset}
              />
            ))}
            {onBondTap && (
              <line
                className="mol-bond-hit"
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onBondTap(bond.a, bond.b);
                }}
              />
            )}
          </g>
        );
      })}
      {graph.atoms.map((atom) => {
        const info = ATOMS[atom.el];
        return (
          <g
            key={atom.id}
            className={`mol-atom${selected === atom.id ? " is-selected" : ""}`}
            transform={`translate(${atom.x} ${atom.y})`}
            onPointerDown={onAtomDown ? (event) => onAtomDown(event, atom.id) : undefined}
          >
            {onAtomDown && <circle r={info.radius + 10} className="mol-atom-hit" />}
            {selected === atom.id && <circle r={info.radius + 5} className="mol-atom-ring" />}
            <circle r={info.radius} fill={info.color} className="mol-atom-body" />
            <text fill={info.textColor} fontSize={info.radius > 19 ? 15 : 13} textAnchor="middle" dominantBaseline="central">
              {atom.el}
            </text>
            {showFree && freeDots(graph, atom, info.radius)}
          </g>
        );
      })}
    </>
  );
}

export function MoleculeDrawing({ graph, label }: { graph: MolGraph; label: string }) {
  if (!graph.atoms.length) return null;
  const xs = graph.atoms.map((atom) => atom.x);
  const ys = graph.atoms.map((atom) => atom.y);
  const pad = 34;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const width = Math.max(...xs) - Math.min(...xs) + pad * 2;
  const height = Math.max(...ys) - Math.min(...ys) + pad * 2;
  return (
    <svg className="mol-drawing" viewBox={`${minX} ${minY} ${width} ${height}`} role="img" aria-label={label}>
      <MoleculeSvg graph={graph} showFree={false} />
    </svg>
  );
}

export default function MoleculeBoard({
  palette,
  onCheck,
  onEdit,
}: {
  palette: AtomSymbol[];
  onCheck: (graph: MolGraph) => void;
  onEdit?: () => void;
}) {
  const [graph, setGraph] = useState<MolGraph>(EMPTY_GRAPH);
  const [history, setHistory] = useState<MolGraph[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; pointerId: number; startX: number; startY: number; moved: boolean } | null>(null);

  function commit(next: MolGraph) {
    if (next === graph) return;
    setHistory((past) => [...past.slice(-40), graph]);
    setGraph(next);
    onEdit?.();
  }

  function toBoard(event: React.PointerEvent) {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return { x: W / 2, y: H / 2 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return clampPoint(point.x, point.y);
  }

  function atomName(id: string) {
    const atom = graph.atoms.find((item) => item.id === id);
    return atom ? ATOMS[atom.el].name : "That atom";
  }

  function tapAtom(id: string) {
    setNotice("");
    if (!selected) {
      setSelected(id);
      return;
    }
    if (selected === id) {
      setSelected(null);
      return;
    }
    toggleBond(selected, id);
  }

  function toggleBond(a: string, b: string) {
    const next = cycleBond(graph, a, b);
    if (next === graph) {
      const full = freeValence(graph, a) <= 0 ? a : b;
      setNotice(`${atomName(full)} already has all the bonds it can make.`);
      return;
    }
    const bond = bondBetween(next, a, b);
    setNotice(bond ? (bond.order === 1 ? "Single bond" : bond.order === 2 ? "Double bond" : "Triple bond") : "Bond removed");
    commit(next);
  }

  function add(el: AtomSymbol) {
    const anchor = selected ? graph.atoms.find((atom) => atom.id === selected) : undefined;
    const canAttach = anchor && freeValence(graph, anchor.id) > 0;
    const spot = findSpot(graph, canAttach ? anchor : undefined);
    let next = addAtom(graph, el, spot.x, spot.y);
    const added = next.atoms[next.atoms.length - 1];
    if (canAttach && added) {
      next = cycleBond(next, anchor.id, added.id);
      setNotice(`${ATOMS[el].name} bonded to the selected ${ATOMS[anchor.el].name.toLowerCase()}.`);
    } else if (anchor) {
      setNotice(`${ATOMS[anchor.el].name} is full, so the new atom was placed on its own.`);
    } else {
      setNotice("");
    }
    commit(next);
  }

  function onAtomDown(event: React.PointerEvent, id: string) {
    event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    drag.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
  }

  function onPointerMove(event: React.PointerEvent) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.moved) {
      if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 7) return;
      current.moved = true;
      setHistory((past) => [...past.slice(-40), graph]);
    }
    const point = toBoard(event);
    setGraph((g) => moveAtom(g, current.id, point.x, point.y));
  }

  function onPointerUp(event: React.PointerEvent) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    if (!current.moved) tapAtom(current.id);
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory(history.slice(0, -1));
    setGraph(previous);
    setSelected(null);
    setNotice("");
    onEdit?.();
  }

  const openBonds = graph.atoms.reduce((sum, atom) => sum + Math.max(0, freeValence(graph, atom.id)), 0);

  return (
    <div className="mol-board">
      <div className="mol-palette" role="group" aria-label="Atoms">
        {palette.map((el) => (
          <button
            key={el}
            type="button"
            className="mol-palette-atom"
            onClick={() => add(el)}
            aria-label={`Add ${ATOMS[el].name}, makes ${ATOMS[el].valence} bond${ATOMS[el].valence === 1 ? "" : "s"}`}
          >
            <span className="mol-palette-dot" style={{ background: ATOMS[el].color, color: ATOMS[el].textColor }}>{el}</span>
            <span className="mol-palette-text">
              <strong>{ATOMS[el].name}</strong>
              <span>{ATOMS[el].valence} bond{ATOMS[el].valence === 1 ? "" : "s"}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mol-stage">
        <svg
          ref={svgRef}
          className="mol-svg"
          viewBox={`0 0 ${W} ${H}`}
          onPointerDown={() => {
            setSelected(null);
            setNotice("");
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
          }}
          role="application"
          aria-label="Molecule board"
        >
          <MoleculeSvg
            graph={graph}
            selected={selected}
            onAtomDown={onAtomDown}
            onBondTap={toggleBond}
          />
          {!graph.atoms.length && (
            <text className="mol-empty" x={W / 2} y={H / 2} textAnchor="middle">
              Tap an atom above to add it
            </text>
          )}
        </svg>
        <p className="mol-readout" aria-live="polite">
          {graph.atoms.length
            ? `On the board: ${prettyFormula(formula(graph))}${openBonds ? ` · ${openBonds} open bond${openBonds === 1 ? "" : "s"} (dots)` : " · every atom is satisfied"}`
            : "Board is empty"}
          {notice && <span className="mol-notice">{notice}</span>}
        </p>
      </div>
      <p className="mol-help">
        Tap an atom to select it, then tap another to bond them. Tap again for a double or triple bond. With an atom
        selected, new atoms snap onto it. Drag to move.
      </p>
      <div className="mol-tools">
        <button type="button" className="button button-secondary" onClick={undo} disabled={!history.length}>Undo</button>
        <button
          type="button"
          className="button button-secondary"
          disabled={!selected}
          onClick={() => {
            if (!selected) return;
            commit(removeAtom(graph, selected));
            setSelected(null);
          }}
        >
          Remove atom
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={!graph.atoms.length}
          onClick={() => {
            commit(EMPTY_GRAPH);
            setSelected(null);
          }}
        >
          Clear
        </button>
        <button type="button" className="button button-primary mol-check" onClick={() => onCheck(graph)} disabled={!graph.atoms.length}>
          Check molecule
        </button>
      </div>
    </div>
  );
}
