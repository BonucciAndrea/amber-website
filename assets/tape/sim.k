/ sim.k -- The Pit: the whole market-making simulation, in Amber.

/ The page owns the clock, the canvas and the keyboard. Everything else --
/ the tape, the order flow, the fills, the inventory, the cash, the P&L and
/ the round statistics -- happens in here.

/ The tape is generated UP FRONT as four vectors (tdd tar tsd tsz) rather
/ than drawn tick by tick. That matters for more than style: the player's own
/ expression may itself use `?`, and if the simulation drew from the same
/ stream a player who used randomness would silently get a different tape
/ from one who didn't. Pre-drawing makes the tape a pure function of the seed,
/ so two people running the same seed trade against exactly the same market
/ and their scores mean something.

/ Note on names: the mid is `px`, not `mid`, because `mid` is a real fin.k
/ verb (the midpoint of a quote table) that spreadbps, tsign and effspread
/ all call. Shadowing it would break them silently.

/ ---------------------------------------------------------------- parameters
TMS:50.0        / ms per tick -- the page drives at this rate
TROUND:1200     / ticks in a round (1200 * 50ms = 60 seconds)
TVOL:0.011      / per-tick diffusion of the mid
TTOL:0.040      / legacy reference width; each order draws its own from ttl
TIMP:0.0065     / permanent impact per unit of aggressive size
TARR:0.62       / probability an order arrives on a tick
TMAX:4          / largest order size
TPLIM:30.0      / inventory cap, absolute
TMIN:0.01       / minimum quote increment

tabs:{$[x<0;-x;x]}
tfin:{(~^x)&(x<1e12)&x>-1e12}                    / finite and non-null

/ --------------------------------------------------------------------- state
/ tinit[seed] resets everything and pre-draws the whole tape.
tinit:{[s]
  `prng s;
  tseed::s;
  tdd::TVOL*-1+2*TROUND?1.0;                     / diffusion per tick
  tar::TROUND?1.0;                               / arrival roll per tick
  tsd::-1+2*TROUND?2;                            / aggressor side: 1 buy, -1 sell
  tsz::`f$1+TROUND?TMAX;                         / aggressor size
  tu:TROUND?1.0;
  ttl::0.006+0.13*tu*tu;                         / how far THIS order will pay

  px::100.0; inv::0.0; cash::0.0; pnl::0.0;
  tk::0; t::0.0; vol::TVOL; flow::0.0;
  bid::99.98; ask::100.02;
  nf::0; rej::0; cap::0.0; gross::0.0; mdd::0.0; peak::0.0;
  fs::0; fp::0.0; fz::0.0;
  hx::,100.0;
  ftm::0#0; fsd::0#0; fpx::0#0.0; fsz::0#0.0;
  terr::"";
  }

/ ------------------------------------------------------------- the quote
/ Q is the player's lambda. It runs inside a trap: a bad expression records
/ its error and the desk falls back to a wide quote rather than the round
/ dying. A crossed or non-finite quote is repaired the same way -- otherwise
/ ask<bid would let the player buy below where they sell, for free money.
/ The trap takes a dummy argument: .[f;();catch] with an empty argument list
/ returns f itself rather than applying it, so a niladic Q would never run.
tq:{[]
  r:.[{[d]`f$Q[]};,0;{[e]terr::e;()}];
  r:$[(2=#r)&(&/tfin r);r;(px-0.06;px+0.06)];
  b:&/r; a:|/r;
  (b;a|b+TMIN)
  }

/ --------------------------------------------------------------------- fills
/ A buyer (s=1) lifts our ask when we are at or inside what they will pay;
/ a seller (s=-1) hits our bid on the same test. Size is capped by how much
/ room is left against TPLIM, so the cap throttles rather than refuses.
tdo:{[s;z]
  p:$[s>0;ask;bid];
  room:TPLIM-$[s>0;-inv;inv];                    / room to take this side on
  z:z&0.0|room;
  $[~z>0.0; [rej::rej+1; 0];                     / k has no <= : ~a>b is a<=b
    [ inv::$[s>0;inv-z;inv+z];
      cash::$[s>0;cash+z*p;cash-z*p];
      cap::cap+z*$[s>0;p-px;px-p];               / edge vs the mid at fill time
      gross::gross+z*p; nf::nf+1;
      fs::$[s>0;-1;1];                           / our side: -1 sold, +1 bought
      fp::p; fz::z;
      ftm::ftm,tk; fsd::fsd,fs; fpx::fpx,p; fsz::fsz,z;
      1]]
  }

/ --------------------------------------------------------------------- tick
tstep:{[]
  tk::tk+1; t::0.001*TMS*tk;
  i:tk-1;
  px::px+tdd i;                                  / diffusion
  q:tq[]; bid::q 0; ask::q 1;                    / the player's quote
  fs::0; fp::0.0; fz::0.0;
  flow::0.94*flow;
  s:tsd i; z:tsz i;
  $[TARR>tar i;
    [ w:ttl i;                                   / this order's price tolerance
      $[$[s>0; ~ask>px+w; ~bid<px-w]; tdo[s;z]; 0];
      flow::flow+0.06*s*z;
      px::px+TIMP*z*s ];                         / impact lands whoever traded
    0];
  tmark[];
  }

/ Mark to market, then the two rolling numbers the player can quote off.
tmark:{[]
  pnl::cash+inv*px;
  peak::peak|pnl; mdd::mdd|peak-pnl;
  hx::hx,px;
  hx::$[120<#hx;(-120)#hx;hx];                   / n#x CYCLES a short x, so only trim
  d:(1_hx)-(-1)_hx;
  vol::$[0<#d;%(+/d*d)%#d;TVOL];
  }

/ ------------------------------------------------------------------- readout
/ One tick of state as a single delimited line. Same idea as Dots' frame: one
/ string crosses the boundary, nothing is marshalled field by field.
tout:{[]`0:";"/$'(px;bid;ask;inv;cash;pnl;tk;nf;vol;flow;fs;fp;fz;rej;cap;mdd);}

/ Advance one tick and report.
tgo:{[]tstep[];tout[];}

/ Call Q once, untrapped, so the page can validate an expression the moment it
/ is typed. The in-round trap keeps a round alive, but it does not catch an
/ undefined name, so a bad quote has to be rejected before the round starts.
tqchk:{[]`f$Q[]}

/ ------------------------------------------------------------- end of round
/ The session's fills as a real table, so the summary is a qSQL query over
/ them rather than a running total kept by hand.
tfills:{[]([]tm:ftm;side:fsd;p:fpx;z:fsz)}
tstats:{[]select trades:#z, size:sum z, avgpx:avg p by side from tfills[]}
