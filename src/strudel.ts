import { initAudio, samples, webaudioRepl } from "@strudel/web";
import type { GuidedParams, Instrument, NotationEvent, PatternPreset, ScaleOption } from "./types";

export const ANALYZER_ID = 1;

export const SCALES: ScaleOption[] = [
  { id: "C_MAJOR", label: "C major", rootMidi: 60, intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: "C_MINOR", label: "C minor", rootMidi: 60, intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: "D_DORIAN", label: "D dorian", rootMidi: 62, intervals: [0, 2, 3, 5, 7, 9, 10] }
];

export const PRESETS: PatternPreset[] = [
  {
    id: "beat-basico",
    label: "Beat basico",
    hint: "Pulso claro, cuatro por compas.",
    rhythm: "x---x---x---x---",
    melodyDegrees: [0, 2, 4, 5, 7, 5, 4, 2],
    drums: {
      bd: "x---x---x---x---",
      sd: "----x-------x---",
      hh: "x-x-x-x-x-x-x-x-"
    }
  },
  {
    id: "arpegio-tonal",
    label: "Arpegio tonal",
    hint: "Movimiento continuo con pequeñas sincopas.",
    rhythm: "x-x---x-x---x-x-",
    melodyDegrees: [0, 2, 4, 7, 5, 4, 2, 0],
    drums: {
      bd: "x-------x-------",
      sd: "----x-------x---",
      hh: "x-x-x-x-x-x-x-x-"
    }
  },
  {
    id: "textura-filtro",
    label: "Textura con filtro",
    hint: "Granos densos, ideal para jugar con cutoff.",
    rhythm: "x-xx--x-xx--x-xx",
    melodyDegrees: [0, 3, 5, 7, 8, 10, 12, 7],
    drums: {
      bd: "x---x---x---x---",
      sd: "--------x-------",
      hh: "xx-xxx-xxx-xxx-x"
    }
  }
];

export const INSTRUMENTS: { id: Instrument; label: string }[] = [
  { id: "drums", label: "Drum kit (bd/sd/hh)" },
  { id: "sine", label: "Sine" },
  { id: "triangle", label: "Triangle" },
  { id: "saw", label: "Saw" },
  { id: "square", label: "Square" },
  { id: "supersaw", label: "Supersaw" }
];

export const DEFAULT_PARAMS: GuidedParams = {
  cps: 1,
  scaleId: "C_MAJOR",
  patternId: "beat-basico",
  instrument: "sine",
  cutoff: 1800,
  room: 0.25
};

const NOTE_NAMES = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
const NOTE_TO_SEMITONE: Record<string, number> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function midiToNoteName(midi: number) {
  const normalized = Math.round(midi);
  const note = NOTE_NAMES[((normalized % 12) + 12) % 12];
  const octave = Math.floor(normalized / 12) - 1;
  return `${note}${octave}`;
}

function noteNameToMidi(note: string) {
  const match = note.trim().match(/^([a-gA-G])([#b]?)(-?\d+)$/);
  if (!match) return undefined;
  const letter = match[1].toLowerCase();
  const accidental = match[2];
  const octave = Number.parseInt(match[3], 10);
  const base = NOTE_TO_SEMITONE[letter];
  if (base === undefined || Number.isNaN(octave)) return undefined;
  const offset = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  return (octave + 1) * 12 + base + offset;
}

function freqToMidi(freq: number) {
  return 69 + 12 * Math.log2(freq / 440);
}

function getPreset(patternId: string) {
  return PRESETS.find((preset) => preset.id === patternId) ?? PRESETS[0];
}

function getScale(scaleId: string) {
  return SCALES.find((scale) => scale.id === scaleId) ?? SCALES[0];
}

function degreeToMidi(degree: number, scale: ScaleOption) {
  const degreeCount = scale.intervals.length;
  const octaveOffset = Math.floor(degree / degreeCount);
  const index = ((degree % degreeCount) + degreeCount) % degreeCount;
  return scale.rootMidi + scale.intervals[index] + 12 * octaveOffset;
}

function buildNotePattern(rhythm: string, degrees: number[], scale: ScaleOption) {
  const steps = rhythm.split("");
  let cursor = 0;
  return steps
    .map((step) => {
      if (step.toLowerCase() === "x") {
        const degree = degrees[cursor % degrees.length] ?? 0;
        const noteName = midiToNoteName(degreeToMidi(degree, scale));
        cursor += 1;
        return noteName;
      }
      return "~";
    })
    .join(" ");
}

function buildDrumPattern(rhythm: string, sample: string) {
  return rhythm
    .split("")
    .map((step) => (step.toLowerCase() === "x" ? sample : "~"))
    .join(" ");
}

export function buildStrudelCode(params: GuidedParams) {
  const preset = getPreset(params.patternId);
  const scale = getScale(params.scaleId);
  const cps = clamp(params.cps, 0.2, 4).toFixed(2);
  const cutoff = Math.round(clamp(params.cutoff, 200, 8000));
  const room = clamp(params.room, 0, 1).toFixed(2);

  if (params.instrument === "drums") {
    const bd = buildDrumPattern(preset.drums.bd, "bd");
    const sd = buildDrumPattern(preset.drums.sd, "sd");
    const hh = buildDrumPattern(preset.drums.hh, "hh");

    return `setcps(${cps})\n\nstack(\n  sound(${JSON.stringify(
      bd
    )}).gain(1),\n  sound(${JSON.stringify(sd)}).gain(0.8),\n  sound(${JSON.stringify(hh)}).gain(0.6)\n)\n  .cutoff(${cutoff})\n  .room(${room})\n  .analyze(${ANALYZER_ID})`;
  }

  const notePattern = buildNotePattern(preset.rhythm, preset.melodyDegrees, scale);

  return `setcps(${cps})\n\nnote(${JSON.stringify(notePattern)})\n  .s(${JSON.stringify(params.instrument)})\n  .cutoff(${cutoff})\n  .room(${room})\n  .gain(0.9)\n  .analyze(${ANALYZER_ID})`;
}

export function createStrudel({ onEvent }: { onEvent: (event: NotationEvent) => void }) {
  void samples("https://strudel.cc/strudel.json").catch(() => {});
  const repl = webaudioRepl({
    editPattern: (pattern) =>
      pattern.onTrigger((hap, _now, cps, time) => {
        const value = hap?.value ?? {};
        const dur = hap?.duration && cps ? hap.duration / cps : 0;
        const sound = value.s ?? value.sound ?? "unknown";

        let midi: number | undefined;
        let note: string | undefined;
        if (typeof value.note === "string") {
          note = value.note;
          midi = noteNameToMidi(note);
        } else if (typeof value.note === "number") {
          midi = value.note;
          note = midiToNoteName(midi);
        } else if (typeof value.n === "number") {
          midi = value.n;
          note = midiToNoteName(midi);
        } else if (typeof value.freq === "number") {
          midi = freqToMidi(value.freq);
          note = midiToNoteName(midi);
        }

        const drum =
          sound === "bd" || sound === "sd" || sound === "hh" ? (sound as "bd" | "sd" | "hh") : undefined;

        onEvent({
          time,
          dur: Math.max(dur, 0.01),
          midi,
          note,
          drum: drum ?? (sound === "unknown" ? undefined : "other"),
          instrument: sound
        });
      }, false)
  });

  async function evaluateAndPlay(code: string) {
    await initAudio();
    await repl.evaluate(code, true, true);
  }

  function stop() {
    repl.stop();
    repl.evaluate("hush()", false, false).catch(() => {});
  }

  return {
    evaluateAndPlay,
    stop
  };
}
