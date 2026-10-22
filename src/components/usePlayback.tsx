"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const;

export function usePlayback(durationSeconds: number, autoplay: boolean) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const [speed, setSpeed] = useState(1);
  const tRef = useRef(0);

  const seek = useCallback((value: number) => {
    const next = Math.min(1, Math.max(0, value));
    tRef.current = next;
    setT(next);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = Math.min(1, tRef.current + (dt * speed) / Math.max(1, durationSeconds));
      tRef.current = next;
      setT(next);
      if (next >= 1) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, durationSeconds]);

  const play = useCallback(() => {
    if (tRef.current >= 1) seek(0);
    setPlaying(true);
  }, [seek]);

  const restart = useCallback(() => {
    seek(0);
    setPlaying(true);
  }, [seek]);

  return { t, playing, speed, setSpeed, play, pause: () => setPlaying(false), restart, seek };
}

export function useCanvasWidth() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.round(entries[0].contentRect.width));
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export function prepareCanvas(canvas: HTMLCanvasElement | null, width: number) {
  if (!canvas || width <= 0) return null;
  const height = canvas.clientHeight || 300;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
  if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, w: width, h: height };
}

export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function PlaybackControls({
  playback,
  label,
}: {
  playback: ReturnType<typeof usePlayback>;
  label: string;
}) {
  return (
    <div className="viewer-controls">
      <button
        type="button"
        className="button button-primary"
        onClick={playback.playing ? playback.pause : playback.play}
        aria-label={playback.playing ? "Pause" : "Play"}
      >
        {playback.playing ? "❚❚" : "▶"}
      </button>
      <button type="button" className="button button-secondary" onClick={playback.restart} aria-label="Restart">
        ↺
      </button>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(playback.t * 1000)}
        onChange={(event) => {
          playback.pause();
          playback.seek(Number(event.target.value) / 1000);
        }}
        aria-label={`${label} timeline`}
      />
      <select
        className="select"
        value={playback.speed}
        onChange={(event) => playback.setSpeed(Number(event.target.value))}
        aria-label="Playback speed"
      >
        {PLAYBACK_SPEEDS.map((value) => (
          <option key={value} value={value}>
            {value}× speed
          </option>
        ))}
      </select>
    </div>
  );
}
