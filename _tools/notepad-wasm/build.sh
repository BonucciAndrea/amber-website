#!/usr/bin/env bash
# build.sh - rebuild assets/notepad/amber.wasm.js from the Amber engine sources with a
# freestanding clang/wasm-ld (LLVM >= 15): no emscripten, no wasi-sdk. Every src/*.c is
# compiled for wasm32 in Amber's built-in -Dwasm mode (VFS + syscall shims in src/0.c,
# hand-written libc in src/wsys), the .k stdlib and examples are baked into the VFS by
# genfs.py, and the linked module is base64-embedded for assets/notepad/amber.js.
#
#   AMBER_SRC=/path/to/amber CLANG=clang WLD=wasm-ld _tools/notepad-wasm/build.sh
#
# Build from a release tag (e.g. `git -C amber archive v2.1.0 | tar -x -C /some/dir`).
# stubs/ holds what 2.1.0 needs beyond src/wsys: sys/ioctl.h, isatty() and the terminal
# status-bar hooks from the non-wasm half of src/ln.c. All of them are no-ops in a browser.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SITE="$(cd "$HERE/../.." && pwd)"
AMBER_SRC="${AMBER_SRC:?set AMBER_SRC to an Amber source tree}"
CLANG="${CLANG:-clang}"
WLD="${WLD:-wasm-ld}"
RES="$("$CLANG" -print-resource-dir)"
O="$(mktemp -d)"; trap 'rm -rf "$O"' EXIT

python3 "$HERE/genfs.py" "$AMBER_SRC" > "$O/fs.h"
mkdir -p "$AMBER_SRC/o/w" && cp "$O/fs.h" "$AMBER_SRC/o/w/fs.h"

CFLAGS="--target=wasm32 -Dwasm -O2 -ffreestanding -fno-builtin -w -nostdinc -isystem $RES/include
        -I$AMBER_SRC/src/wsys -I$HERE/stubs -include $HERE/stubs/compat.h -I$AMBER_SRC/src -I$AMBER_SRC"
# 2.1.0's peachC calls peachNW(), which walks the host `env`, before its wasm branch (serial
# each). In the sandbox `env` is not a real environ array and the walk traps, so a patched
# copy of i.c skips it. The Amber tree itself is not modified.
sed 's/I nw=peachNW();if(nw>64)nw=64;/I nw=1;/' "$AMBER_SRC/src/i.c" > "$O/i.c"
grep -q 'I nw=1;' "$O/i.c" || { echo "i.c peach patch did not apply: check peachC in src/i.c"; exit 1; }

for f in "$AMBER_SRC"/src/*.c "$HERE"/stubs/*.c; do
  [ "$f" = "$AMBER_SRC/src/i.c" ] && f="$O/i.c"
  "$CLANG" $CFLAGS -c "$f" -o "$O/$(basename "$f" .c).o"
done

"$WLD" --no-entry --allow-undefined --export-dynamic \
  --export=amber_init --export=amber_inbuf --export=amber_eval \
  --export=amber_load --export=amber_read --export=amber_version \
  --export=memory --export=__heap_base \
  --initial-memory=67108864 -z stack-size=1048576 \
  -o "$O/amber.wasm" "$O"/*.o

# `self` exists both on the page and inside the Web Worker (assets/notepad/worker.js)
printf 'self.AMBER_WASM_B64="%s";\n' "$(base64 -w0 "$O/amber.wasm")" > "$SITE/assets/notepad/amber.wasm.js"
echo "OK: $(wc -c < "$O/amber.wasm") byte wasm -> assets/notepad/amber.wasm.js"
echo "Bump ?v= on amber.wasm.js in worker.js and notepad.html: /assets is cached for a year."
