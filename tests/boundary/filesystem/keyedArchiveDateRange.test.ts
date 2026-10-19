import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { build } from "plist";
import { expect } from "vitest";

import { keyedArchiveResultSchema } from "../../../src/domain/apple/keyedArchive.js";
import { parseEvidence } from "../../../src/domain/evidence.js";
import {
  binaryKeyedArchive,
  binaryPlistDate,
} from "../../fixtures/binaryKeyedArchive.js";
import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";
import { cliTest, type TestCli } from "../../support/cli/cliFixture.js";

const inspect = async (cli: TestCli, path: string) => {
  const output = await cli.run({
    arguments: ["inspect-keyed-archive", path, "--json"],
    environment: { REA_LOG_LEVEL: "silent", REA_ANALYSIS_PROVIDER: "auto" },
  });
  expect(output.exitCode, output.stderr).toBe(0);
  return keyedArchiveResultSchema.parse(
    parseEvidence(output.json).normalized_result,
  );
};

cliTest(
  "built CLI keeps an XML date beyond the decoder range explicit without losing an extended year",
  async ({ cli }) => {
    const root = await createTestTempDirectory("rea-keyed-archive-date-");
    const path = join(root, "archive.plist");
    // plutil writes years past 9999 unsigned; the decoder reads them as UTC
    // fields, so only a year the JavaScript Date range cannot hold is unknown.
    const xml = build({
      $archiver: "NSKeyedArchiver",
      $version: 100000,
      $objects: [
        "$null",
        "__FAR__",
        "__BEYOND__",
        new Date("2020-01-01T00:00:00Z"),
      ],
      $top: { far: { CF$UID: 1 }, beyond: { CF$UID: 2 }, near: { CF$UID: 3 } },
    })
      .replace("<string>__FAR__</string>", "<date>11507-08-17T05:20:00Z</date>")
      .replace(
        "<string>__BEYOND__</string>",
        "<date>275761-01-01T00:00:00Z</date>",
      );
    await writeFile(path, xml);
    const result = await inspect(cli, path);
    expect(
      result.objects.map(({ id, kind, value }) => ({ id, kind, value })),
    ).toEqual([
      { id: 0, kind: "nil", value: "$null" },
      {
        id: 1,
        kind: "scalar",
        value: { $plist_type: "date", iso8601: "+011507-08-17T05:20:00.000Z" },
      },
      {
        id: 2,
        kind: "scalar",
        value: {
          $plist_type: "unknown",
          element: "date",
          literal: "275761-01-01T00:00:00Z",
          reason: "unrepresentable",
        },
      },
      {
        id: 3,
        kind: "scalar",
        value: { $plist_type: "date", iso8601: "2020-01-01T00:00:00.000Z" },
      },
    ]);
    expect(result.limitations).toContainEqual(
      expect.stringMatching(/^1 XML scalar value\(s\)/u),
    );
    expect(result.limitations).not.toContainEqual(
      expect.stringContaining("date value(s)"),
    );
  },
);

cliTest(
  "built CLI reports a binary date the decoder cannot represent as unknown",
  async ({ cli }) => {
    const root = await createTestTempDirectory("rea-keyed-archive-date-");
    const path = join(root, "archive.bin");
    // Binary dates are float64 seconds; beyond the Date range they are invalid.
    await writeFile(
      path,
      binaryKeyedArchive([binaryPlistDate(1e300), binaryPlistDate(0)]),
    );
    const result = await inspect(cli, path);
    expect(
      result.objects.map(({ id, kind, value }) => ({ id, kind, value })),
    ).toEqual([
      { id: 0, kind: "nil", value: "$null" },
      { id: 1, kind: "scalar", value: { $plist_type: "date", iso8601: null } },
      {
        id: 2,
        kind: "scalar",
        value: { $plist_type: "date", iso8601: "2001-01-01T00:00:00.000Z" },
      },
    ]);
    expect(result.limitations).toContainEqual(
      expect.stringMatching(/^1 date value\(s\)/u),
    );
  },
);
