/ sweep.k -- Minesweeper, with no loop over cells anywhere.

/ The board is three flat N-vectors: mn (mine), rv (revealed), fl (flagged).
/ NI holds, for each of the 8 directions, the index of that neighbour for
/ EVERY cell at once; NV holds whether that neighbour is actually on the
/ board. Clamping the index and carrying a validity mask is what replaces the
/ usual bounds check -- and it means the entire board's adjacent-mine count is
/ a single indexed sum:  cnt: +/NV*mn@NI
/ The flood-fill that opens an empty region is a converge: keep adding the
/ neighbours of revealed empty cells until the set stops growing.

SOFF:(-1 -1;0 -1;1 -1;-1 0;1 0;-1 1;0 1;1 1)

/ sgeom[w;h] -- everything that depends only on the shape of the board.
sgeom:{[w;h]
  W::w; H::h; N::w*h;
  scol::W!!N; srow::_(!N)%W;
  NI::{[o](W*0|(H-1)&srow+o 1)+0|(W-1)&scol+o 0}'SOFF;
  NV::{[o]c:scol+o 0;r:srow+o 1;(c>-1)&(c<W)&(r>-1)&r<H}'SOFF;
  }

/ snew[w;h;m;seed] -- an empty board. The mines are not placed yet: the first
/ click has to be safe, so they are dealt in sfirst once we know where it was.
snew:{[w;h;m;seed]
  sgeom[w;h];
  M::m; SEED::seed;
  mn::N#0; rv::N#0; fl::N#0; cnt::N#0;
  live::0; dead::0; won::0;
  }

/ sfirst[i] -- deal M mines into cells that are neither i nor next to i, so
/ the opening click always lands in open space. -m?n is a DEAL (distinct),
/ where m?n would roll with repeats and quietly give you fewer mines.
sfirst:{[i]
  `prng SEED;
  ban:i,NI[;i]@&NV[;i];
  ok:(!N)^ban;
  mn::N#0;
  mn[ok@(-M)?#ok]:1;
  cnt::+/NV*mn@NI;
  live::1;
  }

/ sopen[i] -- reveal a cell, then let the empty region flood outwards.
sopen:{[i]
  $[live;;sfirst i];
  $[fl i;:0;];                                  / a flagged cell is protected
  $[rv i;:0;];
  $[mn i;[dead::1; rv[i]:1; :0];];
  rv[i]:1;
  rv::{x|(|/NV*(x&cnt=0)@NI)}/rv;               / converge: open the empty region
  rv::rv&~mn;                                   / never open a mine by flooding
  won::&/rv|mn;
  0}

/ sflag[i] -- toggle a flag on a hidden cell.
sflag:{[i]$[rv i;0;[fl[i]:~fl i;0]]}

/ schord[i] -- the classic middle-click: if a revealed cell already has as
/ many flags around it as its number, open its unflagged neighbours.
schord:{[i]
  $[~rv i;:0;];
  nbi:NI[;i]@&NV[;i];
  $[(cnt i)=+/fl nbi; sopen'nbi@&~fl nbi; 0];
  0}

/ ---------------------------------------------------------------- the view
/ One character per cell, so a whole board crosses the boundary as one string.
/ 0 hidden, 1..9 revealed with 0..8 neighbours, 10 flag, 11 mine, 12 wrong flag.
SCH:".012345678F*X"

/ On a loss every mine shows as a mine -- including the one just clicked,
/ which is revealed and would otherwise render as its own neighbour count --
/ and a flag on a cell that turned out to be empty shows as a wrong flag.
sview:{[]
  st:rv*1+cnt;
  st+:(fl&~rv)*10;
  st:$[dead;((~mn)*st+(fl&~mn)*2)+mn*11;st];
  SCH@st}

/ state;minesLeft;revealed;total  then the board
sout:{[]`0:(";"/$'(dead;won;M-+/fl;+/rv;N)),";",sview[];}
