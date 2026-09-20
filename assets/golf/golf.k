/ golf.k -- the judge for Array Golf.

/ The player's expression becomes G, a one-argument function. A puzzle is a
/ list of (input; expected) pairs, and a solution passes only when G returns
/ something that MATCHES the expected value -- ~ , not = , so 1 2 3 and
/ 1 2 3.0 are not quietly the same answer, and a wrong shape cannot slip
/ through by conforming.

/ gchk[i;e] -- 1 when G i matches e, 0 when it does not OR when it blew up.
/ The trap is what lets a half-written expression be judged rather than
/ throwing: golf is typed one character at a time, so most of what this sees
/ is not valid yet.
gchk:{[i;e].[{[a;b](G a)~b};(i;e);{[z]0}]}

/ gall[t] -- run every (input;expected) pair and return one digit per test,
/ so a whole puzzle is judged in a single evaluation. The pair is taken apart
/ by index rather than with .' , which binds the wrong thing here.
gall:{[t]`0:,/${[p]gchk[p 0;p 1]}'t;}
