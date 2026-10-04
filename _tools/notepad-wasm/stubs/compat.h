/* compat.h - force-included into every wasm32 translation unit for 2.1.0 symbols that
   src/wsys does not declare. The browser has no TTY, so isatty() is always false. */
#pragma once
static inline int isatty(int fd) { (void)fd; return 0; }
/* 2.6.0's parallel distinct sorts its table with qsort; src/wsys has none, stubs/qsort.c is a heapsort. */
void qsort(void *base, __SIZE_TYPE__ n, __SIZE_TYPE__ size, int (*cmp)(const void *, const void *));
