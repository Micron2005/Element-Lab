import type { Ingredient } from "../../../ingredients";

export type IngredientText = Pick<Ingredient, "name" | "bonding" | "notes">;

export const INGREDIENT_TEXT_ES: Record<Ingredient["id"], IngredientText> = {
  "spider-silk": {
    name: "Proteína de seda de araña recombinante (MaSp)",
    bonding: "Los bloques de poli-alanina se apilan en nanocristales de láminas beta unidos por puentes de hidrógeno, que aportan resistencia; las regiones ricas en glicina forman resortes amorfos que permiten el estiramiento. El flujo y la pérdida de agua al salir de la hilera fijan las láminas beta.",
    notes: "Es seda real. Las fibras hiladas en laboratorio suelen alcanzar entre 300 y 1100 MPa; la seda natural de arrastre ronda los 1100 MPa. Es costosa y difícil de producir a gran escala.",
  },
  "silk-fibroin": {
    name: "Fibroína de seda de gusano de seda",
    bonding: "Forma los mismos cristales de láminas beta unidos por puentes de hidrógeno que la seda de araña, pero son más cortos y menos elásticos. El alcohol o el flujo convierten la forma soluble de espiral aleatoria en láminas beta insolubles.",
    notes: "Fuente económica de proteína de seda obtenida de capullos. Las fibras de fibroína regenerada son más débiles que las naturales.",
  },
  pva: {
    name: "Alcohol polivinílico (PVA)",
    bonding: "Las cadenas largas de carbono tienen un grupo -OH en cada segundo carbono. Las cadenas forman puentes de hidrógeno entre sí, y el borato u otros agentes reticulantes unen esos grupos -OH.",
    notes: "Polímero de barras adhesivas y slime elástico. Es económico y seguro, pero se disuelve en agua si no está reticulado.",
  },
  alginate: {
    name: "Alginato de sodio",
    bonding: "Las cadenas de azúcar de las algas tienen grupos -COO-. Los iones de calcio (Ca2+) unen dos cadenas a la vez (el modelo de «caja de huevos») y convierten el líquido en gel al instante.",
    notes: "Se usa para hacer esferas comestibles. Forma un gel al instante con calcio, pero es frágil y débil cuando está húmedo.",
  },
  gelatin: {
    name: "Gelatina",
    bonding: "Al enfriarse, las cadenas de proteína vuelven a formar hélices triples similares al colágeno y crean un gel físico. Se vuelve a derretir por encima de unos 35 °C si no está reticulada.",
    notes: "Es comestible y pegajosa cuando está tibia, pero se derrite cerca de la temperatura corporal.",
  },
  chitosan: {
    name: "Quitosano",
    bonding: "Este azúcar de caparazones de crustáceos tiene grupos -NH2. Se disuelve en ácido débil (NH3+) y se solidifica cuando se neutraliza el ácido o un agente reticulante negativo, como el tripolifosfato o la genipina, une las aminas.",
    notes: "Debe disolverse en ácido diluido, similar al vinagre. Tiene un efecto antibacteriano leve.",
  },
  pu: {
    name: "Prepolímero de poliuretano (curado por humedad)",
    bonding: "Los extremos de isocianato (-NCO) reaccionan con el vapor de agua del aire, liberan CO2 y forman enlaces de urea que unen las cadenas en una red de caucho elástica.",
    notes: "Se cura con la humedad del aire, así que debe guardarse bien cerrado y seco. Los isocianatos sin curar irritan y sensibilizan las vías respiratorias y la piel.",
  },
  latex: {
    name: "Látex de caucho natural",
    bonding: "Cuando el agua se evapora, las partículas de caucho se fusionan; las cadenas enredadas de poliisopreno se deslizan y recuperan su forma, lo que permite un gran estiramiento.",
    notes: "Es muy elástico y pegajoso. Puede causar alergia al látex y huele a estabilizador de amoníaco.",
  },
  nylon66: {
    name: "Nailon 6,6",
    bonding: "Los grupos amida entre las cadenas forman puentes de hidrógeno y crean láminas cristalinas. Al estirar las fibras, las cadenas se alinean y pueden alcanzar unos 900 MPa.",
    notes: "Se muestra el valor del material a granel; las fibras estiradas son diez veces más resistentes. Para hilarlo hay que fundirlo (a unos 260 °C) o usar un disolvente agresivo.",
  },
  dopamine: {
    name: "Dopamina (química adhesiva de los mejillones)",
    bonding: "Los grupos catecol se adhieren a casi cualquier superficie, incluso húmeda, mediante puentes de hidrógeno, coordinación con metales y apilamiento π, como los mejillones en las rocas. Los catecoles oxidados se reticulan con las aminas de las proteínas.",
    notes: "Aumenta la adherencia en superficies húmedas. Se oxida y toma un color marrón en aire con pH básico.",
  },
  cyanoacrylate: {
    name: "Cianoacrilato de metilo (pegamento instantáneo)",
    bonding: "Una pequeña cantidad de agua (OH-) en cualquier superficie inicia una reacción en cadena que une los monómeros en segundos. Se adhiere a la piel al instante.",
    notes: "Es muy pegajoso, pero frágil al curarse y puede pegar la piel. Nunca dejes que te toque.",
  },
  pib: {
    name: "Poliisobutileno (adhesivo sensible a la presión)",
    bonding: "Las cadenas blandas fluyen hacia las irregularidades de la superficie y se adhieren mediante fuerzas de van der Waals. Nunca termina de curarse, así que permanece pegajoso, como una base de goma de mascar.",
    notes: "La adherencia es permanente y no irrita la piel. Por sí solo, es débil.",
  },
  cacl2: {
    name: "Cloruro de calcio",
    bonding: "Los iones Ca2+ unen las cadenas de alginato y forman las uniones de «caja de huevos».",
    notes: "Debe entrar en contacto con el alginato en la boquilla o en el aire (por ejemplo, en forma de rocío), no dentro del cartucho; de lo contrario, se gelifica allí.",
  },
  borax: {
    name: "Bórax (borato de sodio)",
    bonding: "Los iones borato forman enlaces reversibles entre los grupos -OH del PVA y crean slime elástico.",
    notes: "Está clasificado como tóxico para la reproducción (GHS H360). Los enlaces son reversibles, por lo que el material se deforma y fluye.",
  },
  genipin: {
    name: "Genipina",
    bonding: "Reacciona con las aminas de las proteínas y del quitosano para formar puentes covalentes permanentes; el material se vuelve azul.",
    notes: "Se obtiene de plantas y es mucho menos tóxica que el glutaraldehído. Su acción es lenta: tarda de minutos a horas.",
  },
  glutaraldehyde: {
    name: "Glutaraldehído",
    bonding: "Sus dos extremos aldehído unen aminas (o grupos -OH en medio ácido) de cadenas vecinas.",
    notes: "Es rápido y eficaz, pero tóxico y sensibilizante. Evítalo en materiales que vayan a tocar la piel.",
  },
  glycerol: {
    name: "Glicerol",
    bonding: "Esta molécula pequeña se intercala entre las cadenas y reemplaza los puentes de hidrógeno entre ellas, lo que les permite deslizarse.",
    notes: "Aumenta el estiramiento y reduce la resistencia. Evita que las fibras se vuelvan quebradizas al secarse.",
  },
  sorbitol: {
    name: "Sorbitol",
    bonding: "Se parece al glicerol, pero es más grande: plastifica menos y atrae menos humedad.",
    notes: "Es un plastificante más suave.",
  },
  "graphene-oxide": {
    name: "Óxido de grafeno",
    bonding: "Las láminas de carbono, de un átomo de grosor, usan sus bordes -OH/-COOH para formar puentes de hidrógeno con el polímero y transmitir la carga entre cadenas.",
    notes: "Unos pocos puntos porcentuales pueden aumentar mucho la resistencia; por encima de aproximadamente el 3 %, se aglomera y vuelve frágil el material. El polvo representa un riesgo por inhalación.",
  },
  cnf: {
    name: "Nanofibrillas de celulosa",
    bonding: "Las nanofibras rígidas derivadas de la madera forman puentes de hidrógeno con el polímero, como las varillas de refuerzo en el concreto.",
    notes: "Es un refuerzo seguro; funciona mejor por debajo de aproximadamente el 10 %.",
  },
  water: {
    name: "Agua",
    bonding: "Forma puentes de hidrógeno con el polímero, separa las cadenas y permite que fluyan.",
    notes: "Se evapora lentamente, por lo que los filamentos delgados permanecen húmedos durante un tiempo.",
  },
  ethanol: {
    name: "Etanol",
    bonding: "Se evapora rápido y extrae agua de las proteínas, lo que impulsa la formación de láminas beta en la seda.",
    notes: "Es inflamable. Es un buen cosolvente para acelerar el secado.",
  },
  "acetic-acid": {
    name: "Ácido acético diluido (2 %)",
    bonding: "Protona las aminas del quitosano (NH2 a NH3+), hace que las cadenas se repelan y ayuda a que se disuelvan.",
    notes: "Tiene una concentración similar a la del vinagre. Es necesario para el quitosano.",
  },
  "formic-acid": {
    name: "Ácido fórmico",
    bonding: "Rompe con fuerza los puentes de hidrógeno y disuelve la seda y el nailon.",
    notes: "Es corrosivo y causa quemaduras.",
  },
  hfip: {
    name: "Hexafluoroisopropanol (HFIP)",
    bonding: "Rompe los puentes de hidrógeno que mantienen unidas las estructuras cristalinas de seda y nailon, y las disuelve por completo.",
    notes: "Disolvente de laboratorio para hilar seda. Es corrosivo y tóxico; úsalo solo con campana extractora.",
  },
};
