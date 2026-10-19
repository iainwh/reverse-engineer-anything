const asciiObject = (value: string): Buffer => {
  const bytes = Buffer.from(value, "ascii");
  return bytes.length < 15
    ? Buffer.concat([Buffer.from([0x50 | bytes.length]), bytes])
    : Buffer.concat([Buffer.from([0x5f, 0x10, bytes.length]), bytes]);
};

/** Binary plist date object: seconds since 2001-01-01T00:00:00Z as float64. */
export const binaryPlistDate = (seconds: number): Buffer => {
  const bytes = Buffer.alloc(9);
  bytes[0] = 0x33;
  bytes.writeDoubleBE(seconds, 1);
  return bytes;
};

/**
 * Minimal valid NSKeyedArchiver binary plist whose `$objects` are `$null`
 * followed by the given encoded scalar objects, rooted at `$top.root` -> UID 1.
 * Offsets and references use one byte each, which bounds the fixture to small
 * archives of at most 14 scalars.
 */
export const binaryKeyedArchive = (scalars: readonly Buffer[]): Buffer => {
  if (scalars.length > 14)
    throw new RangeError(
      "binary keyed archive fixture holds at most 14 scalars",
    );
  const nullIndex = 9;
  const objects = [
    Buffer.from([0xd3, 1, 3, 4, 2, 8, 5]), // root dict: three key/value pairs
    asciiObject("$archiver"),
    asciiObject("NSKeyedArchiver"),
    asciiObject("$objects"),
    asciiObject("$top"),
    Buffer.from([0xd1, 6, 7]), // $top.root -> UID 1
    asciiObject("root"),
    Buffer.from([0x80, 1]), // UID 1
    Buffer.from([
      0xa0 | (1 + scalars.length),
      nullIndex,
      ...scalars.map((_, index) => nullIndex + 1 + index),
    ]),
    asciiObject("$null"),
    ...scalars,
  ];
  const header = Buffer.from("bplist00", "ascii");
  const offsets: number[] = [];
  let position = header.length;
  for (const object of objects) {
    offsets.push(position);
    position += object.length;
  }
  if (position > 0xff)
    throw new RangeError(
      "binary keyed archive fixture exceeds one-byte offsets",
    );
  const offsetTable = Buffer.from(offsets);
  const trailer = Buffer.alloc(32);
  trailer[6] = 1;
  trailer[7] = 1;
  trailer.writeBigUInt64BE(BigInt(objects.length), 8);
  trailer.writeBigUInt64BE(0n, 16);
  trailer.writeBigUInt64BE(BigInt(position), 24);
  return Buffer.concat([header, ...objects, offsetTable, trailer]);
};
