# Project Orbis — Conceptual Framework & Postmortem

*A synthesis of the concepts, techniques, and design insights behind a daily,
deterministic, collaborative myth-map worldbuilding game. This document is
deliberately abstract: it describes the ideas, not the stack. It is the theory
we arrived at by building.*

---

## Abstract

Orbis began as a simple premise — a grid where, once a day, a human places a
single tile — and turned out to be an exercise in several deeper ideas wearing
the same clothes. A world map, it turns out, is not a picture but a **grammar**:
a structure of cells, edges, and corners over which features grow according to
adjacency rules. The same grammar governs three things we initially treated as
separate: what the player is *allowed* to do (game logic), what the world *looks
like* (rendering), and how the world *changes over time* (dynamics). Most of our
hardest problems — and our best insights — came from recognizing that these are
one system viewed from three angles. The two recurring failure modes were
**irreversibility** (one-way transitions that collapse an emergent system into a
single inevitable outcome) and **incoherence** (transitions that ignore local
physical context). Both are local problems with global consequences, and both
are best diagnosed not by reasoning but by **measuring the system in aggregate
over long horizons.** What follows is the conceptual framework we converged on,
the lessons we paid for, and the tensions still open.

---

## 1. The premise, and why it got deep fast

The surface design is modest: a bounded grid, a daily cadence, one tile placed
per turn, chosen from a small hand of context-generated options, all derived
deterministically from a seed and recorded in an append-only log. Nothing about
that *sounds* like it requires a theory.

But three innocuous commitments forced one:

1. **The world must be coherent** — a placement should make physical sense given
   its surroundings. This turns tile placement into a constraint problem.
2. **The visuals must be derived from state, never authored** — there is no asset
   catalog, no hand-painted map. The picture is a *function* of the world's data.
   This turns rendering into a problem of *reading the grammar*.
3. **The world must evolve believably over thousands of turns** — not just be
   placed, but live: erode, flood, freeze, grow. This turns the map into a slow
   dynamical system, with all the attractors and phase transitions that implies.

Each commitment, pursued honestly, leads to the same place: **the world is a
generative grammar, and everything else is a view of it.**

---

## 2. The unified model: a world is a cell complex, not a picture

The foundational reframe is that a tile is not a pixel. It is a **cell in a
planar subdivision** — a little CW-complex with internal structure:

- **0-cells** — the corners, and *edge nodes* (ports) along each side.
- **1-cells** — the four edges.
- **2-cell** — the face itself.

Features in the world attach to *different parts of this complex*, and this
distinction is load-bearing — it is the single most clarifying idea in the whole
project:

| Feature kind | Lives on | Examples | Reads as |
|---|---|---|---|
| **Area** | the face / corner regions | terrain, biomes, climate cover | filled regions with diagonal boundaries |
| **Linear** | paths between edge nodes | rivers (and, later, roads) | port-to-port paths threading across tiles |
| **Point** | the center node | (future) settlements, shrines | a stamp at the tile's heart |

Zoom out and the whole map is a **planar graph**: tiles are faces, shared sides
are edges, corners are vertices. A *feature* is then a **subgraph** — a coastline
is the boundary chain between land faces and water faces; a river network is a
path subgraph; a biome is a connected region of faces. And the way features
*grow and merge* across tiles is a **graph grammar** — a set of rewrite rules
that say how the structure may extend.

This is not decoration. Once you see the map as a cell complex, the rest of the
design falls out: area features need *region/corner* logic, linear features need
*edge/port* logic, and the two genuinely are different problems that we kept
trying (and failing) to solve with one mechanism until we separated them.

---

## 3. The grammar equivalence: one idea, many names

The deepest insight — and one the design intuition reached before the research
confirmed it — is that a cluster of seemingly different formalisms are *the same
thing*:

- **Wang tiles** — squares with colored edges (or corners) that may only abut
  where colors match. The matching predicate *is* the entire legality test.
- **Constraint-satisfaction problems** — variables (tiles) with domains
  (possible terrains) and constraints (adjacency must be consistent).
- **Wave Function Collapse** — Wang/CSP run as a solver: order cells by entropy,
  collapse the most-constrained first, propagate the consequences.
- **Carcassonne** — a physical Wang system. Each edge carries a feature type;
  placement is legal iff abutting edges match; and — crucially — *the artwork is
  fully determined by the edge configuration.* The picture is a rendering of the
  grammar, not extra information.
