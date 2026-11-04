import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as ts from "typescript";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
// These source table initializers are covered by src/lib/i18n/overlays.test.ts.
// Runtime code in these files remains in the scan.
const OVERLAY_COVERED_DATA_TABLES = new Map([
  ["src/lib/play/atoms.ts", new Set(["ATOMS"])],
  ["src/lib/play/learn.ts", new Set(["MOLECULE_LESSONS", "QUEST_LESSONS"])],
  ["src/lib/play/molecule.ts", new Set(["KNOWN_MOLECULES"])],
  ["src/lib/play/quests.ts", new Set(["moleculeStarGoals", "moleculeQuests", "mixQuests", "atomQuests", "QUESTS", "CHAPTERS"])],
  ["src/lib/bench/library.ts", new Set(["benchLibrary"])],
  ["src/lib/bench/presets.ts", new Set(["benchPresets"])],
  ["src/lib/ingredients.ts", new Set(["INGREDIENTS"])],
]);
const REACTION_OVERLAY_FIELDS = new Set(["name", "mechanism", "note"]);

const COMMON_ENGLISH = new Set(`
a about above after again against all also an and another any are around as ask at away back be because
been before being below between both but by call can cannot come could day did do does doing down each even
every few find first for from further get give go good got great had has have he her here him his how i if in
into is it its just keep kind know last like long look made make many may me more most much must my near need
never new no not now of off often on once one only or other our out over own part people place put run said
same see several she should show since so some something still such take than that the their them then there
these they thing think this those through time to too under up us use used using very want was way we well
were what when where which while who will with without work would you your
add air amount angle atom available back barrier base beam bend bent bond boiling build carbon cast change
charge chemical chemistry choose clear close compare complete condition confidence connect control cost cured
current daily data decay details dissolve distance drop dry energy error estimate experiment extra falling
film fire fluid force form forming fusion gas heat height help hydrogen ingredient input inside instead lab
learn level liquid load mass material measured method mixing model molecule motion neutron note nuclear number
open order oxygen page pressure process product proton question reaction record reduce result results safety
save selected set setting skin slow speed stable stretch strong test testing text temperature tensile than
three time two type value vacuum water warning weak weight what happened partial blocked
`.trim().split(/\s+/));

const STATIC_ALLOWLIST = new Set(`
Science Lab S·LAB
elementlab.prefs elementlab.daily elementlab.packs elementlab.progress elementlab.bench.cartridgeB lang
use client use strict
  Hz kPa MPa MeV MJ mL m m/s rpm min s kg g cm mm nm μm °C pH pKa pKb % px Arial
H C N O F Cl S P He Li Be B Ne Na Mg Al Si Ar K Ca Ti Cr Fe Ni Cu Zn Br Kr Xe Cs Ba
CO2 H2O H2 O2 N2 CH4 NH3 HCl H2O2 CO C=O C=C C≡C beta alpha
PubChem PUG REST GHS IUPAC JSON PDF SVG PNG URL API
`.trim().split(/\s+/));

const CODE_ATTRIBUTE_NAMES = new Set([
  "aria-describedby", "aria-expanded", "aria-hidden", "aria-label", "aria-live", "aria-selected",
  "aria-valuemax", "aria-valuemin", "aria-valuenow", "aria-controls", "class", "className", "data-testid",
  "dateTime", "fill", "for", "height", "href", "id", "key", "name", "rel", "role", "src", "stroke",
  "target", "type", "viewBox", "width", "x", "x1", "x2", "y", "y1", "y2",
]);

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function words(value) {
  return [...value.matchAll(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’‑-]*/g)].map((match) => match[0].toLowerCase());
}

function isCodeLike(value) {
  return /^#[0-9a-f]{3,8}$/i.test(value) ||
    /^\d+px Arial$/.test(value) ||
    (/^(?:[a-z][a-z0-9_.:/-]*|[A-Z][A-Za-z0-9_.:/-]*)$/.test(value) && !/\s/.test(value));
}

function readFiles(directory, suffix, root, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) readFiles(full, suffix, root, output);
    else if (entry.isFile() && entry.name.endsWith(suffix)) output.push(path.relative(root, full).replaceAll(path.sep, "/"));
  }
  return output;
}

