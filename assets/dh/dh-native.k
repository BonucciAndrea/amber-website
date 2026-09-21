/ ============================================================================
/ dh.k  -  Durre-Heesch D-reducibility check of Steinberger's 2822 configurations
/ Amber port of github.com/BonucciAndrea/DurreHeesch (Dreducing_graphs_final.py)
/ .
/ The Python walks one ring colouring at a time. Here every step works on whole
/ columns: all essential colourings of a ring at once, every Kempe interchange
/ of a batch at once. A set of colourings is a list of n digit vectors (digit j
/ = colour of ring vertex j), one element per colouring.
/ ============================================================================

DIR:"./"                                  / the folder that holds U_2822.conf

/ ---- parse: blocks split on blank lines; line 1 = "V R E 0", then V adjacency rows
L:{x@&~x="\r"}'0:DIR,"U_2822.conf"
cut:&0=#'L
blk:{L@x+!y-x}'[0,1+-1_cut;cut]
blk:blk@&3<#'blk
conf:{h:. x 1;(h 0;h 1;h 2;{-1+2_. x}'x@3+!h 0)}'blk

/ ---- essential colourings of an n-ring (colour 0 then 1, 2 before 3, last <> 0)
step:{c:x 0;l:x 1;m:x 2;nl:(4!l+1),(4!l+2),(4!l+3);m3:m,m,m;k:&~nl>m3+1;(((4*c,c,c)+nl)@k;nl@k;(m3|nl)@k)}
ess:{[n]s:(n-2) step/(,1;,1;,1);c:s[0]@&~0=s 1;{4!_x%y}[c]'|*\1,(n-1)#4}

/ ---- rank of a colouring: its successive colour steps (each 1..3) read in base 3
didx:{[D]n:#D;+/(|*\1,(n-2)#3)*{-1+4!4+x}'(1_D)-(-1_D)}

/ ---- block decompositions: ArrowGen + ArrowToBlock exactly as the Python builds them
bits:{[s]{2!_x%y}[!*/s#2]'|*\1,(s-1)#2}
arrows:{[s]B:bits s;ub:(+\B)-B;db:(!s)-ub;ok:&/(B|~0=db-ub)&(~B)|ub<s%2;+B@\:&ok}
a2b:{{[l1;a]$[a;l1,*&~@[(1+#l1)#0;l1;:;1];l1,$[0=n:l1?*|l1;*|l1;l1 n-1]]}/[,0;-1_x]}
/ every allowed interchange of one decomposition, as a mask over sectors (blocks 0,1 stay)
masks:{[bl]k:1+|/bl;$[k<3;!0;+/{[bl;W;i]$[bl[i]<2;0*W;(*/i#2)*2!_W%*/(bl[i]-2)#2]}[bl;!*/(k-2)#2]'!#bl]}
DEC:{$[x<2;();masks'a2b'arrows x]}'!17
P2:*\1,16#2
/ PAR:1 runs the interchange chunks on peach workers (needs an Amber whose peach grain
/ adapts to small inputs, see README). CELLS = cells per chunk: small enough to stay in cache
PAR:0;CELLS:125000
peach:{`pe(x;y)}                        / as in std.k (a bare script run does not load std.k)
X:0 1 2 3 1 0 3 2 2 3 0 1 3 2 1 0

/ ---- ring-size cache: D = essential colourings, P = rank -> position
CN:0
ring:{[n]$[n=CN;0;[D::ess n;P::@[(*/(n-2)#3)#-1;didx D;:;!#*D];CN::n]];0}

/ ---- which ring colourings extend inside: a join over interior vertices, one
/ column per live interior vertex, rows deduplicated as soon as a vertex is done
stepv:{[v]nb:A v;rn:nb@&nb<R;pa:ACT?nb@&(nb>R-1)&nb<v;
 sel:{[rn;pa;c]m:{[c;m;r]m&~c=(D r)@RID}[c]/[(#RID)#1;rn];&{[c;m;p]m&~c=ACL p}[c]/[m;pa]}[rn;pa]'!4;
 ix:,/sel;RID::RID ix;ACL::(ACL@\:ix),,,/(#'sel)#'!4;ACT::ACT,v;
 keep:&{[v;u]v<|/A u}[v]'ACT;ACT::ACT keep;ACL::ACL keep;k:#ACT;
 $[k;[w:|*\1,(k-1)#4;u:?(RID*4*w 0)++/w*ACL;RID::_u%4*w 0;ACL::{[u;p]4!_u%p}[u]'w];RID::?RID];0}
extend:{RID::!#*D;ACT::!0;ACL::();stepv'R+!V-R;@[(#*D)#0;RID;:;1]}

/ ---- Kempe game. For the rows g (of cand) whose partition-q ring has sn sectors:
/ build every allowed interchange as one flat column, relabel, look it up in G
/ relabel-to-first-occurrence as a state machine: state = which label each colour got
/ (base 5, 0 = none yet); one lookup per vertex gives the label and the next state
Z:!625;ZM:{[z;c](5!_z%*/c#5)-1}[Z]'!4;ZK:+/~0>ZM
NXT:,/+{[d]m:ZM d;Z+(m<0)*(ZK+1)**/d#5}'!4
LAB:,/+{[d]m:ZM d;m+(m<0)*ZK-m}'!4
/ same machine with the previous label folded into the state, emitting the rank digit
Y:!2500;YK:4*_Y%4;YP:4!Y
NX:,/+{[d]k:YK+d;(4*NXT k)+LAB k}'!4
RD:,/+{[d]l:LAB YK+d;(4!4+l-YP)-1}'!4
/ digits of one chunk: vertex j of every (interchange,row) cell, swapped or not, via
/ SWT[cell's mask slot, sector, colour]; the fold relabels and ranks in one pass
kv:{[ds;swt;ft;s;j]k:(4*s 0)+swt@ft+(#ft)#ds j;(NX k;(3*s 1)+RD k)}
/ kcell is pure (reads globals, writes none), so chunks can run on peach workers
kcell:{[q;r]m:#r;T:#TT;ft:64*_(!m*T)%m;ds:{[r;d;i]d[r]+4*i r}[r]'[DC;SID];
 a:!T*64;dd:4!a;b:2!_(TT@_a%64)%P2@_(64!a)%4;swt:dd+b*(X@(4*dd)+q+1)-dd;
 z:0*ft;(CAND r;P@(kv[ds;swt;ft]/[(z+4;z);1+!CN-1])1;MP;m)}
kstore:{[e]$[BUD>#e 1;[BUD::BUD-#e 1;CACHE::CACHE,,e];NOC::1];keval e}
keval:{[e]MPX::e 2;ok:kok[G@e 1;e 3];G::@[G;(e 0)@&ok;:;1];0}
kok:{[gf;m]&/{[gf;m;p]|/{[gf;m;x]gf@(x*m)+!m}[gf;m]'p}[gf;m]'MPX}
kgo:{[q;g;ms]u:?,/ms;TT::u;MP::TT?/:ms;ch:(0N;1|_CELLS%#TT)#g;kstore'$[PAR&1<#ch;peach[kcell[q];ch];kcell[q]'ch];0}
kgroup:{[q;sn;g]ms:DEC sn;$[(0=#ms)|0=&/1,#'ms;0;kgo[q;g;ms]]}
kround:{[q]CAND::&~G;$[#CAND;kr2 q;0]}
kr2:{[q]DC::D@\:CAND;
 out:{[q;x](x=0)|x=q+1}[q]'DC;SID::+\(,(#CAND)#0),~(1_out)=-1_out;
 S:1+*|SID;lo:*|out;SID::{[S;lo;x]x*~lo&x=S-1}[S;lo]'SID;s:S-lo;
 {[q;s;sn]g:&s=sn;$[#g;kgroup[q;sn;g];0]}[q;s]'2*1+!_CN%2;0}

/ ---- one configuration: 1 = D-reducible
run1:{[i]c:conf i;V::c 0;R::c 1;A::c 3;t0:`t[];ring R;G::extend[];e:+/G;
 CACHE::();NOC::0;BUD::200000000;kround'0 1 2;
 {$[NOC;kround'0 1 2;keval'CACHE];+/G}/0;
 ok:(&/G)&e=c 2;(i+1;R;e;c 2;ok;_(`t[]-t0)%1000)}
