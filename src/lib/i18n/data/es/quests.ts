import type { Chapter, QuestBase } from "../../../play/quests";

export const CHAPTER_TEXT_ES: Record<Chapter, { title: string; blurb: string }> = {
  molecules: {
    title: "Constructor de moléculas",
    blurb: "Conecta átomos y descubre cómo los enlaces dan forma a moléculas conocidas.",
  },
  mixing: {
    title: "Laboratorio de mezclas",
    blurb: "Usa el modelo real del banco para probar ingredientes y condiciones.",
  },
  atoms: {
    title: "Historias nucleares",
    blurb: "Explora lo que predice un modelo simplificado del núcleo.",
  },
};

export type BuiltinQuestId =
  | "molecule-hydrogen"
  | "molecule-water"
  | "molecule-oxygen"
  | "molecule-carbon-dioxide"
  | "molecule-methane"
  | "molecule-ammonia"
  | "molecule-nitrogen"
  | "molecule-hydrogen-peroxide"
  | "molecule-ethylene"
  | "molecule-hydrogen-cyanide"
  | "molecule-ethanol"
  | "molecule-acetic-acid"
  | "mix-fizz"
  | "mix-slime"
  | "mix-vanishing-film"
  | "mix-sticky-situation"
  | "mix-strand"
  | "mix-enzyme-helper"
  | "atom-split"
  | "atom-tightest"
  | "atom-alpha"
  | "atom-new-element";

export type QuestTextOverlay = Pick<QuestBase, "title" | "story" | "goal" | "hint" | "learn" | "starGoals">;

