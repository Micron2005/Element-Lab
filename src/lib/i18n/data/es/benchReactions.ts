import type { Reaction } from "../../../bench/reactions";

export type ReactionText = {
  name: string;
  mechanism: string;
  effects?: { note?: string };
};

export const REACTION_TEXT_ES: Record<Reaction["id"], ReactionText> = {
  "alginate-calcium": { name: "Alginato y calcio", mechanism: "Los iones de calcio forman uniones iónicas de tipo «caja de huevos» entre las cadenas de alginato." },
  "alginate-fe-zn": { name: "Alginato con hierro o zinc", mechanism: "Los iones de hierro o zinc forman uniones iónicas entre las cadenas de alginato." },
  "borax-pva": { name: "Baba elástica de bórax y PVA", mechanism: "Los iones borato unen de forma reversible los grupos diol de las cadenas de PVA.", effects: { note: "Los enlaces reversibles de borato pueden autorrepararse después de estirarlos." } },
  transglutaminase: { name: "Reticulación de proteínas con transglutaminasa", mechanism: "La transglutaminasa forma enlaces covalentes isopeptídicos entre cadenas de proteína." },
  "phenol-oxidase": { name: "Reticulación con tirosinasa o lacasa", mechanism: "Los grupos fenol y catecol oxidados forman enlaces adhesivos de quinona." },
  "hrp-crosslinking": { name: "Reticulación con peróxido y HRP", mechanism: "La HRP usa una pequeña cantidad de peróxido para acoplar grupos compatibles." },
  "catechol-oxidation": { name: "Oxidación de catecol", mechanism: "El oxígeno oxida los grupos catecol y forma quinonas adhesivas.", effects: { note: "La formación de quinonas mejora la adhesión en superficies húmedas." } },
  "catechol-iron": { name: "Coordinación de catecol con hierro", mechanism: "El hierro(III) se coordina con grupos catecol y forma uniones reversibles.", effects: { note: "La coordinación similar a la del biso de los mejillones puede autorrepararse." } },
  "genipin-amine": { name: "Reticulación de proteínas con genipina", mechanism: "La genipina une grupos amina compatibles de proteínas y quitosano.", effects: { note: "El material reticulado con genipina se modela con un tono azul y baja toxicidad." } },
  "glutaraldehyde-amine": { name: "Reticulación de aminas con glutaraldehído", mechanism: "El glutaraldehído forma enlaces covalentes entre cadenas que contienen aminas." },
  "chitosan-solubility": { name: "Solubilidad del quitosano y complejo polielectrolítico", mechanism: "El quitosano y el alginato disueltos forman un complejo polielectrolítico en la interfaz." },
  "gelatin-thermogel": { name: "Gel térmico de gelatina", mechanism: "Al enfriarse, las cadenas de gelatina se asocian y forman un gel físico reversible.", effects: { note: "La gelatina sin reticular se derrite cerca de la temperatura corporal." } },
  "silk-beta-sheet": { name: "Formación de láminas beta en la seda", mechanism: "Las cadenas de seda se ensamblan en regiones más resistentes y ricas en láminas beta." },
  cyanoacrylate: { name: "Curado del cianoacrilato", mechanism: "La humedad inicia la polimerización aniónica rápida del cianoacrilato." },
  "pu-moisture-cure": { name: "Curado por humedad del poliuretano", mechanism: "La humedad del aire reacciona con el prepolímero y forma una red de uretano." },
  "latex-cure": { name: "Coagulación y vulcanización del látex", mechanism: "El ácido o el calcio coagulan el látex; el azufre caliente forma enlaces cruzados de vulcanización." },
  "protease-digestion": { name: "Digestión por proteasa", mechanism: "Las proteasas cortan cadenas de proteína y también pueden digerir otras enzimas." },
  "sodium-water": { name: "Sodio metálico y agua", mechanism: "El sodio reacciona violentamente con el agua, libera hidrógeno y forma hidróxido de sodio." },
  "bicarbonate-bubbles": { name: "Burbujas de ácido y bicarbonato", mechanism: "El ácido y el bicarbonato liberan burbujas de dióxido de carbono." },
  "filler-reinforcement": { name: "Refuerzo con cargas", mechanism: "Las cargas dispersas refuerzan una matriz hasta que predomina la aglomeración; el hierro en polvo puede liberar hidrógeno en medio ácido." },
};
