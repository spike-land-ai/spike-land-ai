import type { ReactContext } from "./ReactTypes.js";
import { REACT_CONSUMER_TYPE, REACT_CONTEXT_TYPE } from "./ReactSymbols.js";

export function createContext<T>(defaultValue: T): ReactContext<T> {
  const context: ReactContext<T> = {
    $$typeof: REACT_CONTEXT_TYPE,
    _currentValue: defaultValue,
    _currentValue2: defaultValue,
    Provider: null as unknown as ReactContext<T>,
    Consumer: null as unknown as {
      $$typeof: symbol;
      _context: ReactContext<T>;
    },
  };

  context.Provider = context;
  context.Consumer = {
    $$typeof: REACT_CONSUMER_TYPE,
    _context: context,
  };

  return context;
}
