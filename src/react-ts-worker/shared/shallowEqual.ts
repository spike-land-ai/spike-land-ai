import objectIs from "./objectIs.js";

const hasOwnProperty = Object.prototype.hasOwnProperty;

export default function shallowEqual(objA: unknown, objB: unknown): boolean {
  if (objectIs(objA, objB)) {
    return true;
  }

  if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null) {
    return false;
  }

  const keysA = Object.keys(objA as object);
  const keysB = Object.keys(objB as object);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (let i = 0; i < keysA.length; i++) {
    const currentKey = keysA[i]!;
    if (
      !hasOwnProperty.call(objB, currentKey) ||
      !objectIs(
        (objA as Record<string, unknown>)[currentKey],
        (objB as Record<string, unknown>)[currentKey],
      )
    ) {
      return false;
    }
  }

  return true;
}
