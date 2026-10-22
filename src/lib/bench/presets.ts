import { DEFAULT_CONDITIONS } from "./conditions";
import type { Experiment } from "./types";

export interface BenchPreset {
  id: string;
  name: string;
  experiment: Experiment;
}

export const benchPresets: BenchPreset[] = [
  {
    id: "baking-soda-vinegar",
    name: "Baking soda + vinegar fizz",
    experiment: {
      parts: [
        { id: "sodium-bicarbonate", pct: 10 },
        { id: "acetic-acid", pct: 10 },
        { id: "water", pct: 80 },
      ],
      conditions: {
        ...DEFAULT_CONDITIONS,
        mixRpm: 300,
        forming: "beaker",
      },
    },
  },
  {
    id: "sodium-water",
    name: "Sodium meets water (danger demo)",
    experiment: {
      parts: [
        { id: "sodium-metal", pct: 5 },
        { id: "water", pct: 95 },
      ],
      conditions: {
        ...DEFAULT_CONDITIONS,
        forming: "beaker",
      },
    },
  },
  {
    id: "chitosan-film",
    name: "Chitosan film",
    experiment: {
      parts: [
        { id: "chitosan", pct: 15 },
        { id: "alginate", pct: 10 },
        { id: "acetic-acid", pct: 10 },
        { id: "water", pct: 65 },
      ],
      conditions: {
        ...DEFAULT_CONDITIONS,
        pH: 5.5,
        forming: "cast-film",
      },
    },
  },
  {
    id: "enzyme-breaks-gel",
    name: "Enzyme breaks a gel",
    experiment: {
      parts: [
        { id: "gelatin", pct: 45 },
        { id: "water", pct: 50 },
        { id: "trypsin", pct: 5 },
      ],
      conditions: {
        ...DEFAULT_CONDITIONS,
        tempC: 30,
        pH: 8,
        forming: "beaker",
      },
    },
  },
  {
    id: "alginate-fiber",
    name: "Alginate fiber in calcium bath",
    experiment: {
      parts: [
        { id: "alginate", pct: 8 },
        { id: "water", pct: 92 },
      ],
      conditions: {
        ...DEFAULT_CONDITIONS,
        mixRpm: 300,
        forming: "extrude-bath",
        bathId: "cacl2",
      },
    },
  },
  {
    id: "mussel-glue",
    name: "Mussel-inspired wet glue (mfp + Fe³⁺)",
    experiment: {
      parts: [
        { id: "mfp5", pct: 15 },
        { id: "water", pct: 80 },
        { id: "fecl3", pct: 5 },
      ],
      conditions: {
        ...DEFAULT_CONDITIONS,
        pH: 8,
        forming: "beaker",
      },
    },
  },
  {
    id: "enzyme-gelatin",
    name: "Enzyme-crosslinked gelatin gel",
    experiment: {
      parts: [
        { id: "gelatin", pct: 40 },
        { id: "water", pct: 58 },
        { id: "transglutaminase", pct: 2 },
      ],
      conditions: {
        ...DEFAULT_CONDITIONS,
        tempC: 50,
        pH: 6,
        cureMinutes: 60,
        forming: "beaker",
      },
    },
  },
  {
    id: "vulcanized-latex",
    name: "Vulcanized latex",
    experiment: {
      parts: [
        { id: "latex", pct: 68 },
        { id: "sulfur", pct: 25 },
        { id: "zno", pct: 7 },
      ],
      conditions: {
        ...DEFAULT_CONDITIONS,
        tempC: 150,
        mixRpm: 300,
        cureMinutes: 30,
        forming: "heat-cure",
      },
    },
  },
  {
    id: "spider-web",
    name: "Spider-style web fiber (silk + β-sheet bath)",
    experiment: {
      parts: [
        { id: "spider-silk", pct: 55 },
        { id: "water", pct: 40 },
        { id: "ethanol", pct: 5 },
      ],
      conditions: {
        ...DEFAULT_CONDITIONS,
        mixRpm: 900,
        mixMinutes: 3,
        cureMinutes: 10,
        forming: "extrude-bath",
        bathId: "ethanol",
      },
    },
  },
  {
    id: "borax-slime",
    name: "Borax slime",
    experiment: {
      parts: [
        { id: "pva", pct: 12 },
        { id: "borax", pct: 2 },
        { id: "water", pct: 86 },
      ],
      conditions: {
        ...DEFAULT_CONDITIONS,
        pH: 9,
        forming: "beaker",
      },
    },
  },
];
