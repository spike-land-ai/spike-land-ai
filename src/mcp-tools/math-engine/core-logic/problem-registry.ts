/**
 * Math Engine — Problem Registry
 *
 * Contains: 3 audit gaps from the 16-framework analysis + classical Erdos conjectures.
 */

import type { Problem, ProblemCategory } from "./types.js";

const PROBLEMS: Problem[] = [
  // ─── Audit Gaps (from sixteen-mathematicians blog) ───
  {
    id: "convergence",
    title: "Convergence Proof Gap",
    category: "audit_gap",
    description: `The self-referential loop S_{t+1} = U(S_t, V(D(S_t))) lacks a convergence proof.
Need: contraction mapping argument, Jacobian spectral radius < 1 at fixed points,
or a Lyapunov function V(S) strictly decreasing along trajectories.
The adversary must check for feedback gain > 1 scenarios.`,
    status: "open",
    references: ["sixteen-mathematicians-walked-into-a-loop", "category theory (surviving)"],
  },
  {
    id: "uncomputability",
    title: "Uncomputability Gap",
    category: "audit_gap",
    description: `The valuation function V is claimed to have semantic properties,
but Rice's theorem shows all non-trivial semantic properties of programs are undecidable.
Need: classify which V properties are syntactic (decidable) vs semantic (undecidable),
identify the computability ceiling for bounded CF Workers automaton,
and produce honest characterization of computable approximations.`,
    status: "open",
    references: ["sixteen-mathematicians-walked-into-a-loop", "topology (surviving)"],
  },
  {
    id: "curry_paradox",
    title: "Curry's Paradox Gap",
    category: "audit_gap",
    description: `Self-referential proof attempts risk Curry's paradox:
"If this proof is valid, then P" proves P for any P.
Need: detect Curry-style self-reference in proof attempts,
inject grounding constraints (external observables, not self-assertion),
distinguish natural fixed points (from dynamics) vs injected (arbitrary).`,
    status: "open",
    references: ["sixteen-mathematicians-walked-into-a-loop", "quantum analogy (surviving)"],
  },

  // ─── Erdos Conjectures ───
  {
    id: "erdos-straus",
    title: "Erdős–Straus Conjecture",
    category: "erdos_conjecture",
    description: `For every integer n ≥ 2, the fraction 4/n can be expressed as
4/n = 1/x + 1/y + 1/z where x, y, z are positive integers.
Verified computationally for n up to 10^17 but no general proof exists.
Explore: parametric families, modular arithmetic approaches, Egyptian fraction decomposition.`,
    status: "open",
    references: ["erdos-straus-1948"],
  },
  {
    id: "erdos-ginzburg-ziv",
    title: "Erdős–Ginzburg–Ziv Extensions",
    category: "erdos_conjecture",
    description: `The EGZ theorem states: among any 2n-1 integers, some n have sum divisible by n.
Open extensions: weighted versions, higher-dimensional generalizations,
Davenport constant computations for non-cyclic groups.
Explore: zero-sum theory connections, polynomial method applications.`,
    status: "open",
    references: ["erdos-ginzburg-ziv-1961"],
  },
  {
    id: "unit-distance",
    title: "Unit Distance Problem",
    category: "erdos_conjecture",
    description: `What is the maximum number of unit distances among n points in the plane?
Known: Ω(n^{1+c/log log n}) ≤ u(n) ≤ O(n^{4/3}).
The gap between lower and upper bounds remains open.
Explore: algebraic geometry methods, incidence geometry, crossing number inequality.`,
    status: "open",
    references: ["erdos-1946-unit-distance"],
  },
  {
    id: "covering-systems",
    title: "Covering Systems Conjecture",
    category: "erdos_conjecture",
    description: `Erdős conjectured: for any c > 0, there exists a covering system
{a_i (mod n_i)} with all moduli n_i > c and distinct.
Hough (2015) proved minimum modulus ≤ 10^16. Open: tight bounds,
structure of extremal covering systems, connections to Carmichael numbers.
Explore: sieve methods, probabilistic combinatorics.`,
    status: "open",
    references: ["erdos-covering-1950", "hough-2015"],
  },
];

export function getAllProblems(): Problem[] {
  return [...PROBLEMS];
}

export function getProblemById(id: string): Problem | undefined {
  return PROBLEMS.find((p) => p.id === id);
}

export function getProblemsByCategory(category: ProblemCategory): Problem[] {
  return PROBLEMS.filter((p) => p.category === category);
}

export function getAuditGaps(): Problem[] {
  return getProblemsByCategory("audit_gap");
}

export function getErdosConjectures(): Problem[] {
  return getProblemsByCategory("erdos_conjecture");
}