- **Our card-legality rules** — the test of whether a given action "makes sense"
  on a given tile is, structurally, an adjacency constraint. Our generation gates
  are a hand-rolled constraint propagator.

The payoff of seeing these as one: **game logic and rendering are the same
grammar seen from two sides.** The rules that decide *what may be placed* and the
geometry that decides *how it is drawn* are not two systems to keep in sync —
they are one system, and keeping them in sync is automatic if you let the visuals
derive from the same adjacency facts the logic already computes. The "state is
the source of truth" principle is really a corollary of this equivalence.

A second corollary clarified the rendering: **corner-matching produces areas;
edge-matching produces paths.** Coloring the *corners* of tiles is the natural
model for terrain patches (a corner is shared by the quadrants of four tiles, so
it cleanly assigns regions); coloring the *edges* is the natural model for roads
and rivers (a path enters one edge and leaves another). This is exactly the
area/linear split from §2, now expressed in the rendering grammar.

---

## 4. Generation: interviewing the tile

Cards are not a fixed deck. Each turn the world **interviews** a tile — it reads
the tile's neighborhood (what terrains surround it, the local averages of
elevation, moisture, temperature, whether it touches water, high ground, ice,
lava) and from that context *generates* only the futures that are plausible
there. A volcano can't erupt on open ocean; a desert can't form in the wet cold;
a river needs a source uphill. The option space is **emergent from local
structure**, not enumerated in advance.

Two consequences fell out of this model, one good and one a tax:

- **(Good) Coherence is mostly free.** If the generator only ever proposes
  context-appropriate options, most incoherence is prevented at the source rather
  than corrected after the fact.
- **(Tax) The duplication problem.** Because options are generated from context,
  two *different* rules can independently propose the *same* outcome on the same
  tile — two cards that both turn this tile into a lake, for different stated
  reasons. This is confusing and degrades the meaning of a "choice." We elevated
  "**no two options may produce the same result on one tile**" to a first-class
  invariant. Enforcing it forced every rule to own a *distinct* niche, which in
  turn made the whole rule set more legible: every transition has exactly one
  story.

For *which* tile gets interviewed, the natural policy is the WFC instinct again:
favor the **most-constrained tiles** (fewest legal options). Resolving tight
spots first reduces dead-ends and yields more coherent growth than uniform random
choice — the world fills in the way water fills a vessel, edges and corners
first.

---

## 5. Determinism, and why it is not uniformity

