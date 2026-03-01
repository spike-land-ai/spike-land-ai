# @spike-land-ai/state-machine

Robust hierarchical statechart engine for `spike.land` with a safe recursive-descent guard expression parser.

## Features

- **Hierarchical States**: Support for nested compound and parallel states.
- **Safe Guard Expressions**: Custom parser avoids `eval()` for security.
- **Event-Driven**: Transitions triggered by events with optional payloads.
- **Actions**: `assign`, `log`, `raise`, and `custom` actions supported.
- **History States**: Restore previous state configurations.
- **Visualizer**: Generates a self-contained React+D3 visualization component.
- **CLI**: MCP-compatible JSON interface for automation and testing.

## Installation

```bash
npm install @spike-land-ai/state-machine
```

## Usage

```typescript
import { createMachine, addState, addTransition, sendEvent } from "@spike-land-ai/state-machine";

const machine = createMachine({
  name: "Toggle",
  userId: "user-1",
  initial: "off",
});

addState(machine.id, { id: "off", type: "atomic" });
addState(machine.id, { id: "on", type: "atomic" });

addTransition(machine.id, {
  source: "off",
  target: "on",
  event: "TOGGLE",
  actions: [{ type: "log", params: { message: "Turning on!" } }],
});

sendEvent(machine.id, "TOGGLE");
```

## MCP-like CLI

The package includes a CLI for interacting with the engine via JSON commands:

```bash
npx state-machine-cli
```

Example command (sent over stdin):
```json
{"method": "create", "params": {"name": "Test", "userId": "1", "initial": "s1"}, "id": 1}
```

## Improvement by "Diverse Team of 8 Agents"

This package has been optimized by a simulated team of specialized agents:

1. **Architect**: Decoupled core logic from Prisma persistence.
2. **Type Specialist**: Implemented discriminated unions for Actions and improved type safety.
3. **Parser Expert**: Enhanced the guard expression parser with `event.` access.
4. **Test Engineer**: Built a comprehensive Vitest suite for engine and parser.
5. **MCP Integrator**: Designed the JSON CLI interface.
6. **Security Auditor**: Validated safety of the custom parser.
7. **Visualizer Dev**: Refined the visualizer template and interactive runtime.
8. **Documentation**: Restructured README and usage guides.

## Testing

```bash
npm test
```

## License

MIT
