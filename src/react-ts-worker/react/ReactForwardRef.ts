import type { ForwardRefComponent, ReactNode, Ref } from "./ReactTypes.js";
import { REACT_FORWARD_REF_TYPE } from "./ReactSymbols.js";

export function forwardRef<P, T>(
  render: (props: P, ref: Ref<T>) => ReactNode,
): ForwardRefComponent<P, T> {
  return {
    $$typeof: REACT_FORWARD_REF_TYPE,
    render,
  };
}
