import { describe, expect, it } from "vitest";
import { KNOWN_MOLECULES } from "./molecule";
import {
  CHAPTERS,
  MIX_THRESHOLDS,
  NUCLEAR_THRESHOLDS,
  QUESTS,
  gradeMolecule,
  questById,
  questsIn,
  type AtomQuest,
  type MixQuest,
  type MoleculeQuest,
} from "./quests";
import { DEFAULT_CONDITIONS } from "../bench/conditions";
import { benchPresets } from "../bench/presets";
import { simulate } from "../bench/simulate";
import type { Experiment } from "../bench/types";

function run(experiment: Experiment) {
  return simulate(experiment);
}

function mix(parts: Experiment["parts"], conditions: Partial<Experiment["conditions"]> = {}): Experiment {
  return {
    parts,
    conditions: { ...DEFAULT_CONDITIONS, ...conditions },
  };
}

describe("play quests", () => {
  it("keeps quest ids unique and chapter order grouped", () => {
    expect(new Set(QUESTS.map((quest) => quest.id)).size).toBe(QUESTS.length);
    expect(CHAPTERS.map((chapter) => chapter.id)).toEqual(["molecules", "mixing", "atoms"]);
    expect(QUESTS.map((quest) => quest.chapter)).toEqual([
      ...Array(12).fill("molecules"),
      ...Array(6).fill("mixing"),
      ...Array(4).fill("atoms"),
    ]);
    expect(questById("molecule-water")?.title).toBe("Water's bent shape");
    expect(questsIn("mixing")).toHaveLength(6);
  });

  it("gives each molecule quest an existing target and a palette covering its elements", () => {
    const quests = QUESTS.filter((quest): quest is MoleculeQuest => quest.chapter === "molecules");
    expect(quests).toHaveLength(12);
    for (const quest of quests) {
      const target = KNOWN_MOLECULES.find((molecule) => molecule.id === quest.moleculeId);
      expect(target, quest.id).toBeDefined();
      const required = new Set(target!.graph.atoms.map((atom) => atom.el));
      expect(quest.palette, quest.id).toEqual(expect.arrayContaining([...required]));
    }
    expect(quests.map((quest) => quest.palette)).toEqual([
      ["H"], ["H", "O"], ["O", "H"], ["C", "O", "H"], ["C", "H"], ["N", "H", "C"],
      ["N"], ["H", "O"], ["C", "H"], ["H", "C", "N"], ["C", "H", "O"], ["C", "H", "O"],
    ]);
  });

  it("maps correct molecule builds and hint counts to stars, and names wrong known molecules", () => {
    const quest = questById("molecule-water") as MoleculeQuest;
    const water = KNOWN_MOLECULES.find((molecule) => molecule.id === "water")!.graph;
    expect(gradeMolecule(quest, water, 0).stars).toBe(3);
    expect(gradeMolecule(quest, water, 1).stars).toBe(2);
    expect(gradeMolecule(quest, water, 2).stars).toBe(1);
    expect(gradeMolecule(quest, water, 8).stars).toBe(1);

    const peroxide = KNOWN_MOLECULES.find((molecule) => molecule.id === "hydrogen-peroxide")!.graph;
    expect(gradeMolecule(quest, peroxide, 0).feedback[0]).toBe("That's hydrogen peroxide, not water.");
  });

  it("awards three stars for each calibrated real-simulation mixing reference", () => {
    const quests = QUESTS.filter((quest): quest is MixQuest => quest.chapter === "mixing");
    expect(quests).toHaveLength(6);
    for (const quest of quests) {
      const result = run(quest.reference);
      expect(quest.grade(quest.reference, result).stars, quest.id).toBe(3);
    }
  });

  it("gives fewer stars for plausible but weaker mixing recipes", () => {
    const fizz = questById("mix-fizz") as MixQuest;
    const weakerFizz = mix([
      { id: "sodium-bicarbonate", pct: 10 },
      { id: "acetic-acid", pct: 10 },
      { id: "water", pct: 75 },
      { id: "ethanol", pct: 5 },
    ]);
    expect(fizz.grade(weakerFizz, run(weakerFizz)).stars).toBe(2);

    const slime = questById("mix-slime") as MixQuest;
    const weakerSlime = mix([
      { id: "pva", pct: 5 },
      { id: "borax", pct: 2 },
      { id: "water", pct: 93 },
    ]);
    expect(slime.grade(weakerSlime, run(weakerSlime)).stars).toBe(1);

    const film = questById("mix-vanishing-film") as MixQuest;
    const weakerFilm = mix([
      { id: "pva", pct: 12 },
      { id: "gelatin", pct: 30 },
      { id: "water", pct: 58 },
    ], { forming: "cast-film" });
    expect(film.grade(weakerFilm, run(weakerFilm)).stars).toBe(2);

    const sticky = questById("mix-sticky-situation") as MixQuest;
    const weakerGlue = mix([
      { id: "mfp5", pct: 5 },
      { id: "water", pct: 93 },
      { id: "sodium-bicarbonate", pct: 2 },
    ]);
    expect(sticky.grade(weakerGlue, run(weakerGlue)).stars).toBe(1);

    const strand = questById("mix-strand") as MixQuest;
    const spiderPreset = benchPresets.find((preset) => preset.id === "spider-web")!.experiment;
    expect(strand.grade(spiderPreset, run(spiderPreset)).stars).toBe(2);

    const enzyme = questById("mix-enzyme-helper") as MixQuest;
    const weakerEnzyme = mix([
      { id: "casein", pct: 30 },
      { id: "water", pct: 67.999 },
      { id: "transglutaminase", pct: 2 },
      { id: "sodium-bicarbonate", pct: 0.001 },
    ], { tempC: 50 });
    const enzymeResult = run(weakerEnzyme);
    expect(enzymeResult.events.some((event) => event.id === "transglutaminase" && event.status === "partial")).toBe(true);
    expect(enzyme.grade(weakerEnzyme, enzymeResult).stars).toBe(2);
  });

  it("returns zero stars for empty experiments without throwing", () => {
    const empty = mix([]);
    const result = run(empty);
    for (const quest of QUESTS.filter((item): item is MixQuest => item.chapter === "mixing")) {
      expect(() => quest.grade(empty, result)).not.toThrow();
      expect(quest.grade(empty, result).stars).toBe(0);
    }
  });

  it("awards three stars for each atom quest reference", () => {
    for (const quest of QUESTS.filter((item): item is AtomQuest => item.chapter === "atoms")) {
      expect(quest.grade(quest.reference.z, quest.reference.n).stars, quest.id).toBe(3);
    }
  });

  it("grades plausible weaker nuclear examples below three stars", () => {
    const split = questById("atom-split") as AtomQuest;
    expect(split.grade(93, 140).stars).toBe(2);

    const binding = questById("atom-tightest") as AtomQuest;
    expect(binding.grade(6, 6).stars).toBe(1);

    const alpha = questById("atom-alpha") as AtomQuest;
    expect(alpha.grade(92, 143).stars).toBe(2);

    const element = questById("atom-new-element") as AtomQuest;
    expect(element.grade(120, 172).stars).toBe(1);
  });

  it("returns zero stars without throwing for nonpositive or non-finite nuclei", () => {
    const quests = QUESTS.filter((item): item is AtomQuest => item.chapter === "atoms");
    for (const quest of quests) {
      for (const [z, n] of [[0, 1], [1, 0], [-1, 2], [2, -1], [Number.NaN, 4], [4, Number.NaN]]) {
        expect(() => quest.grade(z, n)).not.toThrow();
        expect(quest.grade(z, n).stars).toBe(0);
      }
    }
  });

  it("exposes thresholds calibrated from the model and reference recipes", () => {
    expect(MIX_THRESHOLDS.slimeElongationPct).toBe(40);
    expect(MIX_THRESHOLDS.filmCostPerKg).toBe(1);
    expect(NUCLEAR_THRESHOLDS.splitEnergyMeV).toBe(150);
    expect(NUCLEAR_THRESHOLDS.bindingThreeStarFraction).toBe(0.99);
  });
});
