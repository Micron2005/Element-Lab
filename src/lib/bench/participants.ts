import { benchById } from "./library";
import type { Part } from "./types";

export function isNetworkFormer(id: string): boolean {
  const ingredient = benchById[id];
  return Boolean(
    ingredient &&
    ["protein", "polymer"].includes(ingredient.category) &&
    ingredient.tensileMPa !== undefined,
  );
}

export function eventParticipantIds(
  eventId: string,
  parts: Part[],
): Set<string> {
  const present = new Set(parts.map((part) => part.id));
  const participants = new Set<string>();
  const add = (...ids: string[]) => ids.forEach((id) => {
    if (present.has(id)) participants.add(id);
  });
  const addNetworkFormers = (ids?: string[]) => {
    for (const id of ids ?? [...present]) {
      if (present.has(id) && isNetworkFormer(id)) participants.add(id);
    }
  };
  switch (eventId) {
    case "alginate-calcium":
      add("alginate", "cacl2", "caco3");
      break;
    case "alginate-fe-zn":
      add("alginate", "fecl3", "zncl2");
      break;
    case "borax-pva":
      add("pva", "borax");
      break;
    case "transglutaminase":
      add("transglutaminase");
      addNetworkFormers(["gelatin", "casein", "whey-protein", "soy-protein", "collagen", "silk-fibroin", "keratin"]);
      break;
    case "phenol-oxidase":
      add("tyrosinase", "laccase", "silk-fibroin", "mfp5", "gelatin", "dopamine");
      break;
    case "hrp-crosslinking":
      add("hrp", "hydrogen-peroxide", "silk-fibroin", "mfp5", "gelatin", "dopamine");
      break;
    case "catechol-oxidation":
      add("dopamine", "mfp5");
      break;
    case "catechol-iron":
      add("dopamine", "mfp5", "fecl3");
      break;
    case "genipin-amine":
      add("genipin", "chitosan", "gelatin", "collagen", "casein");
      break;
    case "glutaraldehyde-amine":
      add("glutaraldehyde", "chitosan", "gelatin", "collagen", "casein", "mfp5", "dopamine", "keratin");
      break;
    case "chitosan-solubility":
      add("chitosan", "alginate", "water", "acetic-acid", "sodium-citrate");
      break;
    case "gelatin-thermogel":
      add("gelatin", "water");
      break;
    case "silk-beta-sheet":
      add("spider-silk", "silk-fibroin", "ethanol", "methanol", "kcl");
      break;
    case "cyanoacrylate":
      add("cyanoacrylate", "water", "acetic-acid", "formic-acid");
      break;
    case "pu-moisture-cure":
      add("pu", "water");
      break;
    case "latex-cure":
      add("latex", "sulfur", "zno", "cacl2", "caco3", "acetic-acid", "formic-acid", "citric-acid");
      break;
    case "protease-digestion":
      add("trypsin", "papain", "proteinase-k");
      addNetworkFormers();
      break;
    case "sodium-water":
      add("sodium-metal", "water");
      break;
    case "bicarbonate-bubbles":
      add("sodium-bicarbonate", "acetic-acid", "formic-acid", "citric-acid");
      break;
    case "filler-reinforcement":
      add("graphene", "cnt", "silica", "cnf", "graphene-oxide", "gold-np", "silver-np", "iron-powder");
      addNetworkFormers();
      add("acetic-acid", "formic-acid", "citric-acid");
      break;
  }
  return participants;
}
