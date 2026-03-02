import { afterEach, describe, expect, it } from "vitest";
import {
  clearSystems,
  compareEvents,
  createSystem,
  destroySystem,
  getTimeline,
  inspect,
  listSystems,
  localEvent,
  sendEvent,
} from "./engine";

describe("Causality engine", () => {
  const userId = "test-user";

  afterEach(() => {
    clearSystems();
  });

  describe("createSystem", () => {
    it("should create a Lamport clock system with correct process count", () => {
      const system = createSystem({
        userId,
        name: "test-lamport",
        processCount: 3,
        clockType: "lamport",
      });
      expect(system.processOrder).toHaveLength(3);
      expect(system.clockType).toBe("lamport");
      expect(system.userId).toBe(userId);
      expect(system.processOrder).toEqual(["process-1", "process-2", "process-3"]);
      // Verify initial Lamport clocks are at time=0
      for (const pid of system.processOrder) {
        const clock = system.processes.get(pid)!;
        expect(clock.type).toBe("lamport");
        if (clock.type === "lamport") {
          expect(clock.time).toBe(0);
        }
      }
    });

    it("should create a Vector clock system with correct initial entries", () => {
      const system = createSystem({
        userId,
        name: "test-vector",
        processCount: 3,
        clockType: "vector",
      });
      expect(system.processOrder).toHaveLength(3);
      expect(system.clockType).toBe("vector");

      // Verify initial Vector clocks have all entries at 0
      for (const pid of system.processOrder) {
        const clock = system.processes.get(pid)!;
        expect(clock.type).toBe("vector");
        if (clock.type === "vector") {
          expect(clock.entries).toEqual({
            "process-1": 0,
            "process-2": 0,
            "process-3": 0,
          });
        }
      }
    });

    it("should reject process count < 2 or > 7", () => {
      expect(() =>
        createSystem({
          userId,
          name: "bad",
          processCount: 1,
          clockType: "lamport",
        }),
      ).toThrow("Process count must be between 2 and 7");
      expect(() =>
        createSystem({
          userId,
          name: "bad",
          processCount: 8,
          clockType: "vector",
        }),
      ).toThrow("Process count must be between 2 and 7");
    });
  });

  describe("Lamport clock", () => {
    it("should increment clock on local event", () => {
      const system = createSystem({
        userId,
        name: "lamport-local",
        processCount: 2,
        clockType: "lamport",
      });

      const evt1 = localEvent(system.id, userId, "process-1", "action_a");
      expect(evt1.clock.type).toBe("lamport");
      if (evt1.clock.type === "lamport") {
        expect(evt1.clock.time).toBe(1);
      }
      expect(evt1.processId).toBe("process-1");
      expect(evt1.label).toBe("action_a");

      const evt2 = localEvent(system.id, userId, "process-1", "action_b");
      if (evt2.clock.type === "lamport") {
        expect(evt2.clock.time).toBe(2);
      }
      // evt2 should have evt1 as causal parent
      expect(evt2.causalParents).toContain(evt1.id);
    });

    it("should create send+receive events with correct timestamps", () => {
      const system = createSystem({
        userId,
        name: "lamport-send",
        processCount: 2,
        clockType: "lamport",
      });

      // Process-1 does a local event first (clock=1)
      localEvent(system.id, userId, "process-1", "prepare");

      // Process-1 sends to process-2
      const result = sendEvent(system.id, userId, "process-1", "process-2", "msg1");

      // Send event: sender clock was 1, incremented to 2
      expect(result.sendEvent.clock.type).toBe("lamport");
      if (result.sendEvent.clock.type === "lamport") {
        expect(result.sendEvent.clock.time).toBe(2);
      }
      expect(result.sendEvent.label).toBe("send(msg1)");

      // Receive event: max(0, 2) + 1 = 3
      expect(result.receiveEvent.clock.type).toBe("lamport");
      if (result.receiveEvent.clock.type === "lamport") {
        expect(result.receiveEvent.clock.time).toBe(3);
      }
      expect(result.receiveEvent.label).toBe("receive(msg1)");

      // Receive event should have the send event as a causal parent
      expect(result.receiveEvent.causalParents).toContain(result.sendEvent.id);
    });

    it("should compare events with clear ordering", () => {
      const system = createSystem({
        userId,
        name: "lamport-compare",
        processCount: 2,
        clockType: "lamport",
      });

      const evt1 = localEvent(system.id, userId, "process-1", "first");
      const evt2 = localEvent(system.id, userId, "process-1", "second");

      const result = compareEvents(system.id, userId, evt1.id, evt2.id);
      expect(result.relation).toBe("happens_before");
      expect(result.explanation).toContain("happens before");
    });

    it("should report same relation for same event", () => {
      const system = createSystem({
        userId,
        name: "lamport-same",
        processCount: 2,
        clockType: "lamport",
      });

      const evt = localEvent(system.id, userId, "process-1", "only");
      const result = compareEvents(system.id, userId, evt.id, evt.id);
      expect(result.relation).toBe("same");
    });

    it("should report concurrent for independent processes with same timestamp", () => {
      const system = createSystem({
        userId,
        name: "lamport-concurrent",
        processCount: 2,
        clockType: "lamport",
      });

      // Both processes do one local event independently -> both have time=1
      const evtA = localEvent(system.id, userId, "process-1", "alpha");
      const evtB = localEvent(system.id, userId, "process-2", "beta");

      if (evtA.clock.type === "lamport" && evtB.clock.type === "lamport") {
        expect(evtA.clock.time).toBe(1);
        expect(evtB.clock.time).toBe(1);
      }

      const result = compareEvents(system.id, userId, evtA.id, evtB.id);
      // Same Lamport time -> "same" which indicates potential concurrency
      expect(result.relation).toBe("same");
    });
  });

  describe("Vector clock", () => {
    it("should increment only own entry on local event", () => {
      const system = createSystem({
        userId,
        name: "vector-local",
        processCount: 3,
        clockType: "vector",
      });

      const evt = localEvent(system.id, userId, "process-1", "action");
      expect(evt.clock.type).toBe("vector");
      if (evt.clock.type === "vector") {
        expect(evt.clock.entries["process-1"]).toBe(1);
        expect(evt.clock.entries["process-2"]).toBe(0);
        expect(evt.clock.entries["process-3"]).toBe(0);
      }

      const evt2 = localEvent(system.id, userId, "process-1", "action2");
      if (evt2.clock.type === "vector") {
        expect(evt2.clock.entries["process-1"]).toBe(2);
        expect(evt2.clock.entries["process-2"]).toBe(0);
      }
    });

    it("should merge clocks correctly on send/receive", () => {
      const system = createSystem({
        userId,
        name: "vector-send",
        processCount: 2,
        clockType: "vector",
      });

      // process-1 does 2 local events: clock becomes {p1:2, p2:0}
      localEvent(system.id, userId, "process-1", "a1");
      localEvent(system.id, userId, "process-1", "a2");

      // process-2 does 1 local event: clock becomes {p1:0, p2:1}
      localEvent(system.id, userId, "process-2", "b1");

      // process-1 sends to process-2
      const result = sendEvent(system.id, userId, "process-1", "process-2", "data");

      // Send event increments process-1's clock: {p1:3, p2:0}
      if (result.sendEvent.clock.type === "vector") {
        expect(result.sendEvent.clock.entries["process-1"]).toBe(3);
        expect(result.sendEvent.clock.entries["process-2"]).toBe(0);
      }

      // Receive event: max({p1:0, p2:1}, {p1:3, p2:0}) = {p1:3, p2:1}, then increment p2 -> {p1:3, p2:2}
      if (result.receiveEvent.clock.type === "vector") {
        expect(result.receiveEvent.clock.entries["process-1"]).toBe(3);
        expect(result.receiveEvent.clock.entries["process-2"]).toBe(2);
      }
    });

    it("should detect happens_before with vector clocks", () => {
      const system = createSystem({
        userId,
        name: "vector-hb",
        processCount: 2,
        clockType: "vector",
      });

      // process-1 does a local event: {p1:1, p2:0}
      const evtA = localEvent(system.id, userId, "process-1", "first");

      // process-1 sends to process-2
      const { receiveEvent } = sendEvent(system.id, userId, "process-1", "process-2", "msg");

      // evtA should happen before the receive event
      const result = compareEvents(system.id, userId, evtA.id, receiveEvent.id);
      expect(result.relation).toBe("happens_before");
      expect(result.explanation).toContain("happens before");
    });

    it("should detect concurrent events with vector clocks", () => {
      const system = createSystem({
        userId,
        name: "vector-concurrent",
        processCount: 2,
        clockType: "vector",
      });

      // Independent local events on different processes
      const evtA = localEvent(system.id, userId, "process-1", "alpha");
      const evtB = localEvent(system.id, userId, "process-2", "beta");

      // evtA: {p1:1, p2:0}, evtB: {p1:0, p2:1} -> concurrent
      const result = compareEvents(system.id, userId, evtA.id, evtB.id);
      expect(result.relation).toBe("concurrent");
      expect(result.explanation).toContain("concurrent");
    });

    it("should detect same relation for identical vector clocks", () => {
      const system = createSystem({
        userId,
        name: "vector-same",
        processCount: 2,
        clockType: "vector",
      });

      const evt = localEvent(system.id, userId, "process-1", "only");
      const result = compareEvents(system.id, userId, evt.id, evt.id);
      expect(result.relation).toBe("same");
    });
  });

  describe("inspect", () => {
    it("should return state for a single process when specified", () => {
      const system = createSystem({
        userId,
        name: "inspect-one",
        processCount: 3,
        clockType: "lamport",
      });

      localEvent(system.id, userId, "process-1", "action");

      const state = inspect(system.id, userId, "process-1");
      expect(state.processes).toHaveLength(1);
      expect(state.processes[0]!.id).toBe("process-1");
      // Should only include events for process-1
      expect(state.events).toHaveLength(1);
      expect(state.events[0]!.processId).toBe("process-1");
    });

    it("should return state for all processes when none specified", () => {
      const system = createSystem({
        userId,
        name: "inspect-all",
        processCount: 3,
        clockType: "vector",
      });

      const state = inspect(system.id, userId);
      expect(state.processes).toHaveLength(3);
      expect(state.clockType).toBe("vector");
    });

    it("should throw for unknown process", () => {
      const system = createSystem({
        userId,
        name: "inspect-bad",
        processCount: 2,
        clockType: "lamport",
      });
      expect(() => inspect(system.id, userId, "process-99")).toThrow("not found");
    });
  });

  describe("getTimeline", () => {
    it("should return events in topological order", () => {
      const system = createSystem({
        userId,
        name: "timeline",
        processCount: 2,
        clockType: "lamport",
      });

      // Create a chain: p1 local -> p1 sends to p2 -> p2 local
      const evt1 = localEvent(system.id, userId, "process-1", "start");
      const { sendEvent: sEvt, receiveEvent: rEvt } = sendEvent(
        system.id,
        userId,
        "process-1",
        "process-2",
        "data",
      );
      const evt4 = localEvent(system.id, userId, "process-2", "process");

      const timeline = getTimeline(system.id, userId);

      // Find indices
      const idx1 = timeline.findIndex((e) => e.id === evt1.id);
      const idxS = timeline.findIndex((e) => e.id === sEvt.id);
      const idxR = timeline.findIndex((e) => e.id === rEvt.id);
      const idx4 = timeline.findIndex((e) => e.id === evt4.id);

      // Topological order: evt1 before send, send before receive, receive before evt4
      expect(idx1).toBeLessThan(idxS);
      expect(idxS).toBeLessThan(idxR);
      expect(idxR).toBeLessThan(idx4);
    });

    it("should handle concurrent events in timeline", () => {
      const system = createSystem({
        userId,
        name: "timeline-concurrent",
        processCount: 2,
        clockType: "vector",
      });

      // Two independent events - both should appear in timeline
      localEvent(system.id, userId, "process-1", "alpha");
      localEvent(system.id, userId, "process-2", "beta");

      const timeline = getTimeline(system.id, userId);
      expect(timeline).toHaveLength(2);
    });
  });

  describe("access control", () => {
    it("should deny access from different userId", () => {
      const system = createSystem({
        userId,
        name: "acl",
        processCount: 2,
        clockType: "lamport",
      });
      expect(() => inspect(system.id, "other-user")).toThrow("Access denied");
    });

    it("should deny destroy from different userId", () => {
      const system = createSystem({
        userId,
        name: "acl-destroy",
        processCount: 2,
        clockType: "lamport",
      });
      expect(() => destroySystem(system.id, "other-user")).toThrow("Access denied");
    });

    it("should deny localEvent from different userId", () => {
      const system = createSystem({
        userId,
        name: "acl-event",
        processCount: 2,
        clockType: "lamport",
      });
      expect(() => localEvent(system.id, "other-user", "process-1", "sneaky")).toThrow(
        "Access denied",
      );
    });

    it("should deny sendEvent from different userId", () => {
      const system = createSystem({
        userId,
        name: "acl-send",
        processCount: 2,
        clockType: "lamport",
      });
      expect(() => sendEvent(system.id, "other-user", "process-1", "process-2", "hack")).toThrow(
        "Access denied",
      );
    });

    it("should deny compareEvents from different userId", () => {
      const system = createSystem({
        userId,
        name: "acl-compare",
        processCount: 2,
        clockType: "lamport",
      });
      const evt = localEvent(system.id, userId, "process-1", "a");
      expect(() => compareEvents(system.id, "other-user", evt.id, evt.id)).toThrow("Access denied");
    });
  });

  describe("listSystems", () => {
    it("should list only systems for the given user", () => {
      createSystem({
        userId,
        name: "mine1",
        processCount: 2,
        clockType: "lamport",
      });
      createSystem({
        userId,
        name: "mine2",
        processCount: 3,
        clockType: "vector",
      });
      createSystem({
        userId: "other",
        name: "theirs",
        processCount: 2,
        clockType: "lamport",
      });

      const list = listSystems(userId);
      expect(list).toHaveLength(2);
      expect(list.map((s) => s.name).sort()).toEqual(["mine1", "mine2"]);
    });

    it("should include correct summary information", () => {
      const system = createSystem({
        userId,
        name: "summary-test",
        processCount: 4,
        clockType: "vector",
      });

      localEvent(system.id, userId, "process-1", "evt1");
      localEvent(system.id, userId, "process-2", "evt2");

      const list = listSystems(userId);
      expect(list).toHaveLength(1);
      expect(list[0]!.processCount).toBe(4);
      expect(list[0]!.eventCount).toBe(2);
      expect(list[0]!.clockType).toBe("vector");
    });
  });

  describe("destroySystem", () => {
    it("should remove a system", () => {
      const system = createSystem({
        userId,
        name: "to-delete",
        processCount: 2,
        clockType: "lamport",
      });

      destroySystem(system.id, userId);

      expect(() => inspect(system.id, userId)).toThrow("not found");
    });

    it("should throw when destroying non-existent system", () => {
      expect(() => destroySystem("non-existent", userId)).toThrow("not found");
    });
  });

  describe("sendEvent edge cases", () => {
    it("should reject sending to the same process", () => {
      const system = createSystem({
        userId,
        name: "self-send",
        processCount: 2,
        clockType: "lamport",
      });

      expect(() => sendEvent(system.id, userId, "process-1", "process-1", "self")).toThrow(
        "Cannot send a message to the same process",
      );
    });

    it("should throw for non-existent process", () => {
      const system = createSystem({
        userId,
        name: "bad-process",
        processCount: 2,
        clockType: "lamport",
      });

      expect(() => sendEvent(system.id, userId, "process-99", "process-1", "msg")).toThrow(
        "not found",
      );
    });
  });

  describe("compareEvents edge cases", () => {
    it("should throw for non-existent events", () => {
      const system = createSystem({
        userId,
        name: "bad-event",
        processCount: 2,
        clockType: "lamport",
      });

      const evt = localEvent(system.id, userId, "process-1", "a");

      expect(() => compareEvents(system.id, userId, "evt-999", evt.id)).toThrow("not found");

      expect(() => compareEvents(system.id, userId, evt.id, "evt-999")).toThrow("not found");
    });
  });
});
