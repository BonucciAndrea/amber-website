/ blackjack.k: a blackjack game written in Amber, with a basic-strategy coach.
/ ---
/ in a terminal:  amber blackjack.k    (80 x 24 or more; a narrow window, 42 x 32, gets the phone layout)
/ on a phone:     the same file runs in the browser (web/), where buttons send the same keys.
/ keys:  B bet   R rebet   H hit   S stand   D double   P split   ? hint   C chart   T training   Q quit
/ ---
/ the table plays like a casino 6-deck shoe game: 312 cards dealt without replacement from a
/ shuffled shoe, one card burned, and a cut card about 75% in (the shoe is reshuffled before the
/ next hand once it's past it). Cards come out in casino order: you, the dealer, you, the
/ dealer's hole card. The dealer stands on all 17s and checks for blackjack under an ace or a
/ ten; with an ace up you're offered insurance (even money with a blackjack). Blackjack pays
/ 3 to 2, insurance 2 to 1. Double on any first two cards, after a split too. Split pairs of the
/ same value (K-10 counts) up to 4 hands. Split aces get one card each, and 21 on them isn't a
/ blackjack. No surrender.
/ ---
/ the coach grades every move against basic strategy for exactly these rules. Your chips, record
/ and the spots you keep missing are saved (~/.amber_blackjack, or the phone's storage).
/ everything is named bj..., so the file can also be loaded next to other code.

/ ---- cards: an int 0..51, rank 13!c (0 is the ace), suit _c%13 -------------------------------
bjRK:(,'"A23456789"),("10";,"J";,"Q";,"K")
bjSU:("♠";"♥";"♦";"♣")
bjPT:1 2 3 4 5 6 7 8 9 10 10 10 10                 / points by rank, an ace as 1

bjpt:{s:+/bjPT 13!x;s+10*(s<12)&|/0=13!x}          / a hand's total: one ace counts 11 if that doesn't bust
bjsoft:{s:+/bjPT 13!x;(s<12)&|/0=13!x}             / is an ace counting 11?
bjnat:{(~bjSp)&(2=#x)&21=bjpt x}                   / your natural; 21 on two cards after a split isn't one
bjdnat:{(2=#bjD)&21=bjpt bjD}                      / the dealer's

/ ---- basic strategy for these rules (6 decks, dealer stands on soft 17, double after split) ----
/ a row per hand, a column per dealer card: 2 3 4 5 6 7 8 9 10 A.
/ H hit  S stand  D double (hit if you can't)  d double (stand if you can't)  P split
bjUC:9 0 1 2 3 4 5 6 7 8 8 8 8                     / the dealer card's column, by rank
bjHARD:(9#,"HHHHHHHHHH"),("HDDDDHHHHH";"DDDDDDDDHH";"DDDDDDDDDH";"HHSSSHHHHH"),(4#,"SSSSSHHHHH"),5#,"SSSSSSSSSS"   / by total 0..21
bjSOFT:(13#,"HHHHHHHHHH"),("HHHDDHHHHH";"HHHDDHHHHH";"HHDDDHHHHH";"HHDDDHHHHH";"HDDDDHHHHH";"SddddSSHHH"),3#,"SSSSSSSSSS"   / by total 0..21
bjPAIR:("----------";"PPPPPPPPPP";"PPPPPP----";"PPPPPP----";"---PP-----";"----------";"PPPPP-----";"PPPPPP----";"PPPPPPPPPP";"PPPPP-PP--";"----------")   / split? by card value 1..10; - plays the total

/ the book's letter for hand h against the dealer's card u (cp: may this hand split)
bjraw:{[h;u;cp]c:bjUC 13!u;t:bjpt h;v:bjPT 13!h;p:cp&(2=#h)&(v 0)=v 1
  $[p&"P"=bjPAIR[v 0;c];"P";bjsoft h;bjSOFT[t;c];bjHARD[t;c]]}
bjfin:{[r;cd]$[r="D";"DH"@~cd;r="d";"DS"@~cd;r]}   / the move, given whether you may double
bjbest:{[h;u;cp;cd]bjfin[bjraw[h;u;cp];cd]}
bjrow:{[h;cp]bjraw[h;;cp]'1 2 3 4 5 6 7 8 9 0}     / the hand's whole row, a dealer card per column
bjAN:"HSDP"!("hit";"stand";"double";"split")

bjVT:("";"A";"2";"3";"4";"5";"6";"7";"8";"9";"10")  / a card value as text
bjUT:("2";"3";"4";"5";"6";"7";"8";"9";"10";"A")     / a dealer column as text
bjkind:{[h;cp]v:bjPT 13!h;t:bjpt h;$[cp&(2=#h)&(v 0)=v 1;(bjVT v 0),",",bjVT v 0;bjsoft h;"soft ",$t;"hard ",$t]}
bjsit:{[h;u;cp](bjkind[h;cp])," vs ",bjUT bjUC 13!u}
/ the chart row a hand belongs to (its label in the chart) and a spot's key: row|column
bjrowkey:{[h;cp]v:bjPT 13!h;t:bjpt h;$[cp&(2=#h)&(v 0)=v 1;(bjVT v 0),",",bjVT v 0;bjsoft h;$[t=12;"A,A";"A,",$t-11];t<9;"5-8";t>16;"17+";$t]}
bjmkey:{[h;u;cp](bjrowkey[h;cp]),"|",$bjUC 13!u}
bjpage:{$[(#x)>x?",";$["A,"~2#x;$[x~"A,A";2;1];2];0]}   / which part of the chart a row label is in: 0 hard 1 soft 2 pairs

/ why the book says what it says: a rule of thumb for each part of the chart
bjwhy:{[h;u;cp]c:bjUC 13!u;t:bjpt h;a:bjraw[h;u;cp];v:bjPT 13!h;p:cp&(2=#h)&(v 0)=v 1;n:bjVT v 0
  $[p&a="P";$[1=v 0;"Always split aces: two hands starting on 11 beat one soft 12."
              8=v 0;"Always split 8s: 16 is the worst hand there is, and two hands starting on 8 do far better."
              "Split: two hands starting on ",n," do better against this card than one ",(bjkind[h;0]),"."]
    p&10=v 0;"Never split tens: 20 already wins most of the time."
    p&5=v 0;"Never split 5s: play them as a hard 10."
    p&9=v 0;$[c=5;"Don't split 9s against a 7: your 18 beats the 17 that dealer most often ends on.";"Don't split 9s against a 10 or an ace: stand on the 18."]
    p&4=v 0;"Split 4s only against a 5 or 6; otherwise hit the 8, it can't bust."
    p;"Don't split against a strong dealer card: hit it, as any ",(bjkind[h;0]),"."
    bjsoft h;$[t>18;"Stand: soft ",($t)," is strong enough."
               t=18;$[a="S";"Stand: soft 18 holds up well against a 2, 7 or 8."
                      a="d";"Double (stand if you can't): the dealer is weak, and one card can't bust you."
                      "Hit: soft 18 loses more than it wins against a 9, 10 or ace, and a soft hand can't bust on one card."]
               a="D";"Double (hit if you can't): one card can't bust a soft hand, and the dealer's card is weak."
               "Hit: a soft hand can't bust on one card, and it's too weak to double against this card."]
    t<9;"Hit: you can't bust, and it's too weak to double."
    t<12;$[a="D";"Double (hit if you can't): one card often makes a strong hand, and this dealer card is beatable.";"Hit, don't double: against this card the extra bet doesn't pay."]
    (t=12)&c<2;"Hit 12 against a 2 or 3: only a ten busts you, and those cards bust the dealer less often than 4, 5 or 6."
    (t<17)&c<5;"Stand: the dealer shows a weak card (2 to 6) and must hit to 17, so let them bust."
    t<17;"Hit: the dealer likely makes 17 or more, so a stiff hand loses unless you improve it."
    "Stand: hitting 17 or more busts too often."]}
bjINSWHY:"Insurance pays 2 to 1, but under an ace the dealer has a ten only about 31% of the time, so it loses about 7% of what you put on it. Never take it, not even as even money."

/ ---- colour and text: ANSI codes, widths counted on screen (a suit is 3 bytes but 1 column) ----
bjE:`c$27
bjc:{[a;s]bjE,"[",a,"m",s,bjE,"[0m"}
bjred:bjc["31"];bjgrn:bjc["32"];bjyel:bjc["33"];bjblue:bjc["34"];bjcyan:bjc["36"];bjdim:bjc["2"];bjbold:bjc["1"];bjgold:bjc["1;33"]
bjvw:{$[#x;[c:256!`i$x;j:1+!#c;le:|\j*c=27;lm:0,-1_|\j*c=109;+/~((le>0)&lm<le)|(c>127)&c<192];0]}   / visible width
bjfit:{[s;n]s,(0|n-bjvw s)#" "}
bjcut:{[s;n]$[n<bjvw s;[c:256!`i$s;j:1+!#c;le:|\j*c=27;lm:0,-1_|\j*c=109;e:(le>0)&lm<le;v:~e|(c>127)&c<192
  (s@&e|n>-1+\v),bjE,"[0m"];s]}                     / cut to n columns on screen, keeping the colour codes
bjlr:{[l;r]bjfit[l;bjW-bjvw r],r}                    / l on the left, r against the right edge
bjpad:{[s;w;n]s,(0|n-w)#" "}
bjup:{`c$(`i$x)-32*(x>"`")&x<"{"}
bjlow:{$[(x>"@")&x<"[";`c$32+`i$x;x]}
bjint:{10/-48+`i$x@&(x>"/")&x<":"}
bjth:{$[x<1000;$x;(bjth(_x%1000)),",",-3#"00",$1000!x]}
bjmoney:{a:x|-x;i:_a;(("";"-")x<0),(bjth i),$[a=i;"";".5"]}
bjpct:{[a;n]($_0.5+100*a%n),"%"}
bjwrap:{[w;s]ws:" "\s;{[w;a;x]$[w<(bjvw@*|a)+1+bjvw x;a,,x;(-1_a),,(*|a)," ",x]}[w]/[,*ws;1_ws]}
bjrule:{"  ",bjdim(,/(bjW-4)#,"─")}
bjind:{$[bjN;"  ";"    "]}                          / the left margin
bjcap:{[k;l](bjc["7;1"]" ",k," ")," ",l}            / a key cap: the key and what it does

/ ---- drawing cards: 7 columns by 5 rows, side by side, overlapping only when a hand can't fit ---
/ a suit is always followed by a space, never by a border, so a wide suit glyph can't break the box
bjsp:{x#,," "}
bjTOP:("╭";"─";"─";"─";"─";"─";"╮");bjBOT:("╰";"─";"─";"─";"─";"─";"╯")
bjHID:{h:(,"│"),(5#,bjblue"░"),,"│";(bjTOP;h;h;h;bjBOT)}[]
bjcard5:{$[x<0;bjHID;[r:bjRK 13!x;u:_x%13;f:$[(u=1)|u=2;bjred;bjbold];n:#r;rc:f'(,'r);sc:,f bjSU u
  (bjTOP;(,"│"),rc,sc,(bjsp 4-n),,"│";(,"│"),(bjsp 2),sc,(bjsp 2),,"│";(,"│"),(bjsp 5-n),rc,,"│";bjBOT)]]}
/ a hand's 5 lines in w columns: each card but the last takes o columns (8 is a card and a gap)
bjhand:{[cs;w]$[0=#cs;5#,"";[n:#cs;o:$[n<2;8;8&2|_(w-7)%n-1];cr:bjcard5'cs
  {[o;cr;j],/,/({[o;c]$[o>7;c,(o-7)#,," ";o#c]}[o]'(-1_cr)@\:j),,(*|cr)j}[o;cr]'!5]]}

/ a chart row: a cell per dealer card, column hl lit up, a red dot where you've missed it
bjcell:{[x;hl;ms]t:$[x="d";"Ds";,x];cl:$[x="S";"33";x="P";"36";|/x="Dd";"32";"39"];p:(3-(#t)+ms)#" "
  $[hl;bjc["7;",cl]t,$[ms;"•";""],p;(bjc[cl]t),$[ms;bjred"•";""],p]}   / lit up: one solid block
bjhdr:{[ind;t]ind,(bjbold t),((7-#t)#" "),bjdim"2  3  4  5  6  7  8  9  10 A"}
bjmarks:{[lb]$[#bjMs;{|/bjMs~\:x}'(lb,"|"),/:$!10;10#0b]}   / (|/ of nothing isn't 0)
bjline:{[ind;lb;r;hl]ind,bjpad[lb;#lb;7],,/bjcell'[r;hl=!10;bjmarks lb]}
bjHL:("5-8";"9";"10";"11";"12";"13";"14";"15";"16";"17+")
bjSL:{"A,",x}'bjVT 2+!8
bjPL:{x,",",x}'bjVT 2 3 4 5 6 7 8 9 10 1
bjtable:{[p;ind;cur]rl:{[ind;cur;lb;r]bjline[ind;lb;r;$[lb~cur 0;cur 1;-1]]}[ind;cur]   / one part of the chart
  $[p=0;(,bjhdr[ind;"HARD"]),rl'[bjHL;bjHARD 8+!10];p=1;(,bjhdr[ind;"SOFT"]),rl'[bjSL;bjSOFT 13+!8]
    (,bjhdr[ind;"PAIRS"]),rl'[bjPL;{bjrow[(x;x);1]}'1 2 3 4 5 6 7 8 9 0]]}

/ ---- the shoe ------------------------------------------------------------------------------
bjshuf:{bjS::1_52!-312?312;}                       / six decks, shuffled, one card burned
bjdraw:{c:*bjS;bjS::1_bjS;c}

/ ---- state ---------------------------------------------------------------------------------
bjinit:{`prng@0;bjBank::1000;bjStart::1000;bjLast::10;bjSt::0 0 0 0;bjCo::0 0;bjMs::();bjBack::0
  bjOn::0;bjHide::0;bjSp::0;bjI::0;bjH::();bjB::();bjF::();bjX::();bjDb::();bjD::();bjAsk::0;bjInsB::0
  bjMode::`table;bjPrev::`table;bjCP::0;bjQuit::0;bjEnt::0;bjBuf::"";bjMsg::""
  bjPK::`none;bjPD::();bjTK::`intro;bjTD::()
  bjDf::`all;bjDk::0 0;bjDs::0;bjQ::();bjDh::();bjDu::0
  bjW::80;bjN::0;bjsz::24 80;bjFQ::();bjWait::"0";bjDirty::0;bjshuf[];}

/ ---- saving: bank (in half chips), last bet, record, by-the-book count, the spots you miss ------
bjsavetext:{"\n"/($_2*bjBank;$bjLast;" "/$bjSt;" "/$bjCo),bjMs}
bjloadtext:{l:"\n"\x;st:bjint'" "\l 2;co:bjint'" "\l 3
  $[(3<#l)&(4=#st)&2=#co;[bjBank::0.5*bjint l 0;bjLast::1|bjint l 1;bjSt::st;bjCo::co;bjMs::{x@&0<#'x}4_l;bjBack::1];]
  bjStart::bjBank;}
bjFILE:"\"$HOME/.amber_blackjack\""
bjsave:{$[bjTest;;bjWeb;bjDirty::1;`x(("/bin/sh";"-c";"cat > ",bjFILE);bjsavetext[])];}
bjload:{$[bjTest|bjWeb;;.[{bjloadtext bjsh"cat ",bjFILE," 2>/dev/null"};,0;{}]];bjStart::bjBank;}

/ ---- the coach -----------------------------------------------------------------------------
/ the panel under the table keeps what it has to say as data (kind; hand; up card; may split;
/ may double; your move) and lays it out for the screen's width when it's drawn
bjunmiss:{i:(bjMs~\:x)?1b;$[i<#bjMs;bjMs::(i#bjMs),(i+1)_bjMs;];}
/ grade move a (one of HSDP) before it's played, against this hand and the dealer's up card.
/ a mistake stays up for the rest of the hand; the next hand clears it
bjcoach:{[a]h:bjH bjI;u:*bjD;cp:bjcansp[];cd:bjcandbl[];b:bjbest[h;u;cp;cd];m:bjmkey[h;u;cp];bjCo::bjCo+(a=b;1)
  $[a=b;[bjunmiss m;$[bjPK=`miss;;[bjPK::`ok;bjPD::(h;u;cp;cd;a)]]];[bjMs::bjMs,,m;bjPK::`miss;bjPD::(h;u;cp;cd;a)]];}

bjpanL:{[n]tr:bjMode=`train;k:$[tr;bjTK;bjPK];d:$[tr;bjTD;bjPD];ind:bjind[];w:bjW-2+#ind
  hd:$[k=`miss;bjred"✗ MISTAKE";k=`ins;bjred"✗ MISTAKE";k=`wrong;bjred"✗ WRONG";k=`right;bjgrn"✓ RIGHT"
       k=`hint;bjcyan"? HINT";k=`ok;bjgrn"✓ BY THE BOOK";k=`intro;bjdim"TRAINING";bjdim"COACH"]
  bk:$[tr;"";bjCo 1;bjdim"book ",bjpct[bjCo 0;bjCo 1];""]
  B:$[|/k=`miss`hint`right`wrong`ok;bjup bjAN bjbest[d 0;d 1;d 2;d 3];""]
  s:$[|/k=`miss`hint`right`wrong`ok;bjsit[d 0;d 1;d 2];""]
  sit:$[k=`miss;s,": you chose to ",(bjAN d 4),", the book says ",B;k=`wrong;s,": you said ",(bjAN d 4),", the play is ",B
        k=`hint;s,": the book says ",B;|/k=`right`ok;s,": ",B
        k=`ins;$[d;"Even money";"Insurance"],": the book says NO"
        k=`intro;$[bjWeb;"A hand and the dealer's card: what's the play? Nothing is at stake.";"A hand and the dealer's card: answer H, S, D or P. Nothing is at stake."]
        $[bjWeb;"Every move is checked against basic strategy. HINT asks before you move.";"Every move is checked against basic strategy.  ? hint   C chart   T training"]]
  why:$[|/k=`miss`hint`right`wrong;bjwrap[w;bjwhy[d 0;d 1;d 2]];k=`ins;bjwrap[w;bjINSWHY]
        k=`intro;bjwrap[w;"A miss comes back until you get it, and the chart marks the spots you still miss with a red dot. ",$[bjWeb;"FOCUS picks hard hands, soft hands or pairs.";"Focus: 1 hard, 2 soft, 3 pairs, 0 everything."]];()]
  ch:$[|/k=`miss`hint`right`wrong;(bjhdr[ind;""];bjline[ind;bjrowkey[d 0;d 2];bjrow[d 0;d 2];bjUC 13!d 1]);()]
  sit:bjwrap[w;sit];a:n-1;ch:$[a<(#sit)+#ch;();ch];why:((#why)&0|a-(#sit)+#ch)#why
  n#(,bjlr["  ",hd;bk,$[#bk;"  ";""]]),(ind,/:(a&#sit)#sit),(bjdim'ind,/:why),ch,n#,""}

/ ---- a hand at the table --------------------------------------------------------------------
bjcandbl:{$[bjOn;(2=#bjH bjI)&~bjBank<bjB bjI;0]}
bjcansp:{$[bjOn;[h:bjH bjI;(2=#h)&(=/bjPT 13!h)&(~bjBank<bjB bjI)&4>#bjH];0]}

bjbet:{[b]$[b<1;bjMsg::bjred"bet at least 1";b>bjBank;bjMsg::bjred"you have ",(bjmoney bjBank)," chips";bjround b]}
bjround:{[b]$[78>#bjS;[bjshuf[];bjMsg::bjdim"a fresh shoe: 6 decks, shuffled"];bjMsg::""]
  bjLast::b;bjBank::bjBank-b;bjPK::`none;bjOn::1;bjHide::1;bjSp::0;bjI::0;bjInsB::0
  bjH::,!0;bjD::!0;bjB::,b;bjF::,0b;bjX::,"";bjDb::,0b
  {$[2!x;bjD::bjD,bjdraw[];bjH::,(*bjH),bjdraw[]];bjframe[];bjsleep"0.22"}'!4   / you, dealer, you, the hole card
  $[(0=13!*bjD)&~bjBank<0.5*b;bjAsk::1;bjpeek[]];}
/ the dealer checks the hole card under an ace or a ten: a natural on either side ends the hand
bjpeek:{$[(21=bjpt bjD)|21=bjpt@*bjH;bjend[];]}
bjinsure:{[y]bjAsk::0;bjCo::bjCo+(~y;1)
  $[y;[bjInsB::0.5*bjB 0;bjBank::bjBank-bjInsB;bjPK::`ins;bjPD::bjnat bjH 0];bjPK::`none]
  bjpeek[]
  $[bjOn&y;bjMsg::bjdim"no blackjack underneath: the insurance is lost";];}

bjmove:{bjMsg::""}
bjhit:{bjmove[];bjcoach"H";bjH::@[bjH;bjI;,;bjdraw[]];bjgo[]}
bjstand:{bjmove[];bjcoach"S";bjnext[]}
bjdbl:{bjmove[];bjcoach"D";b:bjB bjI;bjBank::bjBank-b;bjB::@[bjB;bjI;:;2*b];bjDb::@[bjDb;bjI;:;1b]
  bjH::@[bjH;bjI;,;bjdraw[]];bjframe[];bjsleep"0.4";bjnext[]}
bjsplit:{bjmove[];bjcoach"P";i:bjI;h:bjH i;b:bjB i;a:0=13!h 0;bjBank::bjBank-b;bjSp::1
  bjH::(i#bjH),(,,h 0),(,,h 1),(i+1)_bjH
  bjB::(i#bjB),(b;b),(i+1)_bjB
  bjF::(i#bjF),(a;a),(i+1)_bjF                      / split aces: one card each, and they're done
  bjDb::(i#bjDb),(2#0b),(i+1)_bjDb;bjX::(#bjH)#,""
  bjframe[];bjsleep"0.25";bjH::@[bjH;i;,;bjdraw[]];bjframe[];bjsleep"0.25";bjH::@[bjH;i+1;,;bjdraw[]]
  $[a;bjnext[];bjgo[]]}
bjgo:{$[21>bjpt bjH bjI;;[bjframe[];bjsleep"0.4";bjnext[]]];}   / 21 stands by itself, a bust moves on
bjnext:{bjF::@[bjF;bjI;:;1b];j:&~bjF;$[#j;[bjI::*j;bjgo[]];bjend[]];}

/ one hand against the dealer: (chips back; what happened; 0 won 1 lost 2 pushed 3 blackjack)
bjres:{[h;b]p:bjpt h;d:bjpt bjD;pn:bjnat h;dn:bjdnat[]
  $[pn&dn;(b;bjyel"PUSH";2)
    pn;(2.5*b;bjgold"BLACKJACK +",bjmoney 1.5*b;3)
    dn;(0;bjred"LOSE -",bjmoney b;1)
    p>21;(0;bjred"BUST -",bjmoney b;1)
    d>21;(2*b;bjgrn"WIN +",bjmoney b;0)
    p>d;(2*b;bjgrn"WIN +",bjmoney b;0)
    p=d;(b;bjyel"PUSH";2)
    (0;bjred"LOSE -",bjmoney b;1)]}

bjend:{bjOn::0;bjHide::0;bjframe[];bjsleep"0.5"
  $[|/{(22>bjpt x)&~bjnat x}'bjH;{17>bjpt bjD}{bjD::bjD,bjdraw[];bjframe[];bjsleep"0.6";x}/0;]   / the dealer draws if a hand is still alive
  r:bjres'[bjH;bjB];ip:$[bjdnat[];3*bjInsB;0]
  bjBank::bjBank+ip++/r[;0];bjX::r[;1];bjSt::bjSt++/'(!4)=\:r[;2]
  n:(ip++/r[;0])-bjInsB++/bjB;dt:bjpt bjD
  dd:$[bjdnat[];"dealer blackjack";dt>21;"dealer busts";"dealer ",$dt],$[ip>0;", insurance pays ",bjmoney 2*bjInsB;""]
  bjMsg::$[(1=#bjH)&3=*r[;2];bjgold"Blackjack!  You win ",bjmoney n;&/21<bjpt'bjH;bjred"Bust.  You lose ",bjmoney(-n)
    n>0;bjgrn"You win ",bjmoney n;n<0;bjred"You lose ",bjmoney(-n);bjyel"Push"]
  bjMsg::bjMsg,bjdim"  ·  ",dd
  bjsave[];}

/ ---- training: a hand and a dealer card, answered with H S D P -------------------------------
/ 28 rows of the chart worth learning (hard 8-17, soft 13-20, every pair) times 10 dealer cards.
/ a miss comes back three questions later; spots you've missed before come up more often.
bjDROWS:`all`hard`soft`pairs!(!28;!10;10+!8;18+!10)
bjC2V:2 3 4 5 6 7 8 9 10 1                         / a dealer column's card value
bjpick:{x@*1?#x}
bjv2r:{$[x=1;0;x<10;x-1;9+*1?4]}                    / a card value (1 is the ace) to a rank: a ten is any of 10 J Q K
bjr2c:{x+13**1?4}                                   / a rank to a card of any suit
/ a question of kind k (0 hard: n is the total, 1 soft: n is the other card, 2 a pair of n) against column col
bjmk:{[k;n;col]u:bjr2c bjv2r bjC2V col
  h:$[k=0;[c:2+!9;a:bjpick c@&(c<n-c)&11>n-c;(a;n-a)];k=1;(1;n);(n;n)]   / a hard total from two different cards
  (bjr2c'bjv2r'h@-2?2;u)}
bjgen:{[r]s:$[r<10;(0;8+r);r<18;(1;r-8);(2;r-17)];bjmk[s 0;s 1;*1?10]}
bjkk:{k:(x?"|")#x;$[k~"A,A";`pairs;"A,"~2#k;`soft;(#k)>k?",";`pairs;`hard]}   / a spot's part of the chart
bjfromkey:{i:x?"|";k:i#x;s:$[k~"A,A";(2;1);"A,"~2#k;(1;bjint 2_k);(#k)>k?",";(2;bjint(k?",")#k);k~"5-8";(0;8);k~"17+";(0;17);(0;bjint k)];bjmk[s 0;s 1;bjint(i+1)_x]}
bjdq:{c:$[`all=bjDf;bjMs;bjMs@&bjDf=bjkk'bjMs]
  s:$[$[#bjQ;~(bjDk 1)<bjQ[0;2];0];[q:*bjQ;bjQ::1_bjQ;q 0 1];(#c)&0.3>*1?1f;bjfromkey bjpick c;bjgen bjpick bjDROWS bjDf]
  bjDh::s 0;bjDu::s 1;}
bjdpair:{v:bjPT 13!bjDh;(v 0)=v 1}
bjtrain:{[f]bjMode::`train;bjDf::f;bjDk::0 0;bjDs::0;bjQ::();bjTK::`intro;bjMsg::"";bjdq[]}
bjtans:{[a]h:bjDh;u:bjDu;b:bjbest[h;u;1;1];ok:a=b;m:bjmkey[h;u;1];bjDk::bjDk+(ok;1);bjDs::$[ok;bjDs+1;0]
  $[ok;bjunmiss m;[bjQ::bjQ,,(h;u;3+bjDk 1);bjMs::bjMs,,m]]
  bjTK::$[ok;`right;`wrong];bjTD::(h;u;1;1;a);bjdq[];bjsave[]}
bjFOC:`all`hard`soft`pairs

/ ---- the screens -----------------------------------------------------------------------------
bjtot:{[h;d]t:bjpt h;$[0=#h;"";$[d;bjdnat[];bjnat h];bjgold"BLACKJACK";t>21;bjred"BUST ",$t;t=21;bjgrn"21"
  (bjsoft h)&(t<21)&bjOn|bjMode=`train;"soft ",$t;$t]}
bjtitleL:{l:"  ",(bjgold"BLACKJACK"),"  ",(bjSU 0)," ",(bjred bjSU 1)," ",(bjred bjSU 2)," ",bjSU 3
  r:$[bjMode=`chart;bjdim"basic strategy"
      bjMode=`train;(bjbold"TRAINING"),$[bjDk 1;bjdim"  ",($bjDk 0),"/",($bjDk 1),$[bjDs>2;"  streak ",$bjDs;""];""]
      [d:bjBank-bjStart;(bjbold bjmoney bjBank),(bjdim" chips"),$[d>0;bjgrn" +",bjmoney d;d<0;bjred" -",bjmoney(-d);""]]]
  bjlr[l;r,"  "]}

bjcol:{[cw;i]h:bjH i;act:bjOn&(i=bjI)&1<#bjH;nm:$[1=#bjH;"YOU";"HAND ",$1+i]
  lab:($[act;bjyel bjbold"▸ ",nm;bjbold nm]),$[#h;"  ",bjtot[h;0];""]
  res:$[(1<#bjH)&#bjX i;bjX i;bjdim"bet ",(bjmoney bjB i),$[bjDb i;" doubled";""]]
  (,lab),(bjhand[h;cw-1]),,res}
/ your hands, up to 2 a row on a phone and 4 in a terminal: 7 lines a row
bjplayer:{n:#bjH;k:$[bjN;2;4];cw:_(bjW-#bjind[])%k&n
  r:{[k;n;x]x+!k&n-x}[k;n]'k*!-_-n%k
  ,/{[cw;r]C:bjcol[cw]'r;{[cw;C;j](bjind[]),,/bjfit[;cw]'C@\:j}[cw;C]'!7}[cw]'r}
bjwelcome:{ind:bjind[];w:bjW-2+#ind
  t:$[bjBank<1;$[bjWeb;"You're out of chips: tap NEW for a fresh 1,000.";"You're out of chips: press N for a fresh 1,000."]
      $[bjWeb;"Tap BET to choose a bet, or REBET for ",(bjmoney(_bjLast&bjBank)),".";"Press B to choose a bet, or R to bet ",(bjmoney(_bjLast&bjBank)),"."]]
  7#("";ind,bjbold$[bjBack;"Welcome back.";"Welcome to the table."];""),(ind,/:bjwrap[w;"You have ",(bjmoney bjBank)," chips. ",t]),7#,""}

/ the message line(s): what just happened, the bet you're typing, or the insurance question
bjmsgL:{[n]ind:bjind[]
  t:$[bjEnt;(bjbold"Bet: "),bjBuf,(bjyel"_"),bjdim"   you have ",bjmoney bjBank
      bjAsk;bjbold$[bjnat bjH 0;"The dealer shows an ace. Even money?";"The dealer shows an ace. Insurance for ",(bjmoney 0.5*bjB 0),"?"]
      bjMode=`train;$[#bjMsg;bjMsg;bjdim"What's the play?"];bjMsg]
  l:bjwrap[bjW-2+#ind;t]
  n#(ind,/:l),n#,""}

bjtableL:{tr:bjMode=`train;ind:bjind[]
  D:$[tr;,bjDu;bjHide&2=#bjD;(1#bjD),-1;bjD]
  dl:ind,(bjbold"DEALER"),$[tr|bjHide|0=#bjD;"";"  ",bjtot[bjD;1]]
  P:$[tr;7#(,ind,(bjbold"YOU"),"  ",bjtot[bjDh;0]),(ind,/:bjhand[bjDh;bjW-4]),,"";#bjH;bjplayer[];bjwelcome[]]
  dc:ind,/:bjhand[D;bjW-4]
  $[bjN;[pn:$[7<#P;2;9];(bjtitleL[];bjrule[];"";dl),dc,(,""),(bjmsgL 2),(,""),P,("";bjrule[]),bjpanL pn]
    (bjtitleL[];bjrule[];dl),dc,(bjmsgL 1),P,(,bjrule[]),bjpanL 6]}

bjchartL:{cur:$[bjPrev=`train;(bjrowkey[bjDh;1];bjUC 13!bjDu);bjOn;(bjrowkey[bjH bjI;bjcansp[]];bjUC 13!*bjD);("";-1)]
  lg:("";"H hit   ",(bjyel"S")," stand   ",(bjcyan"P")," split";(bjgrn"D"),"  double, or hit if you can't";(bjgrn"Ds")," double, or stand if you can't";(bjred"•"),"  a spot you still get wrong"
      $[0>cur 1;"";(bjc["7"]"   ")," your hand right now"];"";bjdim"6 decks, dealer stands on soft 17,";bjdim"double after split, no surrender.";bjdim"Never take insurance.")
  $[bjN;(bjtitleL[];bjrule[];""),(bjtable[bjCP;"  ";cur]),"  ",/:lg
    [L:(bjtable[0;"  ";cur]),(,""),bjtable[1;"  ";cur];R:(bjtable[2;"";cur]),lg
     (bjtitleL[];bjrule[]),((bjfit[;41]'L),'R)]]}

/ the key line at the bottom of a terminal: only the keys that do something now
bjkeysL:{e:$[bjMode=`chart;$[bjN;(("1";"hard");("2";"soft");("3";"pairs");("Esc";"back"));,("any key";"back")]
  bjEnt;(("0-9";"amount");("Enter";"deal");("Esc";"cancel"))
  bjAsk;(("Y";"yes");("N";"no thanks"))
  bjMode=`train;(("H";"hit");("S";"stand");("D";"double")),($[bjdpair[];,("P";"split");()]),(("F";$bjDf);("C";"chart");("Esc";"table"))
  bjOn;(("H";"hit");("S";"stand")),($[bjcandbl[];,("D";"double");()]),($[bjcansp[];,("P";"split");()]),(("?";"hint");("C";"chart"))
  bjBank<1;(("N";"new chips");("T";"train");("C";"chart");("Q";"quit"))
  (("R";"rebet ",bjmoney(_bjLast&bjBank));("B";"bet");("T";"train");("C";"chart");("Q";"quit"))]
  "  ",("  "/{bjcap[x 0;x 1]}'e)}

/ ---- output: a terminal frame, or (on the web) frames queued with the pause before each ---------
bjsh:{`x(("/bin/sh";"-c";x);"")}
bjparsesz:{v:bjint'" "\x;$[(2=#v)&&/v>0;v;bjsz]}
bjkey:{$[bjTest;[k:$[#bjFeed;*bjFeed;""];bjFeed::1_bjFeed;k]
  [r:bjsh"s=$(stty -g </dev/tty); stty -icanon -echo -isig min 1 time 0 </dev/tty; dd bs=16 count=1 </dev/tty 2>/dev/null; printf '\\001'; stty size </dev/tty; stty \"$s\" </dev/tty"
   i:r?`c$1;bjsz::bjparsesz(i+1)_r;i#r]]}
bjsleep:{$[bjTest;;bjWeb;bjWait::x;bjsh"sleep ",x];}
bjput:{`1:x;}
bjFH:{$[bjN;31;23]}                                 / lines in a frame (a terminal adds the key line)
bjlines:{L:$[bjMode=`chart;bjchartL[];bjtableL[]];L:bjcut[;bjW]'(bjFH[]#L,bjFH[]#,"");$[bjWeb;L;L,,bjcut[bjkeysL[];bjW]]}
bjframe:{$[bjWeb;[bjFQ::bjFQ,,(bjWait;bjlines[]);bjWait::"0"];bjTest;[bjlay[];`0:("@@ frame";""),bjlines[]];bjout[]];}
bjlay:{r:bjsz 0;c:bjsz 1;$[(c>79)&r>23;[bjW::80;bjN::0];[bjW::42;bjN::1]];(c>79)&r>23}   / wide, or the phone layout
bjout:{w:bjlay[];r:bjsz 0;c:bjsz 1
  $[w|(c>41)&r>31;[L:bjlines[];t:_(r-#L)%2;p:(_(c-bjW)%2)#" ";L:(t#,""),p,/:L;bjput(bjE,"[H"),("\n"/L,\:bjE,"[K"),bjE,"[J"]
    bjput(bjE,"[H"),(bjE,"[2J"),"  make the window bigger: 80 x 24, or 42 x 32 (it is ",($c)," x ",($r),")"];}

/ ---- keys ----------------------------------------------------------------------------------
bjstep:{k:bjkey[];$[0=#k;bjQuit::1;bjon1 k];}
bjon1:{c:bjlow@*x;esc:x~,bjE
  $[c=`c$3;bjQuit::1
    bjMode=`chart;$[bjN&|/c="123";bjCP::-49+`i$c;bjMode::bjPrev]
    bjEnt;bjbetkey[x;c;esc]
    bjAsk;$[c="y";bjinsure 1;c="n";bjinsure 0;c="q";bjQuit::1;]
    bjMode=`train;bjtrainkey[c;esc]
    bjOn;bjhandkey c
    bjidlekey c];}
bjhandkey:{$[x="h";bjhit[];x="s";bjstand[];x="d";$[bjcandbl[];bjdbl[];]
  x="p";$[bjcansp[];bjsplit[];];x="?";[bjPK::`hint;bjPD::(bjH bjI;*bjD;bjcansp[];bjcandbl[];" ")];x="c";bjchart[];x="q";bjQuit::1;]}
bjidlekey:{$[(x="r")|(x=" ")|(x="\n")|x="\r";$[bjBank<1;;bjbet(_bjLast&bjBank)]
  x="b";$[bjBank<1;;[bjEnt::1;bjBuf::"";bjMsg::""]]
  x="t";bjtrain bjDf;x="c";bjchart[];x="q";bjQuit::1
  x="n";$[bjBank<1;[bjBank::1000;bjStart::1000;bjH::();bjMsg::bjgrn"a fresh 1,000 chips";bjsave[]];];]}
/ a bet: digits and Backspace in a terminal; on the phone, chips (+25) and a clear (the key "0c")
bjbetkey:{[x;c;esc]$[esc;bjEnt::0;(c="\n")|c="\r";[bjEnt::0;$[#bjBuf;bjbet bjint bjBuf;]]
  "+"=*x;bjBuf::$((_bjBank)&(bjint bjBuf)+bjint 1_x);x~"0c";bjBuf::""
  (c=`c$127)|c=`c$8;bjBuf::-1_bjBuf;(c>"/")&(c<":")&7>#bjBuf;bjBuf::bjBuf,c;]}
bjtrainkey:{[c;esc]$[c="h";bjtans"H";c="s";bjtans"S";c="d";bjtans"D";c="p";$[bjdpair[];bjtans"P";]
  c="0";bjtrain`all;c="1";bjtrain`hard;c="2";bjtrain`soft;c="3";bjtrain`pairs
  c="f";bjtrain bjFOC 4!1+bjFOC?bjDf;c="c";bjchart[];c="q";bjQuit::1
  esc|c="t";[bjMode::`table;bjMsg::""];]}
bjchart:{bjPrev::bjMode;bjMode::`chart
  bjCP::$[bjPrev=`train;bjpage bjrowkey[bjDh;1];bjOn;bjpage bjrowkey[bjH bjI;bjcansp[]];0];}

/ ---- the web: the page calls bjwebinit once and bjwebkey for each button ----------------------
/ each returns the frames to show, each after a line \001<pause in seconds>, then \002 and the
/ state the buttons need (mode, may double, may split, rebet, pair, focus, chart page, even money),
/ then \003 and the save text when something changed
bjwebout:{s:$[bjMode=`chart;"chart";bjEnt;"bet";bjAsk;"ask";bjMode=`train;"train";bjOn;"hand";bjBank<1;"broke";"idle"]
  s:"|"/(s;$bjcandbl[];$bjcansp[];bjmoney(_bjLast&bjBank);$[bjMode=`train;$bjdpair[];"0"];$bjDf;$bjCP;$[bjAsk;$bjnat bjH 0;"0"])
  o:(,/{(,(`c$1),x 0),x 1}'bjFQ),(,(`c$2),s),$[bjDirty;(,,`c$3),"\n"\bjsavetext[];()]
  bjFQ::();bjDirty::0;`0:o;}
bjwebinit:{[sv]bjWeb::1;bjinit[];bjW::42;bjN::1;$[#sv;.[bjloadtext;,sv;{}];];bjStart::bjBank;bjframe[];bjwebout[]}
bjwebkey:{bjFQ::();bjon1 x;bjframe[];bjwebout[]}

/ ---- the game in a terminal ------------------------------------------------------------------
bjbye:{n:+/bjSt;d:bjBank-bjStart
  `0:("";"  Thanks for playing.  ",($n),$[n=1;" hand";" hands"]," in all  ·  bank ",(bjmoney bjBank),$[d>0;" (+",(bjmoney d)," this game)";d<0;" (-",(bjmoney(-d))," this game)";""],$[bjCo 1;"  ·  by the book ",bjpct[bjCo 0;bjCo 1];""]
    "  Your chips and progress are saved in ~/.amber_blackjack.";"")}
bjmain:{bjload[];$[bjTest;;[bjsz::bjparsesz bjsh"stty size </dev/tty 2>/dev/null";bjput bjE,"[?1049h",bjE,"[?25l"]];bjframe[]
  e:.[{{~bjQuit}{bjstep[];bjframe[];x}/0;""};,0;{x}]
  $[bjTest;;bjput bjE,"[?25h",bjE,"[?1049l"]
  bjsave[];$[#e;`0:("blackjack stopped on an error:";`k@e);bjbye[]];}

bjTest:0;bjWeb:0
/ ==== the terminal starts here (the web page stops reading the file at this line) ====
/ amber blackjack.k --test KEYS [CARDS] [ROWS COLS]: play KEYS (~ is Esc, | is Enter) printing each
/ frame, on a shoe that starts with CARDS (comma-separated ints), with no delays and no save file.
bjTest:$[#x;"--test"~*x;0]
bjinit[]
bjFeed:$[bjTest&1<#x;{$[x="~";,bjE;x="|";,"\n";,x]}'x 1;()]
bjS:$[bjTest&2<#x;$[#x 2;(bjint'","\x 2),bjS;bjS];bjS]
bjsz:$[bjTest&3<#x;bjint'" "\x 3;bjsz]
bjmain[]
`exit 0
