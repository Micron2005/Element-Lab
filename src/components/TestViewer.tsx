"use client";

import { useEffect, useState } from "react";
import { fmtTime } from "@/lib/formula";
import type {
  DissolveReport,
  DissolveSetup,
  DropReport,
  DropSetup,
  HeatReport,
  HeatSetup,
  StickReport,
  StickSetup,
  StretchReport,
  StretchSetup,
} from "@/lib/bench/materialTests";
import { wrapCaption } from "@/lib/bench/svgText";
import { usePlayback } from "./usePlayback";

export type TestViewerData =
  | { type: "stretch"; setup: StretchSetup; report: StretchReport }
  | { type: "heat"; setup: HeatSetup; report: HeatReport }
  | { type: "dissolve"; setup: DissolveSetup; report: DissolveReport }
  | { type: "stick"; setup: StickSetup; report: StickReport }
  | { type: "drop"; setup: DropSetup; report: DropReport };

function Caption({
  x,
  y,
  fill,
  text,
  fontSize = 10,
  maxChars = 50,
  lineHeight = fontSize * 1.2,
  textAnchor,
  opacity,
}: {
  x: number;
  y: number;
  fill: string;
  text: string;
  fontSize?: number;
  maxChars?: number;
  lineHeight?: number;
  textAnchor?: "start" | "middle" | "end";
  opacity?: number;
}) {
  const lines = wrapCaption(text, maxChars, 2);
  return (
    <text
      x={x}
      y={y}
      fill={fill}
      fontSize={fontSize}
      textAnchor={textAnchor}
      opacity={opacity}
    >
      {lines.map((line, index) => (
        <tspan key={index} x={x} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function StretchScene({
  progress,
  data,
}: {
  progress: number;
  data: Extract<TestViewerData, { type: "stretch" }>;
}) {
  const flow = data.report.flows;
  const snap = !flow && progress >= 0.78;
  const distance = 50 * (1 + 3 * Math.min(1, progress * 1.35));
  const left = 160 - distance / 2;
  const right = 160 + distance / 2;
  const thinning = Math.max(2, 9 - progress * 5);
  const curve = data.report.curve;
  const maxStress = Math.max(0.01, ...curve.map((point) => point.stressMPa));
  const curvePath = curve
    .map((point, index) => {
      const x = 24 + (index / Math.max(1, curve.length - 1)) * 272;
      const y = 164 - (point.stressMPa / maxStress) * 30;
      return `${index ? "L" : "M"} ${x} ${y}`;
    })
    .join(" ");
  return (
    <>
      <rect x="0" y="0" width="320" height="180" rx="12" fill="#0a1519" />
      <Caption x={16} y={20} fill="#a9c0c4" text="STRETCH RIG" />
      <rect x={left - 12} y="48" width="12" height="48" rx="3" fill="#71878a" />
      <rect x={right} y="48" width="12" height="48" rx="3" fill="#71878a" />
      <path
        d={flow
          ? `M ${left} 72 Q 160 ${112 + progress * 10} ${right} 72`
          : snap
            ? `M ${left} 72 L ${160 - 6} 72 M ${160 + 6} 72 L ${right} 72`
            : `M ${left} 72 L ${right} 72`}
        fill="none"
        stroke="#5fd4c4"
        strokeWidth={thinning}
        strokeLinecap="round"
      />
      {snap && (
        <path d="M 148 68 l-5 -7 M 172 76 l5 7" stroke="#ffd176" strokeWidth="2" />
      )}
      <Caption
        x={16}
        y={116}
        fill="#d7e3e4"
        text={flow ? "Slow pull: thinning flow" : snap ? "Strand snapped" : "Pulling"}
      />
      <path d="M 22 168 H 298 M 22 130 V 168" stroke="#53676c" strokeWidth="1" />
      <path
        d={curvePath}
        fill="none"
        stroke="#f0bd69"
        strokeWidth="2.5"
        strokeDasharray="360"
        strokeDashoffset={360 * (1 - progress)}
      />
      <Caption x={25} y={126} fill="#93a8ad" fontSize={9} text="Stress–strain" />
    </>
  );
}

function HeatScene({
  progress,
  data,
}: {
  progress: number;
  data: Extract<TestViewerData, { type: "heat" }>;
}) {
  const temperature = Math.round(data.setup.maxTempC * progress);
  const current = data.report.events
    .filter((event) => event.tempC <= temperature)
    .at(-1);
  const kind = current?.kind;
  const darkened = kind === "decompose" || kind === "burn";
  const melted = kind === "melt";
  const softened = kind === "soften";
  const evaporating = kind === "evaporate";
  const sampleScale = evaporating ? Math.max(0.4, 1 - progress * 0.45) : 1;
  const sampleWidth = 82 * sampleScale;
  const sampleHeight = 44 * sampleScale;
  const liquidY = melted ? 102 : 68;
  const fill = darkened ? "#393738" : softened ? "#83a99c" : "#b6d5c8";
  return (
    <>
      <rect x="0" y="0" width="320" height="180" rx="12" fill="#0a1519" />
      <Caption
        x={16}
        y={20}
        fill="#a9c0c4"
        text={`HEAT TEST · ${temperature} °C`}
      />
      <rect x="62" y="126" width="174" height="12" rx="3" fill="#43575b" />
      <rect x="78" y="138" width="142" height="8" rx="3" fill="#26373b" />
      {!melted && (
        <rect
          x="119"
          y={softened ? liquidY + 12 : liquidY + 44 - sampleHeight}
          width={sampleWidth}
          height={softened ? sampleHeight * 0.8 : sampleHeight}
          rx={softened ? 14 : 5}
          fill={fill}
          transform={`translate(${160 - sampleWidth / 2 - 119} 0)${softened ? " rotate(7 160 90)" : ""}`}
        />
      )}
      {melted && <path d="M 118 108 Q 160 92 202 108 L 196 120 H 124 Z" fill={fill} />}
      {(kind === "evaporate" || kind === "gas") && (
        <>
          <path d="M 136 58 Q 127 48 136 39 M 158 55 Q 150 45 160 34 M 181 58 Q 175 47 184 39" fill="none" stroke="#9ccbd0" strokeWidth="2" />
          <circle cx="212" cy="52" r="4" fill="#91c8ce" opacity={progress} />
        </>
      )}
      {kind === "burn" && (
        <path d="M 144 104 Q 134 86 150 74 Q 148 91 162 93 Q 170 80 172 68 Q 190 89 178 105 Z" fill="#f08a4b" />
      )}
      <rect x="252" y="42" width="10" height="77" rx="5" fill="#293e43" stroke="#71898d" />
      <rect x="255" y={111 - 62 * progress} width="4" height={8 + 62 * progress} rx="2" fill="#ef735d" />
      <circle cx="257" cy="120" r="8" fill="#ef735d" />
      <Caption
        x={272}
        y={76}
        fill="#e0edef"
        text={`${temperature}°`}
        maxChars={8}
      />
      <Caption
        x={16}
        y={151}
        fill="#c5d4d5"
        text={current?.text ?? "Warming the sample"}
        lineHeight={12}
      />
    </>
  );
}

function DissolveScene({
  progress,
  data,
}: {
  progress: number;
  data: Extract<TestViewerData, { type: "dissolve" }>;
}) {
  const { report, setup } = data;
  const colors = {
    water: "#4c9bb2",
    "salt-water": "#50afa6",
    acidic: "#ca8057",
    alkaline: "#9472bb",
  };
  const dissolves = report.verdict === "dissolves";
  const swells = report.verdict === "swells";
  const size = dissolves
    ? Math.max(2, 34 * (1 - 0.94 * progress))
    : swells
      ? 34 * (1 + 0.45 * progress)
      : 34;
  const elapsed = (report.timeSeconds ?? 0) * progress;
  const elapsedText =
    elapsed > 7 * 24 * 60 * 60 ? "more than a week" : fmtTime(elapsed);
  return (
    <>
      <rect x="0" y="0" width="320" height="180" rx="12" fill="#0a1519" />
      <Caption
        x={16}
        y={20}
        fill="#a9c0c4"
        text={`DISSOLVE · ${setup.liquid.replace("-", " ")}`}
      />
      <path d="M 92 44 H 228 M 106 44 V 146 Q 106 160 120 160 H 200 Q 214 160 214 146 V 44" fill="none" stroke="#91afb4" strokeWidth="4" strokeLinejoin="round" />
      <path d="M 110 90 H 210 V 146 Q 210 156 198 156 H 122 Q 110 156 110 146 Z" fill={colors[setup.liquid]} opacity="0.46" />
      {size > 4 && (
        <rect
          x={160 - size / 2}
          y={107 - size / 2}
          width={size}
          height={size}
          rx={swells ? size / 3 : 4}
          fill="#d6c18b"
          opacity={dissolves ? 1 - progress * 0.65 : 1}
        />
      )}
      {dissolves && progress > 0.5 && (
        <>
          <circle cx="139" cy="108" r="3" fill="#d6c18b" opacity={1 - progress} />
          <circle cx="183" cy="119" r="2" fill="#d6c18b" opacity={1 - progress} />
        </>
      )}
      <Caption
        x={16}
        y={36}
        fill="#d7e3e4"
        text={`${setup.tempC} °C · ${setup.stirred ? "stirred" : "still"}`}
      />
      <Caption
        x={16}
        y={174}
        fill="#c5d4d5"
        text={report.timeSeconds === null ? "No change" : `Elapsed: ${elapsedText}`}
      />
      <Caption
        x={240}
        y={155}
        fill="#b7cacc"
        fontSize={9}
        maxChars={12}
        text={dissolves ? "dissolving" : swells ? "swelling" : "unchanged"}
      />
    </>
  );
}

function StickScene({
  progress,
  data,
}: {
  progress: number;
  data: Extract<TestViewerData, { type: "stick" }>;
}) {
  const detaches = data.report.verdict === "weak" || data.report.verdict === "no-stick";
  const dropProgress = Math.min(1, progress / 0.3);
  const easedDrop = 1 - (1 - dropProgress) ** 3;
  const bounce =
    progress >= 0.3 && progress <= 0.54
      ? 4 * Math.sin(((progress - 0.3) / 0.24) * Math.PI)
      : 0;
  const heldY = 94 + 18 * easedDrop + bounce;
  const releaseProgress = Math.max(0, Math.min(1, (progress - 0.55) / 0.4));
  const weightY = detaches ? heldY - bounce + 24 * releaseProgress : heldY;
  const split = data.report.cohesiveFailure && progress > 0.65;
  const surface = data.setup.surface === "ptfe" ? "#566b70" : "#79878a";
  const labelOpacity = Math.max(0, Math.min(1, (progress - 0.18) / 0.2));
  return (
    <>
      <rect x="0" y="0" width="320" height="180" rx="12" fill="#0a1519" />
      <Caption
        x={16}
        y={20}
        fill="#a9c0c4"
        text={`STICK TEST · ${data.setup.surface.toUpperCase()}`}
      />
      <Caption
        x={16}
        y={34}
        fill="#c5d4d5"
        text={detaches ? "Bond releases" : split ? "Tears inside the sample" : "Pulling on the bond"}
      />
      <rect x="42" y="75" width="236" height="15" rx="4" fill={surface} />
      <rect x="105" y="63" width="110" height="13" rx="4" fill="#5fd4c4" />
      {split && <path d="M 160 62 L 154 69 L 163 76 L 157 83" fill="none" stroke="#1f3438" strokeWidth="3" />}
      <path d={`M 160 90 V ${weightY}`} stroke="#c5d4d5" strokeWidth="2" />
      {detaches && <path d="M 91 169 H 229" stroke="#71878a" strokeWidth="2" />}
      <rect x="137" y={weightY} width="46" height="32" rx="5" fill="#d6a965" />
      <Caption
        x={160}
        y={weightY + 20}
        fill="#171c1d"
        fontSize={9}
        maxChars={12}
        textAnchor="middle"
        opacity={labelOpacity}
        text={`${data.report.holdsKg.toPrecision(2)} kg`}
      />
    </>
  );
}

function DropScene({
  progress,
  data,
}: {
  progress: number;
  data: Extract<TestViewerData, { type: "drop" }>;
}) {
  const floorY = 140;
  const impactAt = 0.62;
  const falling = Math.min(1, progress / impactAt);
  const bounceProgress = Math.max(0, (progress - impactAt) / (1 - impactAt));
  const bounceRatio = Math.min(1, (data.report.bounceM ?? 0) / data.setup.heightM);
  const bounceHeight = 75 * bounceRatio * Math.sin(Math.PI * bounceProgress);
  const y = progress <= impactAt ? 26 + (floorY - 18 - 26) * falling : floorY - 18 - bounceHeight;
  const splat = data.report.verdict === "splats" || data.report.verdict === "splashes";
  const broken = data.report.verdict === "breaks" || data.report.verdict === "scatters";
  const cracked = data.report.verdict === "cracks";
  const radius = splat && progress > impactAt ? 18 + bounceProgress * 18 : 17;
  return (
    <>
      <rect x="0" y="0" width="320" height="180" rx="12" fill="#0a1519" />
      <Caption
        x={16}
        y={20}
        fill="#a9c0c4"
        text={`DROP · ${data.setup.heightM} m · ${data.setup.floor.toUpperCase()} FLOOR`}
      />
      <rect x="40" y={floorY} width="240" height="9" rx="3" fill={data.setup.floor === "hard" ? "#71878a" : "#496b58"} />
      {broken && progress > impactAt ? (
        <>
          <path d={`M 140 ${floorY - 3} l-17 -22 l10 3 l-5 -15 l21 22 Z`} fill="#c7b48f" />
          <path d={`M 173 ${floorY - 3} l19 -25 l-9 4 l5 -14 l-23 25 Z`} fill="#c7b48f" />
          <circle cx="126" cy={floorY - 8} r="3" fill="#d9c9a9" />
          <circle cx="199" cy={floorY - 10} r="3" fill="#d9c9a9" />
        </>
      ) : splat && progress > impactAt ? (
        <>
          <ellipse cx="160" cy={floorY - 4} rx={radius} ry="9" fill="#5fd4c4" />
          {data.report.verdict === "splashes" && (
            <path d={`M 137 ${floorY - 5} l-5 -13 M 184 ${floorY - 6} l6 -13 M 160 ${floorY - 8} v-18`} stroke="#79cfe0" strokeWidth="4" strokeLinecap="round" />
          )}
        </>
      ) : (
        <circle cx="160" cy={y} r="17" fill={data.report.verdict === "survives" ? "#5fd4c4" : "#d6bd8a"} />
      )}
      {cracked && progress > impactAt && (
        <path d={`M 160 ${floorY - 26} l-5 10 l8 4 l-7 12`} fill="none" stroke="#263639" strokeWidth="3" />
      )}
      <Caption
        x={16}
        y={153}
        fill="#c5d4d5"
        text={progress <= impactAt ? "Falling" : data.report.headline}
        lineHeight={12}
      />
    </>
  );
}

export default function TestViewer({ data }: { data: TestViewerData }) {
  const playback = usePlayback(2.5, true);
  const seek = playback.seek;
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyPreference = () => {
      setReducedMotion(query.matches);
      if (query.matches) seek(1);
    };
    applyPreference();
    query.addEventListener("change", applyPreference);
    return () => query.removeEventListener("change", applyPreference);
  }, [seek]);

  const replay = () => {
    if (reducedMotion) playback.seek(1);
    else playback.restart();
  };

  return (
    <div className="bench-test-viewer">
      <svg
        className="bench-test-visual"
        viewBox="0 0 320 180"
        role="img"
        aria-label={`${data.type} test animation`}
      >
        <title>{data.type} test model visual</title>
        {data.type === "stretch" && <StretchScene progress={playback.t} data={data} />}
        {data.type === "heat" && <HeatScene progress={playback.t} data={data} />}
        {data.type === "dissolve" && <DissolveScene progress={playback.t} data={data} />}
        {data.type === "stick" && <StickScene progress={playback.t} data={data} />}
        {data.type === "drop" && <DropScene progress={playback.t} data={data} />}
      </svg>
      <div className="bench-test-viewer-controls">
        <button type="button" className="button button-secondary" onClick={replay}>
          Replay
        </button>
        <span aria-live="polite">{reducedMotion ? "End state shown" : playback.playing ? "Playing" : "Animation complete"}</span>
      </div>
    </div>
  );
}
