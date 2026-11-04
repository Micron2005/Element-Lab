import type { BenchPreset } from "../../../bench/presets";

export const BENCH_PRESET_TEXT_ES: Record<BenchPreset["id"], { name: string }> = {
  "baking-soda-vinegar": { name: "Efervescencia de bicarbonato y vinagre" },
  "sodium-water": { name: "El sodio reacciona con agua (demostración peligrosa)" },
  "chitosan-film": { name: "Película de quitosano" },
  "enzyme-breaks-gel": { name: "Una enzima descompone un gel" },
  "alginate-fiber": { name: "Fibra de alginato en baño de calcio" },
  "mussel-glue": { name: "Adhesivo húmedo inspirado en mejillones (Fe³⁺ tamponado)" },
  "enzyme-gelatin": { name: "Gelatina reticulada con enzima" },
  "vulcanized-latex": { name: "Látex vulcanizado" },
  "spider-web": { name: "Fibra de seda (baño de láminas β)" },
  "borax-slime": { name: "Baba elástica de bórax" },
};
