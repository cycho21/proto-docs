import { normalizedProtoStructure } from './protoScanner.ts';

export function compareProtoStructure(beforePath, afterPath) {
  const before = normalizedProtoStructure(beforePath);
  const after = normalizedProtoStructure(afterPath);
  const beforeText = JSON.stringify(before, null, 2);
  const afterText = JSON.stringify(after, null, 2);
  return { equal: beforeText === afterText, differences: beforeText === afterText ? [] : ['Proto structure differs outside comments'], before, after };
}
