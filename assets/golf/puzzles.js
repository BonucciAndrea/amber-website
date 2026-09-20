/* puzzles.js — the Array Golf puzzle set.
 *
 * Each puzzle: id, title, prompt, the argument's name in the prompt, a few
 * SHOWN examples, some HIDDEN tests, and a reference solution whose length is
 * par. Inputs and expected values are written as Amber literals, because the
 * judge builds `gchk[(input);(expected)]` and lets the engine do the
 * comparison — nothing is marshalled through JavaScript.
 *
 * Every reference solution here was run against its own tests before shipping.
 */
window.GOLF_PUZZLES = [
  { id: "sum", title: "Sum", par: "+/x",
    prompt: "Add up every element of <code>x</code>.",
    show: [["1 2 3 4", "10"], [",5", "5"], ["0 0 7", "7"]],
    hide: [["1 2 3 4 5 6 7 8 9 10", "55"], ["-3 3", "0"], ["100 200 300", "600"]] },

  { id: "reverse", title: "Reverse", par: "|x",
    prompt: "Return <code>x</code> backwards.",
    show: [["1 2 3", "3 2 1"], ["7 7 8", "8 7 7"], ["1 2 3 4 5", "5 4 3 2 1"]],
    hide: [["9 1", "1 9"], ["4 4 4 4", "4 4 4 4"], ["1 2 3 4 5 6", "6 5 4 3 2 1"]] },

  { id: "count", title: "How many", par: "#x",
    prompt: "How many elements does <code>x</code> have?",
    show: [["4 5 6 7 8", "5"], [",1", "1"], ["2 2", "2"]],
    hide: [["1 2 3 4 5 6 7", "7"], ["10 20 30", "3"], ["0 0 0 0", "4"]] },

  { id: "max", title: "Largest", par: "|/x",
    prompt: "Return the largest element of <code>x</code>.",
    show: [["3 9 2", "9"], ["-4 -9", "-4"], ["5 5 5", "5"]],
    hide: [["1 2 3 4 5", "5"], ["7 1 7 2", "7"], ["-1 0 -2", "0"]] },

  { id: "distinct", title: "Distinct", par: "?x",
    prompt: "Remove duplicates from <code>x</code>, keeping first appearances in order.",
    show: [["1 2 2 3 1", "1 2 3"], ["4 4 4", ",4"], ["1 2 3", "1 2 3"]],
    hide: [["9 8 9 8 7", "9 8 7"], ["1 1 2 2 3 3", "1 2 3"], ["5 4 3 4 5", "5 4 3"]] },

  { id: "scan", title: "Running total", par: "+\\x",
    prompt: "Return the running total of <code>x</code>: each element plus everything before it.",
    show: [["1 2 3 4", "1 3 6 10"], ["5 0 5", "5 5 10"], ["2 2", "2 4"]],
    hide: [["1 1 1 1 1", "1 2 3 4 5"], ["10 -10 10", "10 0 10"], [",3", ",3"]] },

  { id: "clamp", title: "No negatives", par: "0|x",
    prompt: "Replace every negative element of <code>x</code> with zero.",
    show: [["-2 3 -1 4", "0 3 0 4"], ["1 2", "1 2"], [",-5", ",0"]],
    hide: [["-1 -1 -1", "0 0 0"], ["0 -3 9", "0 0 9"], ["4 -4 4 -4", "4 0 4 0"]] },

  { id: "flatten", title: "Flatten", par: ",/x",
    prompt: "<code>x</code> is a list of lists. Join them into one flat list.",
    show: [["(1 2;3 4 5)", "1 2 3 4 5"], ["(,1;,2)", "1 2"], ["(1 2;3 4)", "1 2 3 4"]],
    hide: [["(1 2 3;4;5 6)", "1 2 3 4 5 6"], ["(9 9;9 9)", "9 9 9 9"], ["(,7;8 9)", "7 8 9"]] },

  { id: "transpose", title: "Transpose", par: "+x",
    prompt: "<code>x</code> is a matrix — a list of equal-length rows. Turn its rows into columns.",
    show: [["(1 2;3 4)", "(1 3;2 4)"], ["(1 2 3;4 5 6)", "(1 4;2 5;3 6)"], ["(,1;,2)", ",1 2"]],
    hide: [["(1 2;3 4;5 6)", "(1 3 5;2 4 6)"], ["(0 0;1 1)", "(0 1;0 1)"], ["(7 8 9;1 2 3)", "(7 1;8 2;9 3)"]] },

  { id: "cummax", title: "Running maximum", par: "|\\x",
    prompt: "Return the largest value seen so far at each position of <code>x</code>.",
    show: [["1 3 2 5 4", "1 3 3 5 5"], ["5 4 3", "5 5 5"], ["1 2 3", "1 2 3"]],
    hide: [["0 0 1 0 2", "0 0 1 1 2"], ["-5 -9 -1", "-5 -5 -1"], [",9", ",9"]] },

  { id: "sort", title: "Sort", par: "x@<x",
    prompt: "Sort <code>x</code> into ascending order. There is no sort verb — but there is a <em>grade</em>.",
    show: [["3 1 2", "1 2 3"], ["9 9 1", "1 9 9"], [",5", ",5"]],
    hide: [["4 3 2 1", "1 2 3 4"], ["0 -1 1", "-1 0 1"], ["2 2 1 1", "1 1 2 2"]] },

  { id: "palin", title: "Palindrome?", par: "x~|x",
    prompt: "Return <code>1</code> if <code>x</code> reads the same backwards, otherwise <code>0</code>.",
    show: [["1 2 1", "1"], ["1 2 3", "0"], ["4 4", "1"]],
    hide: [["1 2 2 1", "1"], ["1 2 3 2 1", "1"], ["1 2 3 1", "0"]] },

  { id: "ndistinct", title: "How many distinct", par: "#?x",
    prompt: "How many <em>different</em> values appear in <code>x</code>?",
    show: [["1 2 2 3", "3"], ["4 4 4", "1"], ["1 2 3 4", "4"]],
    hide: [["9 9 8 8 7", "3"], [",5", "1"], ["1 1 1 2 2 3", "3"]] },

  { id: "rowsum", title: "Sum each row", par: "+/'x",
    prompt: "<code>x</code> is a matrix. Return the total of each row.",
    show: [["(1 2;3 4)", "3 7"], ["(,5;,6)", "5 6"], ["(1 1 1;2 2 2)", "3 6"]],
    hide: [["(0 0;9 1)", "0 10"], ["(1 2 3;4 5 6;7 8 9)", "6 15 24"], ["(,0;,0)", "0 0"]] },

  { id: "evens", title: "Even elements", par: "x@&0=2!x",
    prompt: "Keep only the even elements of <code>x</code>, in order.",
    show: [["1 2 3 4", "2 4"], ["2 4 6", "2 4 6"], ["1 3", "0#0"]],
    hide: [["0 1 2 3 4 5", "0 2 4"], ["7 7 8", ",8"], ["10 20 31", "10 20"]] },

  { id: "argmax", title: "Where the maximum is", par: "&x=|/x",
    prompt: "Return the indices of every element of <code>x</code> equal to its maximum.",
    show: [["1 9 2 9", "1 3"], ["5 1 2", ",0"], ["3 3", "0 1"]],
    hide: [["0 0 0", "0 1 2"], ["-1 -2 -1", "0 2"], ["4 5 6", ",2"]] },

  { id: "diff", title: "Pairwise differences", par: "(1_x)-(-1)_x",
    prompt: "Return the gaps between consecutive elements of <code>x</code>. The result is one shorter than <code>x</code>.",
    show: [["1 4 9 16", "3 5 7"], ["5 5 5", "0 0"], ["1 2", ",1"]],
    hide: [["0 10 20 30", "10 10 10"], ["3 1", ",-2"], ["1 2 4 8 16", "1 2 4 8"]] },

  { id: "abovemean", title: "Above the mean", par: "+/x>(+/x)%#x",
    prompt: "How many elements of <code>x</code> are strictly greater than its mean?",
    show: [["1 2 3 10", "1"], ["2 2 2", "0"], ["0 10", "1"]],
    hide: [["1 1 1 100", "1"], ["5 5 5 5 20", "1"], ["1 2 3 4 5", "2"]] }
];
