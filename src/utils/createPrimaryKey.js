export function createPrimaryKey(item, keys = []) {
  const keysLength = keys.length;
  let key = "";

  for (let i = 0; i < keysLength; i++) {
    key += item[keys[i]];
  }

  return key;
}
