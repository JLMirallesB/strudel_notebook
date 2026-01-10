import "./styles.css";
import { getAudioContext } from "@strudel/web";
import { createAudioViz } from "./audioViz";
import { createNotation } from "./notation";
import { ANALYZER_ID, buildStrudelCode, createStrudel, DEFAULT_PARAMS } from "./strudel";
import { setupUI } from "./ui";

const waveform = document.getElementById("waveform") as HTMLCanvasElement;
const spectrum = document.getElementById("spectrum") as HTMLCanvasElement;
const spectrogram = document.getElementById("spectrogram") as HTMLCanvasElement;
const notationCanvas = document.getElementById("notation") as HTMLCanvasElement;

const notation = createNotation({
  canvas: notationCanvas,
  getTime: () => getAudioContext().currentTime,
  cps: DEFAULT_PARAMS.cps
});

const strudel = createStrudel({
  onEvent: (event) => notation.pushEvent(event)
});

const audioViz = createAudioViz({
  waveform,
  spectrum,
  spectrogram,
  analyserId: ANALYZER_ID
});

setupUI({
  defaultParams: DEFAULT_PARAMS,
  onPlay: (params) => {
    const code = buildStrudelCode(params);
    void strudel.evaluateAndPlay(code);
    audioViz.start();
    notation.start();
  },
  onStop: () => {
    strudel.stop();
    audioViz.stop();
    notation.stop();
  },
  onParamsUpdate: (params, options) => {
    if (!options.live) return;
    const code = buildStrudelCode(params);
    void strudel.evaluateAndPlay(code);
  },
  onInstrumentChange: (instrument) => {
    notation.setMode(instrument === "drums" ? "drums" : "piano");
  },
  onCpsChange: (cps) => {
    notation.setCps(cps);
  },
  onReset: (params, options) => {
    notation.clear();
    if (!options.live) return;
    const code = buildStrudelCode(params);
    void strudel.evaluateAndPlay(code);
  }
});
