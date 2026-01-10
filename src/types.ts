export type Instrument = "drums" | "sine" | "triangle" | "saw" | "square" | "supersaw";

export type GuidedParams = {
  cps: number;
  scaleId: string;
  patternId: string;
  instrument: Instrument;
  cutoff: number;
  room: number;
};

export type PatternPreset = {
  id: string;
  label: string;
  hint: string;
  rhythm: string;
  melodyDegrees: number[];
  drums: {
    bd: string;
    sd: string;
    hh: string;
  };
};

export type ScaleOption = {
  id: string;
  label: string;
  rootMidi: number;
  intervals: number[];
};

export type NotationEvent = {
  time: number;
  dur: number;
  midi?: number;
  note?: string;
  drum?: "bd" | "sd" | "hh" | "other";
  instrument: string;
};
