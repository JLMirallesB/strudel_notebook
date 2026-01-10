import { getAnalyzerData } from "@strudel/web";

const MIN_DB = -90;
const MAX_DB = -10;

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

function drawWaveform(ctx: CanvasRenderingContext2D, data: Float32Array) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 2;
  const slice = width / data.length;
  let x = 0;
  for (let i = 0; i < data.length; i += 1) {
    const v = (data[i] + 1) / 2;
    const y = (1 - v) * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += slice;
  }
  ctx.stroke();
}

function drawSpectrum(ctx: CanvasRenderingContext2D, data: Float32Array) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  const barWidth = width / data.length;
  for (let i = 0; i < data.length; i += 1) {
    const magnitude = (data[i] - MIN_DB) / (MAX_DB - MIN_DB);
    const clamped = Math.min(Math.max(magnitude, 0), 1);
    const barHeight = clamped * height;
    ctx.fillStyle = `rgba(255, 149, 0, ${0.2 + clamped * 0.8})`;
    ctx.fillRect(i * barWidth, height - barHeight, Math.max(1, barWidth), barHeight);
  }
}

function drawSpectrogram(ctx: CanvasRenderingContext2D, data: Float32Array) {
  const { width, height } = ctx.canvas;
  ctx.drawImage(ctx.canvas, -1, 0);
  const x = width - 1;
  for (let y = 0; y < height; y += 1) {
    const index = Math.floor((1 - y / height) * (data.length - 1));
    const magnitude = (data[index] - MIN_DB) / (MAX_DB - MIN_DB);
    const clamped = Math.min(Math.max(magnitude, 0), 1);
    const hue = 200 - clamped * 160;
    const lightness = 15 + clamped * 60;
    ctx.fillStyle = `hsl(${hue}, 80%, ${lightness}%)`;
    ctx.fillRect(x, y, 1, 1);
  }
}

export function createAudioViz({
  waveform,
  spectrum,
  spectrogram,
  analyserId
}: {
  waveform: HTMLCanvasElement;
  spectrum: HTMLCanvasElement;
  spectrogram: HTMLCanvasElement;
  analyserId: number;
}) {
  const waveformCtx = waveform.getContext("2d");
  const spectrumCtx = spectrum.getContext("2d");
  const spectrogramCtx = spectrogram.getContext("2d");
  let rafId: number | null = null;

  function draw() {
    if (!waveformCtx || !spectrumCtx || !spectrogramCtx) return;

    resizeCanvasToDisplaySize(waveform);
    resizeCanvasToDisplaySize(spectrum);
    resizeCanvasToDisplaySize(spectrogram);

    const timeData = getAnalyzerData("time", analyserId);
    const freqData = getAnalyzerData("frequency", analyserId);

    if (timeData && freqData) {
      drawWaveform(waveformCtx, timeData);
      drawSpectrum(spectrumCtx, freqData);
      drawSpectrogram(spectrogramCtx, freqData);
    }

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

  return { start, stop };
}
