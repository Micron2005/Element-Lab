"use client";

import { useEffect } from "react";
import type { jet } from "@/lib/physics";
import type { ShotSetup } from "@/lib/bench/shootTest";
import { PlaybackControls, prepareCanvas, useCanvasWidth, usePlayback } from "./usePlayback";
import "./viewer.css";

type JetResult = ReturnType<typeof jet>;

const GRAVITY = 9.81;
const NOZZLE_HEIGHT_M = 1.5;

function drawShot(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  setup: ShotSetup,
  result: JetResult,
  setSeconds: number,
  progress: number,
  twoPart?: { ratioA: number; ratioB: number },
) {
  const left = 26;
  const right = width - 26;
  const top = twoPart ? 104 : 80;
  const bottom = height - 28;
  const horizontalScale = Math.max(1, right - left) / setup.distanceM;
  const verticalScale = Math.max(1, bottom - top) / NOZZLE_HEIGHT_M;
  const scale = Math.min(horizontalScale, verticalScale);
  const nozzleX = left;
  const targetX = nozzleX + setup.distanceM * scale;
  const nozzleY = top;
  const groundY = nozzleY + NOZZLE_HEIGHT_M * scale;
  const flightTime = result.flightS * progress;
  const groundTime = Math.sqrt((2 * NOZZLE_HEIGHT_M) / GRAVITY);
  const hitsGround = result.dropM > NOZZLE_HEIGHT_M;
  const impactDistance = Math.min(setup.distanceM, setup.speedMs * groundTime);
  const travelLimit = hitsGround ? impactDistance : setup.distanceM;
  const frontDistance = Math.min(travelLimit, setup.speedMs * flightTime);
  const breakupDistance = Math.min(result.breakupM, frontDistance);

  const pointAt = (distance: number) => {
    const time = distance / setup.speedMs;
    return {
      x: nozzleX + distance * scale,
      y: nozzleY + 0.5 * GRAVITY * time * time * scale,
      time,
    };
  };

  ctx.fillStyle = "#0b1214";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(190,215,212,0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(12, groundY);
  ctx.lineTo(width - 12, groundY);
  ctx.stroke();

  ctx.fillStyle = "#8ea5a5";
  ctx.fillRect(targetX - 3, groundY - 1.5 * scale, 6, 1.5 * scale);
  ctx.fillStyle = "#c6d5d2";
  ctx.font = "11px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Target", targetX, groundY - 1.5 * scale - 8);

  ctx.fillStyle = "#9aaeb0";
  ctx.fillRect(nozzleX - 15, nozzleY - 5, 18, 10);
  ctx.fillStyle = "#d7e4e2";
  ctx.fillRect(nozzleX, nozzleY - 2, 12, 4);
  ctx.font = "11px Arial";
  ctx.textAlign = "left";
  ctx.fillText("nozzle", nozzleX - 12, nozzleY - 12);

  ctx.lineCap = "round";
  let strandStart = 0;
  if (twoPart) {
    const ratioTotal = twoPart.ratioA + twoPart.ratioB;
    const shareA = ratioTotal > 0 ? twoPart.ratioA / ratioTotal : 0.5;
    const shareB = ratioTotal > 0 ? twoPart.ratioB / ratioTotal : 0.5;
    const fullWidth = Math.max(2, setup.nozzleMm * 2);
    const convergenceDistance = Math.min(
      setup.distanceM * 0.08,
      30 / scale,
    );
    const separation = Math.max(4, fullWidth * 0.75);
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(3, fullWidth * shareA);
    ctx.strokeStyle = "#5fd4c4";
    ctx.beginPath();
    ctx.moveTo(nozzleX + 12, nozzleY - 3);
    ctx.lineTo(nozzleX + 32, nozzleY - 3);
    ctx.stroke();
    ctx.lineWidth = Math.max(3, fullWidth * shareB);
    ctx.strokeStyle = "#f0bd69";
    ctx.beginPath();
    ctx.moveTo(nozzleX + 12, nozzleY + 3);
    ctx.lineTo(nozzleX + 32, nozzleY + 3);
    ctx.stroke();
    ctx.restore();
    const feedDistance = Math.min(breakupDistance, convergenceDistance);
    const feedSegments = Math.max(1, Math.ceil(feedDistance * scale / 3));
    const drawFeed = (share: number, sign: number, color: string) => {
      for (let index = 0; index < feedSegments; index += 1) {
        const start = (feedDistance * index) / feedSegments;
        const end = (feedDistance * (index + 1)) / feedSegments;
        const from = pointAt(start);
        const to = pointAt(end);
        const offsetScale = convergenceDistance > 0
          ? Math.max(0, 1 - start / convergenceDistance)
          : 0;
        const endOffsetScale = convergenceDistance > 0
          ? Math.max(0, 1 - end / convergenceDistance)
          : 0;
        from.y += sign * separation * offsetScale;
        to.y += sign * separation * endOffsetScale;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(3, fullWidth * share);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    };
    drawFeed(shareA, -1, "#5fd4c4");
    drawFeed(shareB, 1, "#f0bd69");
    strandStart = convergenceDistance;
  }
  const segments = Math.max(
    1,
    Math.ceil((breakupDistance - strandStart) * scale / 3),
  );
  for (let index = 0; index < segments; index += 1) {
    const start =
      strandStart + ((breakupDistance - strandStart) * index) / segments;
    const end =
      strandStart + ((breakupDistance - strandStart) * (index + 1)) / segments;
    const from = pointAt(start);
    const to = pointAt(end);
    ctx.strokeStyle =
      setSeconds > 0 && from.time >= setSeconds ? "#ffd28a" : "#84d2f5";
    ctx.lineWidth = Math.max(2, setup.nozzleMm * 2);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
  ctx.lineCap = "butt";

  if (frontDistance > result.breakupM) {
    const droplets = Math.max(1, Math.floor((frontDistance - result.breakupM) * 3));
    for (let index = 0; index < droplets; index += 1) {
      const distance =
        result.breakupM +
        ((frontDistance - result.breakupM) * (index + 0.5)) / droplets;
      const point = pointAt(distance);
      const offset = Math.sin(index * 12.9898 + 1.7) * 5;
      ctx.fillStyle =
        setSeconds > 0 && point.time >= setSeconds ? "#fff0ca" : "#b5e7fb";
      ctx.beginPath();
      ctx.arc(point.x, point.y + offset, 1.5 + (index % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const finished = progress >= 1;
  if (finished) {
    const impact = hitsGround
      ? pointAt(impactDistance)
      : pointAt(setup.distanceM);
    ctx.strokeStyle = hitsGround ? "#f0bd69" : "#b5e7fb";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(impact.x, impact.y, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.textAlign = "right";
  ctx.fillStyle = "#a8bfbd";
  ctx.fillText(`${setup.distanceM} m`, width - 14, groundY + 18);
}

export default function JetViewer({
  setup,
  result,
  setSeconds,
  twoPart,
}: {
  setup: ShotSetup;
  result: JetResult;
  setSeconds: number;
  twoPart?: { ratioA: number; ratioB: number };
}) {
  const playback = usePlayback(4, true);
  const { ref, width } = useCanvasWidth();

  useEffect(() => {
    const prepared = prepareCanvas(ref.current, width);
    if (prepared) {
      drawShot(
        prepared.ctx,
        prepared.w,
        prepared.h,
        setup,
        result,
        setSeconds,
        playback.t,
        twoPart,
      );
    }
  }, [playback.t, ref, result, setSeconds, setup, twoPart, width]);

  const groundDistance =
    result.dropM > NOZZLE_HEIGHT_M
      ? Math.min(setup.distanceM, setup.speedMs * Math.sqrt((2 * NOZZLE_HEIGHT_M) / GRAVITY))
      : null;
  const realTime = result.flightS * playback.t;

  return (
    <div className="viewer">
      <div className="viewer-stage">
        <canvas ref={ref} role="img" aria-label="Nozzle shot trajectory with sag and breakup" />
        <div className="viewer-hud">
          <div>
            <strong>Shot path</strong>
            Gravity bends the strand downward
            {twoPart && <span className="viewer-two-part-label">A + B mix at tip</span>}
          </div>
          <div className="viewer-clock">
            <strong>Real time</strong>
            {realTime.toFixed(2)} s / {result.flightS.toFixed(2)} s
          </div>
        </div>
      </div>
      <PlaybackControls playback={playback} label="Shot" />
      {groundDistance !== null && (
        <p className="viewer-caption">Hits the ground at {groundDistance.toFixed(1)} m.</p>
      )}
    </div>
  );
}
