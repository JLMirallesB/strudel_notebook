import type { NotationEvent } from "./types";

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
  const { width, height } = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const nextWidth = Math.max(1, Math.floor(width * scale));
  const nextHeight = Math.max(1, Math.floor(height * scale));
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
}

function midiToLabel(midi?: number) {
  if (midi === undefined) return "";
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const note = names[((Math.round(midi) % 12) + 12) % 12];
  const octave = Math.floor(Math.round(midi) / 12) - 1;
  return `${note}${octave}`;
}

export function createNotation({
  canvas,
  getTime,
  cps
}: {
  canvas: HTMLCanvasElement;
  getTime: () => number;
  cps: number;
}) {
  const ctx = canvas.getContext("2d");
  let events: NotationEvent[] = [];
  let mode: "piano" | "drums" = "piano";
  let rafId: number | null = null;
  let currentCps = cps;

  function setCps(next: number) {
    currentCps = next;
  }

  function setMode(next: "piano" | "drums") {
    mode = next;
    clear();
  }

  function pushEvent(event: NotationEvent) {
    events.push(event);
  }

  function clear() {
    events = [];
  }

  function drawGrid(width: number, height: number, secondsPerCycle: number, windowSeconds: number) {
    if (!ctx) return;
    ctx.strokeStyle = "rgba(15, 118, 110, 0.15)";
    ctx.lineWidth = 1;
    const stepsPerCycle = 16;
    const totalSteps = Math.ceil((windowSeconds / secondsPerCycle) * stepsPerCycle);
    for (let i = 0; i <= totalSteps; i += 1) {
      const x = (i / totalSteps) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }

  function drawPianoRoll(width: number, height: number, now: number, windowSeconds: number) {
    if (!ctx) return;
    const timeStart = now - windowSeconds;
    const pitchMin = 48;
    const pitchMax = 84;
    const pitchRange = pitchMax - pitchMin;

    events = events.filter((event) => event.time + event.dur >= timeStart - 0.1);

    for (const event of events) {
      if (event.midi === undefined) continue;
      const x = ((event.time - timeStart) / windowSeconds) * width;
      const w = Math.max((event.dur / windowSeconds) * width, 2);
      const pitchNorm = Math.min(Math.max((event.midi - pitchMin) / pitchRange, 0), 1);
      const y = height - pitchNorm * height - 10;
      ctx.fillStyle = "rgba(245, 158, 11, 0.8)";
      ctx.fillRect(x, y, w, 8);
    }

    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.font = "12px 'IBM Plex Sans', sans-serif";
    ctx.fillText("Now", width - 36, 14);
  }

  function drawDrumRoll(width: number, height: number, now: number, windowSeconds: number) {
    if (!ctx) return;
    const timeStart = now - windowSeconds;
    const lanes = ["hh", "sd", "bd"];
    const laneHeight = height / lanes.length;

    events = events.filter((event) => event.time + event.dur >= timeStart - 0.1);

    for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
      const lane = lanes[laneIndex];
      const y = laneIndex * laneHeight + laneHeight * 0.2;
      ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
      ctx.font = "12px 'IBM Plex Sans', sans-serif";
      ctx.fillText(lane.toUpperCase(), 6, y + 10);
    }

    for (const event of events) {
      const lane = event.drum ?? "other";
      const laneIndex = lanes.indexOf(lane);
      if (laneIndex < 0) continue;
      const x = ((event.time - timeStart) / windowSeconds) * width;
      const w = Math.max((event.dur / windowSeconds) * width, 4);
      const y = laneIndex * laneHeight + laneHeight * 0.4;
      ctx.fillStyle = "rgba(14, 116, 144, 0.85)";
      ctx.fillRect(x, y, w, laneHeight * 0.4);
    }
  }

  function draw() {
    if (!ctx) return;
    resizeCanvasToDisplaySize(canvas);
    const { width, height } = canvas;
    const secondsPerCycle = 1 / Math.max(currentCps, 0.1);
    const windowSeconds = secondsPerCycle * 2;
    const now = getTime();

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(248, 250, 252, 0.6)";
    ctx.fillRect(0, 0, width, height);

    drawGrid(width, height, secondsPerCycle, windowSeconds);

    if (mode === "drums") {
      drawDrumRoll(width, height, now, windowSeconds);
    } else {
      drawPianoRoll(width, height, now, windowSeconds);
    }

    ctx.strokeStyle = "rgba(15, 118, 110, 0.6)";
    ctx.beginPath();
    ctx.moveTo(width - 1, 0);
    ctx.lineTo(width - 1, height);
    ctx.stroke();

    rafId = requestAnimationFrame(draw);
  }

  function start() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(draw);
  }

  function stop() {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  return { pushEvent, start, stop, clear, setMode, setCps };
}

export function eventToLabel(event: NotationEvent) {
  if (event.drum) return event.drum.toUpperCase();
  return event.note ?? midiToLabel(event.midi);
}