function parseFile(root, relativePath) {
  const fileName = path.join(root, relativePath);
  const source = fs.readFileSync(fileName, "utf8");
  return ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function stringValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

function dictionary(root, relativePath) {
  const values = new Set();
  const keys = new Set();
  function visit(source, node) {
    if (ts.isPropertyAssignment(node)) {
      const key = node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
        ? node.name.text
        : undefined;
      const value = stringValue(node.initializer);
      if (key && value !== undefined) {
        keys.add(key);
        values.add(value);
      }
    }
    ts.forEachChild(node, (child) => visit(source, child));
  }
  const source = parseFile(root, relativePath);
  visit(source, source);
  if (relativePath === "src/lib/i18n/en.ts") {
    for (const [variableName, messagePath] of [
      ["playEn", "src/lib/i18n/messages/play.ts"],
      ["benchEn", "src/lib/i18n/messages/bench.ts"],
      ["benchComponentsEn", "src/lib/i18n/messages/benchComponents.ts"],
      ["elementsEn", "src/lib/i18n/messages/elements.ts"],
    ]) {
      const messageSource = parseFile(root, messagePath);
      function findNamespace(node) {
        if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === variableName &&
          node.initializer
        ) {
          const initializer = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
          if (ts.isObjectLiteralExpression(initializer)) visit(messageSource, initializer);
          return;
        }
        ts.forEachChild(node, findNamespace);
      }
      findNamespace(messageSource);
    }
  }
  return { keys, values };
}

