type JsonObject = Record<string, unknown>;
type ChemicalRecord = {
  cid: number;
  name: string;
  iupacName: string;
  formula: string;
  molecularWeight: string;
  smiles: string;
  xlogp: number | null;
  signalWord: string | null;
  pictograms: string[];
  hazardStatements: string[];
};

const PICTOGRAM_NAMES: Record<string, string> = {
  GHS01: "Exploding bomb",
  GHS02: "Flame",
  GHS03: "Flame over circle",
  GHS04: "Gas cylinder",
  GHS05: "Corrosion",
  GHS06: "Skull and crossbones",
  GHS07: "Exclamation mark",
  GHS08: "Health hazard",
  GHS09: "Environment",
};

async function fetchJson(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" } });
}

function stringsFromValue(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const object = value as JsonObject;
  const strings = object.StringWithMarkup;
  if (Array.isArray(strings)) {
    return strings.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const text = (entry as JsonObject).String;
      return typeof text === "string" ? [text] : [];
    });
  }
  if (typeof object.String === "string") return [object.String];
  if (typeof object.Number === "number") return [String(object.Number)];
  return [];
}

function collectGhs(data: unknown) {
  const statements: string[] = [];
  const pictograms = new Set<string>();
  let signalWord: string | null = null;

  const walk = (section: unknown) => {
    if (!section || typeof section !== "object") return;
    const object = section as JsonObject;
    const heading = typeof object.TOCHeading === "string" ? object.TOCHeading : "";
    const information = Array.isArray(object.Information) ? object.Information : [];
    for (const info of information) {
      if (!info || typeof info !== "object") continue;
      const item = info as JsonObject;
      const values = item.Value;
      const informationName = typeof item.Name === "string" ? item.Name : "";
      const informationHeading = informationName || heading;
      const textValues = stringsFromValue(values);
      if (informationHeading.toLowerCase() === "signal" && signalWord === null) signalWord = textValues[0] ?? null;
      if (informationHeading.toLowerCase().includes("hazard statement")) statements.push(...textValues);
      if (values && typeof values === "object") {
        const value = values as JsonObject;
        if (Array.isArray(value.StringWithMarkup)) {
          for (const entry of value.StringWithMarkup) {
            if (!entry || typeof entry !== "object") continue;
            const markup = (entry as JsonObject).Markup;
            if (!Array.isArray(markup)) continue;
            for (const mark of markup) {
              if (!mark || typeof mark !== "object") continue;
              const data = mark as JsonObject;
              if (data.Type === "Icon" && typeof data.Extra === "string") {
                const code = data.Extra.match(/GHS\d{2}/)?.[0];
                pictograms.add(code ? PICTOGRAM_NAMES[code] ?? data.Extra : data.Extra);
              }
            }
          }
        }
      }
    }
    if (Array.isArray(object.Section)) object.Section.forEach(walk);
  };

  const root = data as JsonObject | null;
  const record = root?.Record as JsonObject | undefined;
  if (Array.isArray(record?.Section)) record.Section.forEach(walk);
  return { signalWord, pictograms: [...pictograms], hazardStatements: [...new Set(statements)].slice(0, 15) };
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) return Response.json({ error: "Enter a chemical name to search." }, { status: 400 });
  if (query.length > 120) return Response.json({ error: "Search term is too long." }, { status: 400 });

  try {
    const cidResponse = await fetchJson(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`);
    if (cidResponse.status === 404) return Response.json({ error: `No PubChem compound found for “${query}”.` }, { status: 404 });
    if (!cidResponse.ok) return Response.json({ error: "PubChem could not complete this lookup." }, { status: 502 });
    const cidData = await cidResponse.json() as { IdentifierList?: { CID?: number[] } };
    const cid = cidData.IdentifierList?.CID?.[0];
    if (!cid) return Response.json({ error: `No PubChem compound found for “${query}”.` }, { status: 404 });

    const propertiesUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${encodeURIComponent(String(cid))}/property/Title,IUPACName,MolecularFormula,MolecularWeight,ConnectivitySMILES,XLogP/JSON`;
    const [propertiesResponse, ghsResponse] = await Promise.all([
      fetchJson(propertiesUrl),
      fetchJson(`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${encodeURIComponent(String(cid))}/JSON?heading=GHS+Classification`),
    ]);
    if (!propertiesResponse.ok) return Response.json({ error: "PubChem properties were unavailable." }, { status: 502 });
    const propertyData = await propertiesResponse.json() as { PropertyTable?: { Properties?: JsonObject[] } };
    const property = propertyData.PropertyTable?.Properties?.[0];
    if (!property) return Response.json({ error: "PubChem returned no compound properties." }, { status: 502 });
    const ghsData = ghsResponse.ok ? await ghsResponse.json() : null;
    const ghs = collectGhs(ghsData);
    const record: ChemicalRecord = {
      cid,
      name: String(property.Title ?? query),
      iupacName: String(property.IUPACName ?? "Not listed"),
      formula: String(property.MolecularFormula ?? "Not listed"),
      molecularWeight: String(property.MolecularWeight ?? "Not listed"),
      smiles: String(property.ConnectivitySMILES ?? "Not listed"),
      xlogp: typeof property.XLogP === "number" ? property.XLogP : null,
      ...ghs,
    };
    return Response.json(record);
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return Response.json({ error: timedOut ? "PubChem took too long to respond. Try again shortly." : "Could not reach PubChem. Try again shortly." }, { status: 502 });
  }
}
