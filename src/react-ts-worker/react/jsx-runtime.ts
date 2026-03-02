import type { ReactElement } from "./ReactTypes.js";
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from "./ReactSymbols.js";

function jsxProd(type: unknown, config: Record<string, unknown>, maybeKey?: unknown): ReactElement {
  let key: string | null = null;

  if (maybeKey !== undefined) {
    key = "" + maybeKey;
  }

  if (config.key !== undefined) {
    key = "" + config.key;
  }

  let props: Record<string, unknown>;
  if (!("key" in config)) {
    props = config;
  } else {
    props = {} as Record<string, unknown>;
    for (const propName in config) {
      if (propName !== "key") {
        props[propName] = config[propName];
      }
    }
  }

  const ref = props.ref !== undefined ? (props.ref as ReactElement["ref"]) : null;

  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type: type as ReactElement["type"],
    key,
    ref,
    props,
    _owner: null,
  };
}

export const jsx = jsxProd;
export const jsxs = jsxProd;
export const Fragment = REACT_FRAGMENT_TYPE;
