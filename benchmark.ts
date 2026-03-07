const NUM_TRANSITIONS = 100000;
const NUM_ITERATIONS = 1000;

function evaluateGuard(expression, context) {
  // Mock guard
  return true;
}

const transitions = [];
for (let i = 0; i < NUM_TRANSITIONS; i++) {
  transitions.push({
    event: i % 10 === 0 ? "TARGET_EVENT" : "OTHER_EVENT",
    source: i % 10 === 0 ? "sourceA" : "sourceB",
    guard: { expression: "true" },
  });
}

const definition = {
  transitions,
};

const state = {
  currentStates: ["sourceA"],
  context: {},
};

const eventName = "TARGET_EVENT";

// Original
const startOriginal = performance.now();
for (let i = 0; i < NUM_ITERATIONS; i++) {
  const candidateTransitions = definition.transitions.filter(
    (t) => t.event === eventName && state.currentStates.includes(t.source),
  );

  const matchingTransition = candidateTransitions.find((t) => {
    if (!t.guard) return true;
    return evaluateGuard(t.guard.expression, state.context);
  });
}
const endOriginal = performance.now();
console.log(`Original: ${endOriginal - startOriginal}ms`);

// Optimized
const startOptimized = performance.now();
for (let i = 0; i < NUM_ITERATIONS; i++) {
  const matchingTransition = definition.transitions.find((t) => {
    if (t.event !== eventName || !state.currentStates.includes(t.source)) {
      return false;
    }
    if (!t.guard) return true;
    return evaluateGuard(t.guard.expression, state.context);
  });
}
const endOptimized = performance.now();
console.log(`Optimized: ${endOptimized - startOptimized}ms`);