export const QUEST_TEXT_ES: Record<BuiltinQuestId, QuestTextOverlay> = {
  "molecule-hydrogen": {
    // EN title: "Two hydrogen atoms"
    title: "Dos átomos de hidrógeno",
    // EN story: "A tiny gas molecule is the first sketch on your lab console."
    story: "Una molécula de gas pequeña es el primer dibujo en la consola del laboratorio.",
    // EN goal: "Connect two hydrogen atoms to make H₂."
    goal: "Une dos átomos de hidrógeno para formar H₂.",
    // EN hint: "Each hydrogen needs one bond."
    hint: "Cada átomo de hidrógeno necesita un enlace.",
    // EN learn: "Hydrogen gas is H₂, with one shared pair of electrons between its atoms."
    learn: "El hidrógeno gaseoso es H₂; sus átomos comparten un par de electrones.",
    // EN starGoals: ["Build the correct, complete molecule.","Use no more than one hint.","Build it without hints."]
    starGoals: ["Construye la molécula correcta y completa.", "Usa como máximo una pista.", "Constrúyela sin pistas."],
  },
  "molecule-water": {
    // EN title: "Water's bent shape"
    title: "La forma angular del agua",
    // EN story: "The lab needs a familiar molecule before the next sample arrives."
    story: "El laboratorio necesita una molécula conocida antes de que llegue la siguiente muestra.",
    // EN goal: "Build one oxygen bonded to two hydrogens."
    goal: "Construye un átomo de oxígeno unido a dos átomos de hidrógeno.",
    // EN hint: "Oxygen has room for two bonds; each hydrogen has room for one."
    hint: "El oxígeno puede formar dos enlaces; cada hidrógeno, uno.",
    // EN learn: "Water is H₂O, and lone electron pairs make its shape bent rather than straight."
    learn: "El agua es H₂O; los pares de electrones libres hacen que su forma sea angular.",
    // EN starGoals: ["Build the correct, complete molecule.","Use no more than one hint.","Build it without hints."]
    starGoals: ["Construye la molécula correcta y completa.", "Usa como máximo una pista.", "Constrúyela sin pistas."],
  },
  "molecule-oxygen": {
    // EN title: "Oxygen's double bond"
    title: "El enlace doble del oxígeno",
    // EN story: "A sensor flags a simple gas molecule in the air sample."
    story: "Un sensor detecta una molécula gaseosa sencilla en la muestra de aire.",
    // EN goal: "Connect two oxygen atoms with a double bond."
    goal: "Une dos átomos de oxígeno con un enlace doble.",
    // EN hint: "Oxygen has valence two, so the pair can share two bonds."
    hint: "El oxígeno tiene valencia dos, así que los átomos pueden compartir dos enlaces.",
    // EN learn: "An oxygen molecule is O₂, held together by a double bond."
    learn: "La molécula de oxígeno es O₂ y se mantiene unida mediante un enlace doble.",
    // EN starGoals: ["Build the correct, complete molecule.","Use no more than one hint.","Build it without hints."]
    starGoals: ["Construye la molécula correcta y completa.", "Usa como máximo una pista.", "Constrúyela sin pistas."],
  },
  "molecule-carbon-dioxide": {
    // EN title: "A straight carbon dioxide"
    title: "Dióxido de carbono lineal",
    // EN story: "A greenhouse monitor needs you to sketch the gas it just detected."
    story: "El monitor de efecto invernadero necesita que dibujes el gas que acaba de detectar.",
    // EN goal: "Put carbon between two oxygen atoms and make two double bonds."
    goal: "Coloca un átomo de carbono entre dos de oxígeno y forma dos enlaces dobles.",
    // EN hint: "Carbon needs four bonds, and each oxygen needs two."
    hint: "El carbono necesita cuatro enlaces y cada oxígeno, dos.",
    // EN learn: "Carbon dioxide is linear because its central carbon has two double-bonded neighbors."
    learn: "El dióxido de carbono es lineal porque su carbono central tiene dos átomos vecinos unidos por enlaces dobles.",
    // EN starGoals: ["Build the correct, complete molecule.","Use no more than one hint.","Build it without hints."]
    starGoals: ["Construye la molécula correcta y completa.", "Usa como máximo una pista.", "Constrúyela sin pistas."],
  },
  "molecule-methane": {
    // EN title: "Four corners of methane"
    title: "Las cuatro esquinas del metano",
    // EN story: "A fuel sensor has found the smallest hydrocarbon in its sample."
    story: "Un sensor de combustible encontró el hidrocarburo más pequeño de la muestra.",
    // EN goal: "Build one carbon with four single-bonded hydrogens."
    goal: "Construye un átomo de carbono con cuatro átomos de hidrógeno unidos por enlaces sencillos.",
    // EN hint: "Carbon has four available bonds; hydrogen has one."
    hint: "El carbono puede formar cuatro enlaces; el hidrógeno, uno.",
    // EN learn: "Methane is CH₄, with four bonds arranged around carbon in a tetrahedral shape."
    learn: "El metano es CH₄; sus cuatro enlaces se distribuyen alrededor del carbono con una geometría tetraédrica.",
    // EN starGoals: ["Build the correct, complete molecule.","Use no more than one hint.","Build it without hints."]
    starGoals: ["Construye la molécula correcta y completa.", "Usa como máximo una pista.", "Constrúyela sin pistas."],
  },
  "molecule-ammonia": {
    // EN title: "Ammonia's little pyramid"
    title: "La pequeña pirámide del amoníaco",
    // EN story: "A sample label is smudged, but the atom counts are still on the scanner."
    story: "La etiqueta de una muestra está borrosa, pero el escáner aún muestra la cantidad de átomos.",
    // EN goal: "Connect three hydrogens to one nitrogen."
    goal: "Une tres átomos de hidrógeno a uno de nitrógeno.",
    // EN hint: "Nitrogen needs three bonds, and hydrogen needs one."
    hint: "El nitrógeno necesita tres enlaces y el hidrógeno, uno.",
    // EN learn: "Ammonia is NH₃; a lone pair on nitrogen gives it a trigonal-pyramidal shape."
    learn: "El amoníaco es NH₃; un par solitario en el nitrógeno le da forma de pirámide trigonal.",
    // EN starGoals: ["Build the correct, complete molecule.","Use no more than one hint.","Build it without hints."]
    starGoals: ["Construye la molécula correcta y completa.", "Usa como máximo una pista.", "Constrúyela sin pistas."],
  },
  "molecule-nitrogen": {
    // EN title: "Nitrogen's triple bond"
    title: "El enlace triple del nitrógeno",
    // EN story: "The air sample is quiet, but one very strong bond holds its main gas together."
    story: "La muestra de aire parece tranquila, pero un enlace muy fuerte mantiene unida su molécula principal.",
    // EN goal: "Connect two nitrogen atoms with a triple bond."
    goal: "Une dos átomos de nitrógeno con un enlace triple.",
    // EN hint: "Each nitrogen has valence three, so the pair can share three bonds."
    hint: "Cada nitrógeno tiene valencia tres, así que pueden compartir tres enlaces.",
    // EN learn: "Nitrogen gas is N₂; its triple bond helps make it unusually stable."
    learn: "El nitrógeno gaseoso es N₂; su enlace triple contribuye a su gran estabilidad.",
    // EN starGoals: ["Build the correct, complete molecule.","Use no more than one hint.","Build it without hints."]
    starGoals: ["Construye la molécula correcta y completa.", "Usa como máximo una pista.", "Constrúyela sin pistas."],
  },
  "molecule-hydrogen-peroxide": {
    // EN title: "A peroxide link"
    title: "Un enlace de peróxido",
    // EN story: "A cleaning-product label gives you a new oxygen-rich structure to inspect."
    story: "La etiqueta de un producto de limpieza te propone inspeccionar una estructura rica en oxígeno.",
    // EN goal: "Build two oxygens joined together, with one hydrogen on each."
    goal: "Une dos átomos de oxígeno y coloca un átomo de hidrógeno en cada uno.",
    // EN hint: "The O–O bond is single, and each oxygen needs one more bond to hydrogen."
    hint: "El enlace O–O es sencillo y cada oxígeno necesita otro enlace con hidrógeno.",
    // EN learn: "Hydrogen peroxide is H₂O₂ and contains a single bond between its oxygen atoms."
    learn: "El peróxido de hidrógeno es H₂O₂ y contiene un enlace sencillo entre sus átomos de oxígeno.",
    // EN starGoals: ["Build the correct, complete molecule.","Use no more than one hint.","Build it without hints."]
    starGoals: ["Construye la molécula correcta y completa.", "Usa como máximo una pista.", "Constrúyela sin pistas."],
  },
  "molecule-ethylene": {
    // EN title: "A double-bonded pair"
    title: "Dos carbonos con enlace doble",
    // EN story: "A fruit-ripening sensor found a small molecule with two carbons."
    story: "Un sensor de maduración de frutas detectó una molécula pequeña con dos carbonos.",
    // EN goal: "Build two carbons with a double bond and two hydrogens on each."
    goal: "Construye dos átomos de carbono con un enlace doble y dos de hidrógeno en cada uno.",
    // EN hint: "The C=C bond uses two valence units on each carbon."
    hint: "El enlace C=C usa dos unidades de valencia de cada carbono.",
    // EN learn: "Ethylene is C₂H₄, and its carbon-carbon double bond keeps the atoms in a mostly flat arrangement."
    learn: "El etileno es C₂H₄; su enlace doble carbono-carbono mantiene los átomos en una disposición casi plana.",
    // EN starGoals: ["Build the correct, complete molecule.","Use no more than one hint.","Build it without hints."]
    starGoals: ["Construye la molécula correcta y completa.", "Usa como máximo una pista.", "Constrúyela sin pistas."],
  },
  "molecule-hydrogen-cyanide": {
    // EN title: "The carbon–nitrogen triple bond"
    title: "El enlace triple carbono-nitrógeno",
    // EN story: "A detector reports a molecule that needs careful handling even in a simulation."
    story: "Un detector informa de una molécula que requiere cuidado, incluso en una simulación.",
    // EN goal: "Arrange hydrogen, carbon, and nitrogen in a line with a C≡N bond."
    goal: "Alinea hidrógeno, carbono y nitrógeno, con un enlace C≡N.",
    // EN hint: "Hydrogen uses one bond; carbon can use one to H and three to N."
    hint: "El hidrógeno forma un enlace; el carbono puede formar uno con H y tres con N.",
    // EN learn: "Hydrogen cyanide is linear, with a triple bond between carbon and nitrogen."
    learn: "El cianuro de hidrógeno es lineal y tiene un enlace triple entre el carbono y el nitrógeno.",
    // EN starGoals: ["Build the correct, complete molecule.","Use no more than one hint.","Build it without hints."]
    starGoals: ["Construye la molécula correcta y completa.", "Usa como máximo una pista.", "Constrúyela sin pistas."],
  },
  "molecule-ethanol": {
    // EN title: "Follow the –OH group"
    title: "Sigue el grupo –OH",
    // EN story: "Two molecules share a formula, so the lab asks you to identify ethanol by its connections."
    story: "Dos moléculas comparten fórmula, así que el laboratorio te pide identificar el etanol por sus enlaces.",
    // EN goal: "Build a two-carbon chain ending in an O–H group."
    goal: "Construye una cadena de dos carbonos que termine en un grupo O–H.",
    // EN hint: "The oxygen is bonded to one carbon and one hydrogen."
    hint: "El oxígeno está unido a un átomo de carbono y uno de hidrógeno.",
    // EN learn: "Ethanol and dimethyl ether both have formula C₂H₆O, but their atom connections are different."
    learn: "El etanol y el éter dimetílico tienen la fórmula C₂H₆O, pero sus átomos están conectados de manera distinta.",
    // EN starGoals: ["Build the correct, complete molecule.","Use no more than one hint.","Build it without hints."]
    starGoals: ["Construye la molécula correcta y completa.", "Usa como máximo una pista.", "Constrúyela sin pistas."],
  },
  "molecule-acetic-acid": {
    // EN title: "Vinegar's molecule"
    title: "La molécula del vinagre",
    // EN story: "A familiar kitchen sample is waiting for its molecular identity check."
    story: "Una muestra conocida de cocina espera a que confirmes su identidad molecular.",
    // EN goal: "Build a two-carbon carboxylic acid with a C=O and an O–H."
    goal: "Construye un ácido carboxílico de dos carbonos con un enlace C=O y un grupo O–H.",
    // EN hint: "The carbonyl carbon is also bonded to a methyl carbon and a single-bonded oxygen."
    hint: "El carbono del carbonilo también se une a un carbono metilo y a un oxígeno mediante un enlace sencillo.",
    // EN learn: "Acetic acid is the acid that gives vinegar its sour taste."
    learn: "El ácido acético es el ácido que le da al vinagre su sabor agrio.",
    // EN starGoals: ["Build the correct, complete molecule.","Use no more than one hint.","Build it without hints."]
    starGoals: ["Construye la molécula correcta y completa.", "Usa como máximo una pista.", "Constrúyela sin pistas."],
  },
  "mix-fizz": {
    // EN title: "Make it fizz"
    title: "Haz que burbujee",
    // EN story: "The lab's bubble counter needs a harmless-looking gas event to study."
    story: "El contador de burbujas del laboratorio necesita estudiar una reacción gaseosa que parezca inofensiva.",
    // EN goal: "Make the acid-and-bicarbonate fizz event happen."
    goal: "Haz que ocurra la reacción efervescente entre el ácido y el bicarbonato.",
    // EN hint: "Look for an acid and sodium bicarbonate in the ingredient library."
    hint: "Busca un ácido y bicarbonato de sodio en la biblioteca de ingredientes.",
    // EN learn: "An acid can react with bicarbonate to release carbon dioxide bubbles."
    learn: "Un ácido puede reaccionar con bicarbonato y liberar burbujas de dióxido de carbono.",
    // EN starGoals: ["The bicarbonate-bubbles event happens.","The product is not dangerous.","Every ingredient is edible in the model."]
    starGoals: ["Ocurre la reacción de burbujas del bicarbonato.", "El producto no es peligroso.", "Todos los ingredientes son comestibles en el modelo."],
  },
  "mix-slime": {
    // EN title: "Slime time"
    title: "Hora de hacer slime",
    // EN story: "A stretchy sample has arrived at the bench; the lab wants to know what gives it bounce."
    story: "Llegó una muestra elástica al banco; el laboratorio quiere saber qué le da su rebote.",
    // EN goal: "Make a gel or slime, then improve its stretch and skin-hazard rating."
    goal: "Forma un gel o slime y mejora su elasticidad y nivel de riesgo para la piel.",
    // EN hint: "Borate links can connect PVA chains, and glycerol may change stretch."
    hint: "Los enlaces de borato pueden conectar cadenas de PVA, y la glicerina podría cambiar su elasticidad.",
    // EN learn: "Borate ions make reversible links between PVA chains, allowing slime to stretch and partly self-heal."
    learn: "Los iones de borato forman enlaces reversibles entre cadenas de PVA, lo que permite que el slime se estire y se repare parcialmente.",
    // EN starGoals: ["The product is a gel or slime.","Elongation is at least 40%.","Skin hazard is level 1 or lower."]
    starGoals: ["El producto es un gel o slime.", "La elongación es de al menos 40%.", "El riesgo para la piel es de nivel 1 o menor."],
  },
  "mix-vanishing-film": {
    // EN title: "Vanishing film"
    title: "Película que desaparece",
    // EN story: "The cleanup crew wants a castable film that can disappear in water."
    story: "El equipo de limpieza quiere una película moldeable que se disuelva en agua.",
    // EN goal: "Form a water-dissolving film from biodegradable ingredients without overspending."
    goal: "Forma una película soluble en agua con ingredientes biodegradables sin exceder el presupuesto.",
    // EN hint: "PVA can form a film when cast and is modeled as biodegradable and water-soluble."
    hint: "El PVA puede formar una película al moldearlo; el modelo lo considera biodegradable y soluble en agua.",
    // EN learn: "Some polymer films dissolve in water; their behavior depends on the polymer and the way the film is formed."
    learn: "Algunas películas de polímero se disuelven en agua; su comportamiento depende del polímero y de cómo se forme la película.",
    // EN starGoals: ["The product is a film and dissolves in water.","Every ingredient is biodegradable.","Modeled cost is at most $1.00 per kg."]
    starGoals: ["El producto es una película y se disuelve en agua.", "Todos los ingredientes son biodegradables.", "El costo modelado es de hasta $1.00 por kg."],
  },
  "mix-sticky-situation": {
    // EN title: "Sticky situation"
    title: "Una situación pegajosa",
    // EN story: "A sample must hold two surfaces together without making the lab crew nervous."
    story: "Una muestra debe mantener unidas dos superficies sin poner nervioso al equipo del laboratorio.",
    // EN goal: "Form an adhesive with useful tack and a low skin-hazard score."
    goal: "Forma un adhesivo con buena adherencia y un nivel bajo de riesgo para la piel.",
    // EN hint: "Mussel foot protein contains catechol groups that can form adhesive links."
    hint: "La proteína del biso de los mejillones contiene grupos catecol que pueden formar enlaces adhesivos.",
    // EN learn: "Catechol groups can oxidize into links that help some natural proteins adhere to surfaces."
    learn: "Los grupos catecol pueden oxidarse y formar enlaces que ayudan a algunas proteínas naturales a adherirse a superficies.",
    // EN starGoals: ["The product is an adhesive.","Tack is at least 4.8/10.","Skin hazard is level 1 or lower."]
    starGoals: ["El producto es un adhesivo.", "La adherencia es de al menos 4.8/10.", "El riesgo para la piel es de nivel 1 o menor."],
  },
  "mix-strand": {
    // EN title: "Strong, stretchy fiber"
    title: "Fibra fuerte y elástica",
    // EN story: "A fiber sample needs enough strength to carry a test load while staying flexible."
    story: "Una muestra de fibra debe resistir una carga de prueba sin perder flexibilidad.",
    // EN goal: "Form a fiber with a strong network and at least 15% elongation."
    goal: "Forma una fibra con una red resistente y una elongación de al menos 15%.",
    // EN hint: "Silk can form stronger beta-sheet regions; a little plasticizer can increase stretch."
    hint: "La seda puede formar regiones de láminas beta más resistentes; un poco de plastificante puede aumentar la elasticidad.",
    // EN learn: "Fiber strength and stretch are separate properties, and changing one can trade off against the other."
    learn: "La resistencia y la elasticidad de una fibra son propiedades distintas; mejorar una puede reducir la otra.",
    // EN starGoals: ["The product is a fiber.","Tensile strength is at least 800 MPa.","Elongation is at least 15%."]
    starGoals: ["El producto es una fibra.", "La resistencia a la tracción es de al menos 800 MPa.", "La elongación es de al menos 15%."],
  },
  "mix-enzyme-helper": {
    // EN title: "Enzyme helper"
    title: "Ayuda enzimática",
    // EN story: "A protein network needs a helpful enzyme, and the lab's pH meter is part of the puzzle."
    story: "Una red de proteínas necesita una enzima útil, y el medidor de pH del laboratorio forma parte del reto.",
    // EN goal: "Activate an enzyme event and tune the pH toward that enzyme's working range and optimum."
    goal: "Activa una reacción enzimática y ajusta el pH al intervalo de trabajo y al óptimo de la enzima.",
    // EN hint: "Check the enzyme's pH range and optimum in the ingredient information."
    hint: "Consulta el intervalo de pH y el óptimo de la enzima en la información del ingrediente.",
    // EN learn: "Enzymes work best under particular conditions, and a pH shift can change how active they are."
    learn: "Las enzimas funcionan mejor bajo ciertas condiciones, y un cambio de pH puede modificar su actividad.",
    // EN starGoals: ["An enzyme event has activity (happened or partial).","The pH is within the active enzyme's range.","The pH is within 1 unit of that enzyme's optimum."]
    starGoals: ["Una reacción enzimática tiene actividad (completa o parcial).", "El pH está dentro del intervalo de la enzima activa.", "El pH está a no más de 1 unidad del óptimo de la enzima."],
  },
  "atom-split": {
    // EN title: "Split the atom"
    title: "Divide el átomo",
    // EN story: "The nucleus simulator is ready for a neutron-capture challenge."
    story: "El simulador de núcleos está listo para un reto de captura de neutrones.",
    // EN goal: "Find a long-lived target that splits after capturing a neutron."
    goal: "Encuentra un núcleo de vida media larga que se fisione al capturar un neutrón.",
    // EN hint: "Uranium-235 is the reference target in this model."
    hint: "En este modelo, el uranio-235 es el núcleo de referencia.",
    // EN learn: "Fission splits a heavy nucleus into lighter fragments and releases energy; the model's fragments are estimates."
    learn: "La fisión divide un núcleo pesado en fragmentos más ligeros y libera energía; los fragmentos del modelo son estimaciones.",
    // EN starGoals: ["Neutron capture triggers fission.","The modeled energy is at least 150 MeV.","The starting nucleus has a modeled half-life of at least 1 year."]
    starGoals: ["La captura de un neutrón provoca fisión.", "La energía modelada es de al menos 150 MeV.", "La vida media modelada del núcleo inicial es de al menos 1 año."],
  },
  "atom-tightest": {
    // EN title: "Tightest nucleus"
    title: "El núcleo más ligado",
    // EN story: "The model is scanning for nuclei whose particles are held together especially tightly."
    story: "El modelo busca núcleos cuyas partículas estén unidas con especial fuerza.",
    // EN goal: "Explore binding energy per nucleon and find a nucleus near the model's peak."
    goal: "Explora la energía de enlace por nucleón y encuentra un núcleo cerca del máximo del modelo.",
    // EN hint: "The strongest region in this model is around iron and nickel."
    hint: "En este modelo, la región más estable está cerca del hierro y el níquel.",
    // EN learn: "Binding energy per nucleon is a measure of how tightly the nucleons are held together."
    learn: "La energía de enlace por nucleón mide cuán unidos están los nucleones.",
    // EN starGoals: ["Reach at least 4.43 MeV per nucleon.","Reach at least 7.98 MeV per nucleon.","Reach at least 8.78 MeV per nucleon."]
    starGoals: ["Alcanza al menos 4.43 MeV por nucleón.", "Alcanza al menos 7.98 MeV por nucleón.", "Alcanza al menos 8.78 MeV por nucleón."],
  },
  "atom-alpha": {
    // EN title: "Alpha particle"
    title: "Partícula alfa",
    // EN story: "Follow a decay chain and watch a small bundle of nuclear matter leave the nucleus."
    story: "Sigue una cadena de desintegración y observa cómo sale del núcleo un pequeño grupo de materia nuclear.",
    // EN goal: "Start with alpha decay, then follow the chain toward a stable nucleus."
    goal: "Empieza con una desintegración alfa y sigue la cadena hacia un núcleo estable.",
    // EN hint: "Uranium-238 begins with alpha decay in the model."
    hint: "En el modelo, el uranio-238 comienza con una desintegración alfa.",
    // EN learn: "An alpha particle contains two protons and two neutrons, so alpha decay lowers both counts by two."
    learn: "Una partícula alfa contiene dos protones y dos neutrones; por eso, la desintegración alfa reduce ambas cantidades en dos.",
    // EN starGoals: ["The first step is alpha decay.","Follow at least three decay steps.","The chain ends at a stable nucleus in the model."]
    starGoals: ["El primer paso es una desintegración alfa.", "Sigue al menos tres pasos de desintegración.", "La cadena termina en un núcleo estable según el modelo."],
  },
  "atom-new-element": {
    // EN title: "Make your own element"
    title: "Crea tu propio elemento",
    // EN story: "A theoretical isotope is waiting in the simulator's superheavy region."
    story: "Un isótopo teórico espera en la región superpesada del simulador.",
    // EN goal: "Find a bound nucleus above element 118 and see how long the model lets it last."
    goal: "Encuentra un núcleo ligado por encima del elemento 118 y observa cuánto dura según el modelo.",
    // EN hint: "The model gives extra stability to some neutron counts, including magic numbers."
    hint: "El modelo asigna estabilidad adicional a ciertas cantidades de neutrones, incluidos los números mágicos.",
    // EN learn: "Real new elements are made a few atoms at a time in particle accelerators; a model nucleus is a prediction, not a real element."
    learn: "Los elementos nuevos reales se producen átomo por átomo en aceleradores de partículas; un núcleo modelado es una predicción, no un elemento real.",
    // EN starGoals: ["Choose a bound target with Z ≥ 119 that does not drip a nucleon.","Reach a modeled half-life of at least 1 microseconds.","Reach a modeled half-life of at least 1 milliseconds."]
    starGoals: ["Elige un núcleo ligado con Z ≥ 119 que no expulse un nucleón.", "Alcanza una vida media modelada de al menos 1 microsegundo.", "Alcanza una vida media modelada de al menos 1 milisegundo."],
  },
};
