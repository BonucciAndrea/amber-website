/* compat.h - force-included into every wasm32 translation unit for 2.1.0 symbols that
   src/wsys does not declare. The browser has no TTY, so isatty() is always false. */
#pragma once
static inline int isatty(int fd) { (void)fd; return 0; }
