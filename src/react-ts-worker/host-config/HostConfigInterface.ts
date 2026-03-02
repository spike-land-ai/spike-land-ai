// Host config interface that all renderers must implement.
// The reconciler is parameterized by this interface.

export interface HostConfig<
  Type = string,
  Props = Record<string, unknown>,
  Container = unknown,
  Instance = unknown,
  TextInstance = unknown,
  HostContext = unknown,
  UpdatePayload = unknown,
> {
  // Instance creation
  createInstance(
    type: Type,
    props: Props,
    rootContainer: Container,
    hostContext: HostContext,
  ): Instance;

  createTextInstance(
    text: string,
    rootContainer: Container,
    hostContext: HostContext,
  ): TextInstance;

  // Tree mutations
  appendChild(parent: Instance | Container, child: Instance | TextInstance): void;
  appendChildToContainer(container: Container, child: Instance | TextInstance): void;
  appendInitialChild(parent: Instance, child: Instance | TextInstance): void;

  insertBefore(
    parent: Instance | Container,
    child: Instance | TextInstance,
    before: Instance | TextInstance,
  ): void;
  insertInContainerBefore(
    container: Container,
    child: Instance | TextInstance,
    before: Instance | TextInstance,
  ): void;

  removeChild(parent: Instance | Container, child: Instance | TextInstance): void;
  removeChildFromContainer(container: Container, child: Instance | TextInstance): void;

  // Updates
  commitUpdate(instance: Instance, type: Type, oldProps: Props, newProps: Props): void;
  commitTextUpdate(textInstance: TextInstance, oldText: string, newText: string): void;
  resetTextContent(instance: Instance): void;

  // Introspection
  shouldSetTextContent(type: Type, props: Props): boolean;
  getRootHostContext(rootContainer: Container): HostContext;
  getChildHostContext(parentHostContext: HostContext, type: Type): HostContext;

  // Commit lifecycle
  prepareForCommit(container: Container): Record<string, unknown> | null;
  resetAfterCommit(container: Container): void;
  finalizeInitialChildren(
    instance: Instance,
    type: Type,
    props: Props,
    hostContext: HostContext,
  ): boolean;
  prepareUpdate(
    instance: Instance,
    type: Type,
    oldProps: Props,
    newProps: Props,
    hostContext: HostContext,
  ): UpdatePayload | null;

  // Container operations
  clearContainer(container: Container): void;

  // Feature flags
  supportsMutation: boolean;
  isPrimaryRenderer: boolean;

  // Timing
  getCurrentTime(): number;
  scheduleMicrotask(fn: () => void): void;
}

// Type aliases for DOM-specific host config
export type DOMHostConfigType = HostConfig<
  string,
  Record<string, unknown>,
  Element,
  Element,
  Text,
  HostContextValue,
  boolean
>;

export interface HostContextValue {
  namespace: string;
}
