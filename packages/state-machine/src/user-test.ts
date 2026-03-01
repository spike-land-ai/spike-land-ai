import {
  createMachine,
  addState,
  addTransition,
  sendEvent,
  getState,
  resetMachine,
} from "./engine.js";

async function runUserTest() {
  console.log("🚦 Starting Real User Simulation...");

  // 1. Create a complex Traffic Light machine
  const machine = createMachine({
    name: "Advanced Traffic Light",
    userId: "user-123",
    initial: "system",
  });

  const mId = machine.definition.id;

  // 2. Define Main System (Compound)
  addState(mId, {
    id: "system",
    type: "compound",
    initial: "normal",
  });

  // 3. Define Normal Operation
  addState(mId, {
    id: "normal",
    type: "atomic",
    parent: "system",
  });

  // 4. Define Maintenance Mode (Parallel)
  addState(mId, {
    id: "maintenance",
    type: "parallel",
    parent: "system",
  });

  // Regions in Maintenance
  addState(mId, { id: "diagnostics", type: "compound", parent: "maintenance", initial: "idle" });
  addState(mId, { id: "idle", type: "atomic", parent: "diagnostics" });
  addState(mId, { id: "running", type: "atomic", parent: "diagnostics" });

  addState(mId, { id: "lights", type: "compound", parent: "maintenance", initial: "flashing_yellow" });
  addState(mId, { id: "flashing_yellow", type: "atomic", parent: "lights" });

  // 5. Add Transitions
  addTransition(mId, {
    source: "normal",
    target: "maintenance",
    event: "MAINTENANCE_START",
    actions: [],
    internal: false,
  });

  addTransition(mId, {
    source: "maintenance",
    target: "normal",
    event: "MAINTENANCE_END",
    actions: [],
    internal: false,
  });

  addTransition(mId, {
    source: "idle",
    target: "running",
    event: "START_DIAG",
    actions: [],
    internal: false,
  });

  // 6. Execute simulation
  resetMachine(mId);
  console.log("Initial State:", getState(mId).activeStates);

  console.log("\n--- Entering Maintenance Mode ---");
  sendEvent(mId, "MAINTENANCE_START");
  console.log("Active States:", getState(mId).activeStates);

  console.log("\n--- Starting Diagnostics ---");
  sendEvent(mId, "START_DIAG");
  console.log("Active States:", getState(mId).activeStates);

  console.log("\n--- Ending Maintenance ---");
  sendEvent(mId, "MAINTENANCE_END");
  console.log("Active States:", getState(mId).activeStates);

  console.log("\n✅ Simulation Complete!");
}

runUserTest().catch(console.error);
