import assign from "../shared/assign.js";

const emptyObject = {};

interface Updater {
  enqueueSetState(inst: unknown, payload: unknown, callback: unknown, callerName: string): void;
  enqueueForceUpdate(inst: unknown, callback: unknown, callerName: string): void;
}

const ReactNoopUpdateQueue: Updater = {
  enqueueSetState() {},
  enqueueForceUpdate() {},
};

export function Component(
  this: Record<string, unknown>,
  props: unknown,
  context: unknown,
  updater?: Updater,
) {
  this.props = props;
  this.context = context;
  this.refs = emptyObject;
  this.updater = updater || ReactNoopUpdateQueue;
}

Component.prototype.isReactComponent = {};

Component.prototype.setState = function (partialState: unknown, callback?: () => void) {
  if (
    typeof partialState !== "object" &&
    typeof partialState !== "function" &&
    partialState != null
  ) {
    throw new Error(
      "takes an object of state variables to update or a " +
        "function which returns an object of state variables.",
    );
  }
  this.updater.enqueueSetState(this, partialState, callback, "setState");
};

Component.prototype.forceUpdate = function (callback?: () => void) {
  this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
};

function ComponentDummy(this: Record<string, unknown>) {}
ComponentDummy.prototype = Component.prototype;

export function PureComponent(
  this: Record<string, unknown>,
  props: unknown,
  context: unknown,
  updater?: Updater,
) {
  this.props = props;
  this.context = context;
  this.refs = emptyObject;
  this.updater = updater || ReactNoopUpdateQueue;
}

const pureComponentPrototype = (PureComponent.prototype = new (
  ComponentDummy as unknown as new () => Record<string, unknown>
)());
pureComponentPrototype.constructor = PureComponent;
assign(pureComponentPrototype, Component.prototype);
pureComponentPrototype.isPureReactComponent = true;
