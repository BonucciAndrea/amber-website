/* examples.js — the presets for the four-colour post's playground.
 * The page and _tests/dh.test.js both read this file, so a preset that stops
 * running fails the tests. One statement per line; `/` lines are comments. */
window.DH_EXAMPLES = [
  {
    id: "colourings",
    label: "Ring colourings",
    code: "/ every way to 4-colour an 8-ring, up to renaming the colours\nc:ess 8\n#*c\n/ the first five, one per row\n(+c)@!5"
  },
  {
    id: "check",
    label: "Check a configuration",
    code: "/ configuration 27 of the 2822: a 12-ring around 8 interior vertices\ncheck c27"
  },
  {
    id: "wheel",
    label: "A graph that fails",
    code: "/ one vertex of degree 6 inside a 6-ring. Edit the lists and re-run:\n/ (V;R;expected;neighbours of vertex 0, 1, ...), 0-based, ring first\ncheck (7;6;0N;(1 5 6;2 0 6;3 1 6;4 2 6;5 3 6;0 4 6;0 1 2 3 4 5))"
  },
  {
    id: "xor",
    label: "Kempe swap = XOR",
    code: "/ colours are 0..3; partition q pairs 0 with q+1. Swapping a Kempe\n/ chain is XOR with q+1 on its vertices. X is the XOR table.\nc:0 1 2 0 1 3\n/ q=0 pairs {0,1} and {2,3}; vertices 2 and 5 are whole {2,3} sectors\nchain:0 0 1 0 0 1\nq:0\n(c;c+chain*(X@(4*c)+q+1)-c)"
  },
  {
    id: "blocks",
    label: "Block decompositions",
    code: "/ how many ways k Kempe sectors can be joined into blocks: Catalan numbers\n#'DEC 2 4 6 8 10 12"
  }
];
