import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { build } from "plist";
import { expect } from "vitest";

import { keyedArchiveResultSchema } from "../../src/domain/apple/keyedArchive.js";
import type { JsonValue } from "../../src/domain/jsonValue.js";
import { createTestTempDirectory } from "./temporaryDirectory.js";

const EXACT_INTEGER = { $plist_type: "integer", decimal: "9007199254740993" };
const ROUNDED = 9007199254740992;

/**
 * `<integer>` content CF scans as raw characters: markup and entity references
 * are not numeric text, so the decoder retains the literal as an explicit
 * unknown instead of guessing from a numeric prefix.
 */
const unknownInteger = (literal: string) => ({
  $plist_type: "unknown",
  element: "integer",
  literal,
  reason: literal.includes("<") ? "unsupported-markup" : "invalid-literal",
});

/** Integer literals whose exact text is retained because no value is established. */
const mixedArchiveNumberLiterals = [
  "9007199254740992<!-- split -->3",
  "9007199254740992<![CDATA[3]]>",
  "<![CDATA[9007199254740992]]>3",
  "<![CDATA[9007199254740992&#51;]]>",
  "9007199254740992<?rea split?>3",
  "9007199254740992<string>3</string>",
  "9007199254740992x",
] as const;

/** Ordinary dictionaries and malformed numeric references at the same boundary. */
export const archiveNumberMetadataCases = [
  ...[
    {
      element: "<real>9007199254740992<![CDATA[0]]></real>",
      value: 90071992547409920,
    },
    {
      element: "<real><![CDATA[1]]>9007199254740992</real>",
      value: Number("19007199254740992"),
    },
  ].map(({ element, value }) => ({
    name: element,
    source: { first: "__INTEGER__", other: "__OTHER__" },
    element,
    expected: { first: EXACT_INTEGER, other: value },
    unknownScalars: 0,
    exactIntegers: 1,
    malformedReference: false,
  })),
  ...mixedArchiveNumberLiterals.map((literal) => ({
    name: `<integer>${literal}</integer>`,
    source: { first: "__INTEGER__", other: "__OTHER__" },
    element: `<integer>${literal}</integer>`,
    expected: { first: EXACT_INTEGER, other: unknownInteger(literal) },
    unknownScalars: 1,
    exactIntegers: 1,
    malformedReference: false,
  })),
  ...(["UID", "CF$UID"] as const).flatMap((key) => [
    {
      name: `${key} dictionary data`,
      source: { [key]: { amount: "__INTEGER__" } },
      element: "",
      expected: { [key]: { amount: EXACT_INTEGER } },
      unknownScalars: 0,
      exactIntegers: 1,
      malformedReference: false,
    },
    {
      name: `${key} array data`,
      source: { [key]: ["__INTEGER__"] },
      element: "",
      expected: { [key]: [EXACT_INTEGER] },
      unknownScalars: 0,
      exactIntegers: 1,
      malformedReference: false,
    },
    {
      name: `${key} malformed numeric reference`,
      source: { [key]: "__INTEGER__" },
      element: "",
      expected: { [key]: ROUNDED },
      unknownScalars: 0,
      exactIntegers: 0,
      malformedReference: true,
    },
  ]),
  {
    name: "entity-encoded integer text",
    source: { amount: "__INTEGER__" },
    element: "",
    expected: { amount: unknownInteger("&#57;007199254740993") },
    unknownScalars: 1,
    exactIntegers: 0,
    malformedReference: false,
    integerElement: "<integer>&#57;007199254740993</integer>",
  },
] satisfies readonly {
  name: string;
  source: JsonValue;
  element: string;
  expected: JsonValue;
  /** XML scalar literals retained as explicit unknowns. */
  unknownScalars: number;
  /** Integers beyond the safe range reported with exact decimal text. */
  exactIntegers: number;
  malformedReference: boolean;
  integerElement?: string;
}[];

type MetadataCase = (typeof archiveNumberMetadataCases)[number];

/** Write one inert archive and retain the original byte digest for assertions. */
export const keyedArchiveNumberMetadataFixture = async (item: MetadataCase) => {
  const root = await createTestTempDirectory("rea-keyed-number-metadata-");
  const xml = build({
    $archiver: "NSKeyedArchiver",
    $version: 100000,
    $objects: ["$null", item.source],
    $top: { root: { CF$UID: 1 } },
  })
    .replace(
      "<string>__INTEGER__</string>",
      "integerElement" in item
        ? item.integerElement
        : "<integer>9007199254740993</integer>",
    )
    .replace("<string>__OTHER__</string>", item.element);
  const bytes = Buffer.from(xml);
  const path = join(root, "archive.plist");
  await writeFile(path, bytes);
  return {
    root,
    path,
    digest: createHash("sha256").update(bytes).digest("hex"),
  };
};

const countedLimitations = (
  limitations: readonly string[],
  subject: string,
  count: number,
) => {
  const notes = limitations.filter((note) => note.includes(subject));
  expect(notes).toHaveLength(count === 0 ? 0 : 1);
  for (const note of notes)
    expect(note.startsWith(`${String(count)} ${subject}`), note).toBe(true);
};

/** Require exact ordinary values, explicit unknowns and honest limitation counts. */
export const expectKeyedArchiveNumberMetadata = (
  value: unknown,
  item: MetadataCase,
  digest: string,
) => {
  const result = keyedArchiveResultSchema.parse(value);
  expect(result.archive_sha256).toBe(digest);
  expect(result.roots).toEqual({ root: { CF$UID: 1 } });
  expect(result.objects).toHaveLength(2);
  expect(result.objects[1]).toMatchObject({
    id: 1,
    kind: "dictionary",
    value: item.expected,
  });
  expect(result.references).toContainEqual({
    source: null,
    path: ["root"],
    target: 1,
    status: "resolved",
    raw: { CF$UID: 1 },
  });
  if (item.malformedReference)
    expect(result.references).toContainEqual({
      source: 1,
      path: [],
      target: null,
      status: "malformed",
      raw: item.expected,
    });
  else expect(result.references).toHaveLength(1);
  countedLimitations(
    result.limitations,
    "XML scalar value(s)",
    item.unknownScalars,
  );
  countedLimitations(
    result.limitations,
    "unambiguous integer value(s)",
    item.exactIntegers,
  );
  expect(result.limitations).not.toContainEqual(
    expect.stringContaining("could not be completely observed"),
  );
};
