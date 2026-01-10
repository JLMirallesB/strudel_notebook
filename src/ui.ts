import { buildStrudelCode, INSTRUMENTS, PRESETS, SCALES } from "./strudel";
import type { GuidedParams, Instrument } from "./types";

const STORAGE_KEYS = {
  intention: "strudel-guided-intention",
  log: "strudel-guided-log"
};

type UpdateOptions = {
  live: boolean;
};

type Handlers = {
  defaultParams: GuidedParams;
  onPlay: (params: GuidedParams) => void;
  onStop: () => void;
  onParamsUpdate: (params: GuidedParams, options: UpdateOptions) => void;
  onInstrumentChange: (instrument: Instrument) => void;
  onCpsChange: (cps: number) => void;
  onReset: (params: GuidedParams, options: UpdateOptions) => void;
};

export function setupUI(handlers: Handlers) {
  const cpsInput = document.getElementById("cps") as HTMLInputElement;
  const cpsValue = document.getElementById("cpsValue") as HTMLDivElement;
  const scaleSelect = document.getElementById("scale") as HTMLSelectElement;
  const patternSelect = document.getElementById("pattern") as HTMLSelectElement;
  const patternHint = document.getElementById("patternHint") as HTMLDivElement;
  const instrumentSelect = document.getElementById("instrument") as HTMLSelectElement;
  const cutoffInput = document.getElementById("cutoff") as HTMLInputElement;
  const cutoffValue = document.getElementById("cutoffValue") as HTMLDivElement;
  const roomInput = document.getElementById("room") as HTMLInputElement;
  const roomValue = document.getElementById("roomValue") as HTMLDivElement;
  const playBtn = document.getElementById("playBtn") as HTMLButtonElement;
  const stopBtn = document.getElementById("stopBtn") as HTMLButtonElement;
  const resetBtn = document.getElementById("resetBtn") as HTMLButtonElement;
  const midiToggle = document.getElementById("midiToggle") as HTMLInputElement;
  const midiStatus = document.getElementById("midiStatus") as HTMLSpanElement;
  const intentionInput = document.getElementById("intention") as HTMLInputElement;
  const logInput = document.getElementById("log") as HTMLTextAreaElement;
  const codePreview = document.getElementById("codePreview") as HTMLPreElement;

  let params = { ...handlers.defaultParams };
  let isPlaying = false;
  let midiAccess: MIDIAccess | null = null;
  let midiInput: MIDIInput | null = null;

  function updatePreview() {
    codePreview.textContent = buildStrudelCode(params);
  }

  function updateCpsDisplay(value: number) {
    const bpm = Math.round(value * 60);
    cpsValue.textContent = `${value.toFixed(2)} cps (${bpm} bpm)`;
  }

  function updateCutoffDisplay(value: number) {
    cutoffValue.textContent = `${Math.round(value)} Hz`;
  }

  function updateRoomDisplay(value: number) {
    roomValue.textContent = `${value.toFixed(2)}`;
  }

  function applyParamsToUI() {
    cpsInput.value = params.cps.toString();
    scaleSelect.value = params.scaleId;
    patternSelect.value = params.patternId;
    instrumentSelect.value = params.instrument;
    cutoffInput.value = params.cutoff.toString();
    roomInput.value = params.room.toString();
    updateCpsDisplay(params.cps);
    updateCutoffDisplay(params.cutoff);
    updateRoomDisplay(params.room);

    const preset = PRESETS.find((item) => item.id === params.patternId);
    patternHint.textContent = preset?.hint ?? "";

    updatePreview();
  }

  function emitUpdate() {
    handlers.onParamsUpdate(params, { live: isPlaying });
    updatePreview();
  }

  SCALES.forEach((scale) => {
    const option = document.createElement("option");
    option.value = scale.id;
    option.textContent = scale.label;
    scaleSelect.appendChild(option);
  });

  PRESETS.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.label;
    patternSelect.appendChild(option);
  });

  INSTRUMENTS.forEach((instrument) => {
    const option = document.createElement("option");
    option.value = instrument.id;
    option.textContent = instrument.label;
    instrumentSelect.appendChild(option);
  });

  cpsInput.addEventListener("input", () => {
    params.cps = Number.parseFloat(cpsInput.value);
    updateCpsDisplay(params.cps);
    handlers.onCpsChange(params.cps);
    emitUpdate();
  });

  scaleSelect.addEventListener("change", () => {
    params.scaleId = scaleSelect.value;
    emitUpdate();
  });

  patternSelect.addEventListener("change", () => {
    params.patternId = patternSelect.value;
    const preset = PRESETS.find((item) => item.id === params.patternId);
    patternHint.textContent = preset?.hint ?? "";
    emitUpdate();
  });

  instrumentSelect.addEventListener("change", () => {
    params.instrument = instrumentSelect.value as Instrument;
    handlers.onInstrumentChange(params.instrument);
    emitUpdate();
  });

  cutoffInput.addEventListener("input", () => {
    params.cutoff = Number.parseFloat(cutoffInput.value);
    updateCutoffDisplay(params.cutoff);
    emitUpdate();
  });

  roomInput.addEventListener("input", () => {
    params.room = Number.parseFloat(roomInput.value);
    updateRoomDisplay(params.room);
    emitUpdate();
  });

  playBtn.addEventListener("click", () => {
    isPlaying = true;
    playBtn.disabled = true;
    stopBtn.disabled = false;
    handlers.onPlay(params);
  });

  stopBtn.addEventListener("click", () => {
    isPlaying = false;
    playBtn.disabled = false;
    stopBtn.disabled = true;
    handlers.onStop();
  });

  resetBtn.addEventListener("click", () => {
    params = { ...handlers.defaultParams };
    applyParamsToUI();
    handlers.onInstrumentChange(params.instrument);
    handlers.onCpsChange(params.cps);
    handlers.onReset(params, { live: isPlaying });
  });

  intentionInput.value = localStorage.getItem(STORAGE_KEYS.intention) ?? "";
  logInput.value = localStorage.getItem(STORAGE_KEYS.log) ?? "";

  intentionInput.addEventListener("input", () => {
    localStorage.setItem(STORAGE_KEYS.intention, intentionInput.value);
  });

  logInput.addEventListener("input", () => {
    localStorage.setItem(STORAGE_KEYS.log, logInput.value);
  });

  async function enableMidi() {
    if (!navigator.requestMIDIAccess) {
      midiStatus.textContent = "MIDI: no support";
      midiToggle.checked = false;
      return;
    }
    try {
      midiAccess = await navigator.requestMIDIAccess();
      const inputs = Array.from(midiAccess.inputs.values());
      midiInput = inputs[0] ?? null;
      if (!midiInput) {
        midiStatus.textContent = "MIDI: no devices";
        return;
      }
      midiInput.onmidimessage = (event) => {
        const [status, data1, data2] = event.data;
        const type = status & 0xf0;
        if (type !== 0xb0) return;
        const value = data2 / 127;
        if (data1 === 74) {
          params.cutoff = 200 + value * 7800;
          cutoffInput.value = params.cutoff.toFixed(0);
          updateCutoffDisplay(params.cutoff);
          emitUpdate();
        }
        if (data1 === 91) {
          params.room = value;
          roomInput.value = params.room.toFixed(2);
          updateRoomDisplay(params.room);
          emitUpdate();
        }
      };
      midiStatus.textContent = `MIDI: ${midiInput.name ?? "connected"}`;
    } catch (error) {
      midiStatus.textContent = "MIDI: denied";
      midiToggle.checked = false;
    }
  }

  function disableMidi() {
    if (midiInput) midiInput.onmidimessage = null;
    midiInput = null;
    midiAccess = null;
    midiStatus.textContent = "MIDI: off";
  }

  midiToggle.addEventListener("change", () => {
    if (midiToggle.checked) {
      void enableMidi();
    } else {
      disableMidi();
    }
  });

  stopBtn.disabled = true;
  applyParamsToUI();
  handlers.onInstrumentChange(params.instrument);
  handlers.onCpsChange(params.cps);
  handlers.onParamsUpdate(params, { live: false });
}
