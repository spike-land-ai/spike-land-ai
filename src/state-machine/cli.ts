#!/usr/bin/env node
import { createInterface } from "node:readline";
import {
  createMachine,
  sendEvent,
  getState,
  addState,
  addTransition,
  resetMachine,
  validateMachine,
} from "./engine.js";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

console.error("State Machine MCP-like CLI started. Send JSON commands.");

rl.on("line", (line) => {
  try {
    const command = JSON.parse(line);
    const { method, params, id } = command;

    let result;
    switch (method) {
      case "create":
        result = createMachine(params);
        break;
      case "addState":
        result = addState(params.machineId, params.state);
        break;
      case "addTransition":
        result = addTransition(params.machineId, params.transition);
        break;
      case "sendEvent":
        result = sendEvent(params.machineId, params.event, params.payload);
        break;
      case "getState":
        result = getState(params.machineId);
        break;
      case "reset":
        resetMachine(params.machineId);
        result = { status: "reset" };
        break;
      case "validate":
        result = validateMachine(params.machineId);
        break;
      default:
        throw new Error(`Unknown method: ${method}`);
    }

    process.stdout.write(JSON.stringify({ id, result }) + "\n");
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: (err as Error).message }) + "\n");
  }
});
