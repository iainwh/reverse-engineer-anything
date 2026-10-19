import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { binaryKeyedArchive } from "./binaryKeyedArchive.js";
import { createTestTempDirectory } from "./temporaryDirectory.js";

const integer128 = (value: bigint): Buffer => {
  const bytes = Buffer.alloc(17);
  bytes[0] = 0x14;
  const encoded = BigInt.asUintN(128, value);
  bytes.writeBigUInt64BE(encoded >> 64n, 1);
  bytes.writeBigUInt64BE(BigInt.asUintN(64, encoded), 9);
  return bytes;
};

const integer64 = (value: bigint): Buffer => {
  const bytes = Buffer.alloc(9);
  bytes[0] = 0x13;
  bytes.writeBigInt64BE(value, 1);
  return bytes;
};

/** Minimal valid NSKeyedArchiver with a 16-byte integer and an Int64 control. */
export const keyedArchiveWideIntegerFixture = async () => {
  const root = await createTestTempDirectory("rea-keyed-wide-integers-");
  const path = join(root, "archive.bin");
  const bytes = binaryKeyedArchive([
    integer128(18_446_744_073_709_551_615n),
    integer64(9_223_372_036_854_775_807n),
  ]);
  await writeFile(path, bytes);
  return {
    root,
    path,
    bytes,
    digest: createHash("sha256").update(bytes).digest("hex"),
  };
};