function ancestor(node, predicate) {
  let current = node.parent;
  while (current) {
    if (predicate(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function insideOverlayCoveredTable(node, relativePath) {
  const tableNames = OVERLAY_COVERED_DATA_TABLES.get(relativePath);
  if (tableNames && ancestor(node, (current) =>
    ts.isVariableDeclaration(current) &&
    ts.isIdentifier(current.name) &&
    tableNames.has(current.name.text),
  )) return true;
  if (relativePath !== "src/lib/bench/reactions.ts") return false;
  const table = ancestor(node, (current) =>
    ts.isVariableDeclaration(current) &&
    ts.isIdentifier(current.name) &&
    current.name.text === "REACTIONS",
  );
  if (!table) return false;
  const property = ancestor(node, (current) => ts.isPropertyAssignment(current));
  return Boolean(
    property &&
    (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
    REACTION_OVERLAY_FIELDS.has(property.name.text),
  );
}

function inCodeAttribute(node) {
  const attribute = ancestor(node, (current) => ts.isJsxAttribute(current));
  if (!attribute || !attribute.name) return false;
  return CODE_ATTRIBUTE_NAMES.has(attribute.name.text);
}

function inImportOrPropertyKey(node) {
  if (ancestor(node, (current) => ts.isImportDeclaration(current) || ts.isExportDeclaration(current))) return true;
  if (ancestor(node, (current) => current.kind === ts.SyntaxKind.ImportType)) return true;
  if (ancestor(node, (current) =>
    ts.isCallExpression(current) && current.expression.kind === ts.SyntaxKind.ImportKeyword,
  )) return true;
  const property = node.parent;
  return Boolean(property && ts.isPropertyAssignment(property) && property.name === node);
}

function callName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

function staticText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((span) => span.literal.text).join("");
  }
  return undefined;
}

function collectStringNodes(root, sourceFiles) {
  const nodes = [];
  for (const [relativePath, source] of sourceFiles) {
    function visit(node) {
      if (ts.isJsxText(node)) {
        const text = normalizeText(node.getText(source));
        if (text) nodes.push({ node, relativePath, text, kind: "jsx" });
      } else {
        const text = staticText(node);
        if (text !== undefined) {
          nodes.push({ node, relativePath, text, kind: "literal" });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return nodes;
}

function dataPropertyAllowlist(sourceFiles) {
  const values = new Set();
  for (const [relativePath, source] of sourceFiles) {
    function visit(node) {
      if (
        relativePath === "src/lib/nuclear.ts" &&
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        ["NAMES", "SYMBOLS"].includes(node.name.text) &&
        node.initializer
      ) {
        function collectElementNames(current) {
          const value = stringValue(current);
          if (value && (node.name.text === "SYMBOLS" || value.includes("Hydrogen"))) {
            for (const name of value.split(/\s+/)) values.add(name);
          }
          ts.forEachChild(current, collectElementNames);
        }
        collectElementNames(node.initializer);
      }
      if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
        const propertyName = node.name.text;
        const value = stringValue(node.initializer);
        const parent = node.parent;
        const hasChemicalIdentifier = ts.isObjectLiteralExpression(parent) && parent.properties.some((property) =>
          ts.isPropertyAssignment(property) &&
          (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
          ["formula", "symbol"].includes(property.name.text),
        );
        if (value !== undefined && ["formula", "symbol", "pubchemName"].includes(propertyName)) values.add(value);
        if (value !== undefined && propertyName === "name" && hasChemicalIdentifier) values.add(value);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return values;
}

function scanI18n({ root = DEFAULT_ROOT } = {}) {
  const relativeFiles = [
    ...readFiles(path.join(root, "src", "components"), ".tsx", root),
    ...readFiles(path.join(root, "src", "app"), ".tsx", root),
    ...readFiles(path.join(root, "src", "lib"), ".ts", root),
  ].filter((relativePath) =>
    !relativePath.endsWith(".test.ts") &&
    !relativePath.endsWith(".test.tsx") &&
    !relativePath.startsWith("src/lib/i18n/") &&
    !relativePath.startsWith("src/app/api/") &&
    relativePath !== "src/lib/assistantPrompt.ts",
  );
  const sourceFiles = new Map(relativeFiles.map((relativePath) => [relativePath, parseFile(root, relativePath)]));
  const { keys: messageKeys, values: englishValues } = dictionary(root, "src/lib/i18n/en.ts");
  const { values: spanishValues } = dictionary(root, "src/lib/i18n/es.ts");
  const chemicalValues = dataPropertyAllowlist(sourceFiles);
  const staticWords = new Set([...STATIC_ALLOWLIST].flatMap(words));
  const allowedWords = new Set([
    ...staticWords,
    ...[...spanishValues].flatMap(words),
    ...[...chemicalValues].flatMap(words),
  ]);
  const handledNodes = new WeakSet();
  const translatedValueNodes = new WeakSet();

  function markTree(node) {
    const text = stringValue(node);
    if (text !== undefined && englishValues.has(text)) translatedValueNodes.add(node);
    ts.forEachChild(node, markTree);
  }

  for (const [, source] of sourceFiles) {
    function visit(node) {
      if (ts.isCallExpression(node)) {
        const name = callName(node.expression);
        if (name === "translateTree" && node.arguments.length > 1) markTree(node.arguments[1]);
        if ((name === "tr" || name === "t") && node.arguments.length > 0) {
          const key = stringValue(node.arguments[0]);
          const prefix = staticText(node.arguments[0]);
          if (
            (key && messageKeys.has(key)) ||
            (prefix && [...messageKeys].some((messageKey) => messageKey.startsWith(prefix)))
          ) handledNodes.add(node.arguments[0]);
        }
        if (name === "trText" && node.arguments.length > 1) {
          const text = stringValue(node.arguments[1]);
          if (text && englishValues.has(text)) handledNodes.add(node.arguments[1]);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }

  const allowlist = new Set(allowedWords);
  const findings = [];
  for (const item of collectStringNodes(root, sourceFiles)) {
    const { node, relativePath, kind } = item;
    const source = sourceFiles.get(relativePath);
    if (!source) continue;
    if (insideOverlayCoveredTable(node, relativePath)) continue;
    if (inCodeAttribute(node) || inImportOrPropertyKey(node)) continue;
    if (messageKeys.has(item.text) || isCodeLike(item.text) || STATIC_ALLOWLIST.has(item.text)) continue;
    if (item.text.split(/\s+/).every((token) => staticWords.has(token.toLowerCase()))) continue;
    if (item.text.includes("Science Lab") && item.text.includes("%s")) continue;
    const tokenList = words(item.text);
    if (!tokenList.length) continue;
    if (kind === "literal" && tokenList.length < 2) continue;
    const nonAllowed = tokenList.filter((token) => !allowedWords.has(token));
    const common = nonAllowed.some((token) => COMMON_ENGLISH.has(token));
    const englishLike = common || nonAllowed.some((token) => /^[a-z]{4,}$/.test(token));
    if (!englishLike) continue;
    if (handledNodes.has(node) || translatedValueNodes.has(node)) continue;
    const position = ts.getLineAndCharacterOfPosition(source, node.getStart(source));
    findings.push({
      file: relativePath,
      line: position.line + 1,
      text: item.text,
    });
  }
  const unique = [...new Map(findings.map((finding) => [
    `${finding.file}:${finding.line}:${finding.text}`,
    finding,
  ])).values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return {
    findings: unique,
    allowlistSize: allowlist.size,
    files: relativeFiles,
  };
}

export { scanI18n };

const isCli = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isCli) {
  const result = scanI18n();
  const grouped = new Map();
  for (const finding of result.findings) {
    const entries = grouped.get(finding.file) ?? [];
    entries.push(finding);
    grouped.set(finding.file, entries);
  }
  for (const [file, findings] of grouped) {
    console.log(`${file} (${findings.length})`);
    for (const finding of findings) {
      console.log(`  ${finding.file}:${finding.line}: "${finding.text.replaceAll("\"", "\\\"")}"`);
    }
  }
  console.log(`Total findings: ${result.findings.length}`);
  console.log(`Allowlist entries: ${result.allowlistSize}`);
  if (process.argv.includes("--strict") && result.findings.length) process.exitCode = 1;
}
