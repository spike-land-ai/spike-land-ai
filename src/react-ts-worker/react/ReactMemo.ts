import type { FunctionComponent, MemoComponent } from "./ReactTypes.js";
import { REACT_MEMO_TYPE } from "./ReactSymbols.js";

export function memo<P>(
  type: FunctionComponent<P>,
  compare?: ((prevProps: P, nextProps: P) => boolean) | null,
): MemoComponent<P> {
  return {
    $$typeof: REACT_MEMO_TYPE,
    type,
    compare: compare ?? null,
  };
}