The world is reproducible: a seed plus an ordered log of events reconstructs it
exactly. Determinism is a feature — it makes worlds shareable, debuggable, and
honest (nothing happens that isn't recorded).

But determinism has a trap we walked straight into. **A fully deterministic
substrate produces identical structure every time.** Our climate was, at first, a
pure function of latitude — so *every* world froze in exactly the same band and
warmed in exactly the same middle. Reproducibility had quietly become monotony.

The resolution is a principle worth stating plainly: **determinism is about
reproducibility, not sameness.** You want *deterministic per seed* and *varied
across seeds*. The way to get both is to inject **structured stochastic
variation** (seeded noise) into the deterministic substrate — enough to move the
features around from world to world, bounded enough to preserve the macro-laws
(poles still tend cold, equator still tends warm). The substrate stays lawful;
the particulars wander. This is the difference between a law of nature and a
specific planet.

---

## 6. Dynamics: the world as an equilibrium system

This is where the project taught us the most, because a map that *changes over
thousands of turns* is not a level — it is a **slow cellular automaton**, and it
obeys the logic of dynamical systems whether you designed for it or not.

### 6.1 The central lesson: one-way ratchets are absorbing states

Our most instructive failure: every long run, regardless of seed, collapsed to
the *same* end state — frozen poles and a drowned middle. It looked like a
content problem. It was a **structural** one.

The cause was **irreversibility**. Two transitions were one-way:

- Land could **sink** but, where it mattered, could not **rise** (the upward move
  was gated out of exactly the situations where the downward move fired).
- Cold water could **freeze** but frozen poles could never **thaw** (the reverse
  required warmth the poles never had).

In a system iterated thousands of times, **any irreversible transition is an
absorbing state.** A random walk with even a slight one-way bias does not wander
— it drains, monotonically, into the lowest configuration the rules allow. The
"outcome" wasn't chosen by the dynamics; it was *implied* by the asymmetry, and
the dice only decided how fast.

The fix was not more content or more randomness. It was **detailed balance**:
make every transition two-way. Give land an uplift to match its subsidence; give
ice a calving and melt to match its advance; make erosion answerable by
deposition. Once forward and reverse transitions coexist in the same conditions,
the system finds a *dynamic equilibrium* — a fluctuating coastline, a breathing
ice cap — instead of an inevitable terminus. **Reversibility is what turns a
deterministic collapse into a living system.**

This generalizes: *if you want emergence, audit your rules for one-way doors.*
Every transition that cannot be undone is a small gravity well, and over a long
enough horizon the system rolls into all of them at once.

### 6.2 Coherence is a per-transition, context-gated invariant

A second family of bugs — a seaside marsh "deepening" into a *freshwater* lake; sea
ice melting into *fresh* water — shared one root: **a transition that ignored its
physical context.** What a feature becomes must depend on what it sits in and
beside. Salt water melts to salt water; a marsh on the coast belongs to the sea,
not to an inland water table.

The lesson: **coherence is not a global property you can check at the end. It is
the sum of getting each local transition right, gated on the neighborhood.** The
fix is always the same shape — condition the outcome on context (what's adjacent,
what's below, salt vs fresh, high vs low) so the rule produces the *physically
appropriate* result rather than a generic one. Worldbuilding coherence is built
one honest transition at a time.

### 6.3 Systems have phase transitions; ours is saturation

Early in a world, most turns *grow* it — empty frontier becomes land or sea. But
once the grid fills, growth has nowhere to go, and the only remaining moves are
*transforms* of existing tiles at the mutable margins. The dynamics in these two
regimes are **completely different**: an early world is dominated by what
*appears*; a saturated world is dominated by what the edges can *become*. A
mechanism tuned for one regime can behave pathologically in the other.

A related structural fact: in a saturated world, only tiles touching open space
or open water are eligible to change. The deep interior **locks**. This is not
necessarily wrong — coastlines and frontiers *should* be where the action is —
but it means the late-game life of the world happens at its edges, and any desire
for interior change has to be designed in explicitly. **Know which phase your
system is in; the rules that felt right while it was filling may be the wrong
rules once it is full.**

### 6.4 Content cannot exist without a substrate that supports it

We added deserts and then could barely make them appear. Not a bug: a *wet,
water-dominated world simply has almost no hot, dry land for a desert to claim.*
The biome was reachable in principle and starved in practice, because the
macro-state of the world didn't produce its precondition. The lesson is sobering
and useful: **a content type is only as real as the substrate's tendency to
create the conditions it needs.** If you want deserts, you must first want
dryness; the feature is downstream of the climate, not independent of it.

---

## 7. Rendering: drawing the grammar

Because visuals are derived, rendering is not "painting tiles" — it is **reading
the adjacency grammar and drawing its boundaries.** The technique that fits is
**corner-based (dual-grid) autotiling**, the discrete cousin of **marching
squares**: instead of drawing one cell per world tile, draw a display grid
offset by half a tile, so each rendered cell straddles the point where four world
tiles meet. Reading those four corners yields a small set of cases whose
boundaries cut corner-to-corner — which is exactly why coastlines and terrain
edges come out **diagonal and organic** instead of blocky, with no authored art.
Multiple terrains stack as nested contour bands ordered by a fixed height
hierarchy (water beneath, land above, peaks highest), each boundary drawn where
two adjacent layers meet.

Two conceptual notes earned in practice:

- **The clean geometric model fights physical rendering reality.** Sub-pixel
  anti-aliasing and fractional scaling conspire to reveal seams the math says
  shouldn't exist — including, ironically, *the dual grid's own structure*
  showing through as a faint lattice. The lesson is that an idealized geometry
  always meets a rasterizer, and the rasterizer has opinions; part of "deriving
  visuals from state" is reconciling the perfect model with the imperfect medium.
- **Find the real seam of the abstraction.** The renderer's true joint is not
  "SVG vs canvas" — it is **"geometry derived from state"** versus **"how that
  geometry is painted."** Naming that boundary cleanly (a backend-agnostic scene
  of drawing primitives, and a painter that consumes it) makes the choice of
  drawing technology a swappable detail rather than an architectural commitment.
  The grammar work is independent of the medium.

---

## 8. Simulation as a design instrument

The single most valuable *practice* we adopted: when tuning an emergent system,
**do not reason locally — measure globally.** We ran the world headlessly for
thousands of turns across many seeds and looked at aggregate distributions: how
much land, how much ice, where the water concentrated, whether each feature ever
appeared.

This caught everything that local reasoning missed:

- It revealed the **collapse** as a stable attractor (same numbers, every seed),
  not a fluke.
- It *validated* the equilibrium fix quantitatively — the spread of outcomes
  widened, the terminus disappeared.
- It exposed the **desert famine** as structural (the precondition simply never
  occurred), saving us from "fixing" a rule that was already correct.

Emergent systems are not legible by inspection. A rule that looks balanced in
isolation can bias the whole system over a long horizon; a feature that *can*
happen may *never* happen. **Aggregate measurement over long time-scales is the
microscope for this kind of design**, and we should reach for it before, not
after, intuition.

---

## 9. Pain points and open tensions

- **Balancing emergence is whack-a-mole without measurement.** Every local fix
  perturbs the global distribution. Only the simulation harness made this
  tractable; without it, tuning is superstition.
- **Determinism ⇄ variety** is a permanent tension, not a solved problem. We
  bought variety with seeded noise, but the dial between "reproducible" and
  "surprising" has to be set deliberately for every system.
- **The interior lock** leaves the deep map static late-game. Coherent, but it
  caps how much a finished world can keep evolving without a deliberate mechanism
  for interior change.
- **Content has combinatorial cost.** Every new terrain or feature multiplies the
  rule surface — new adjacency constraints, new reverse transitions to keep the
  system two-way, new distinctness obligations to preserve the no-duplicates
  invariant. Content is not additive; it is multiplicative.
- **Substrate-gated content.** As above: features starve if the world doesn't
  tend to produce their preconditions. Designing a feature often means first
  designing the macro-conditions that make it possible.
- **Idealized geometry vs the rasterizer.** The renderer's correctness is
  partly a fight with anti-aliasing and scaling — the model is clean, the medium
  is not.

---

## 10. Principles, distilled

1. **A world is a grammar, not a picture.** Cells, edges, corners; area, linear,
   and point features; growth as graph rewriting.
2. **Logic, rendering, and dynamics are one grammar in three views.** Keep them
   in sync by deriving them all from the same adjacency facts.
3. **State is the source of truth; visuals are a pure function of it.**
4. **Generate from local context.** Interview the tile; offer only plausible
   futures; resolve the most-constrained first.
5. **Every option must own a distinct outcome.** Distinctness keeps choice
   meaningful and the rule set legible.
6. **Determinism is for reproducibility, not sameness.** Vary across seeds with
   bounded stochastic structure on a lawful substrate.
7. **For emergence, make transitions reversible.** Every one-way door is an
   absorbing state; over a long horizon the system rolls into all of them.
8. **Coherence is the sum of context-gated local transitions.** Salt vs fresh,
   above vs below, adjacent vs not — condition the outcome on the neighborhood.
9. **Mind the phase transition.** Filling and full are different regimes; tune
   for both.
10. **Content is downstream of substrate.** A feature is only as real as the
    world's tendency to create its preconditions.
11. **Measure emergent systems in aggregate over long horizons.** Simulation is
    the microscope; intuition is not.
12. **Find the real seam.** Abstraction boundaries are cheap insurance when drawn
    where the system actually bends.

---

## 11. Forward conceptual directions

The framework points naturally beyond the present world:

- **Ages as grammar layers.** Time can be modeled as successive grammars stacked
  on the same complex: a geological grammar (the present), then a *life* grammar
  (vegetation, ecology) reading the geology beneath it, then a *civilization*
  grammar of **linear and point features** (roads as edge-paths, settlements as
  center-nodes) — exactly the parts of the cell complex still unused. Each age is
  a new rule set over the same structure, not a new structure.
- **Rivers and roads as first-class linear features.** Treating flowing features
  as *paths through edge-nodes* rather than as area terrain would let them behave
  like the courses and networks they are — the area/linear distinction taken to
  its conclusion.
- **Narrative as emergent grammar.** The append-only event log is already a
  causal history. The "myth-map" promise is to read *that* as a grammar too —
  names, legends, and chronicle emerging from the same structural facts. The
  story is another view of the world, derived, like everything else, from state.

The throughline is constant: **find the grammar, and let logic, image, history,
and myth all be readings of it.**

---

*Postmortem status: nothing died. The world is alive, and it taught us how worlds
stay that way — by leaving every door open in both directions.*
