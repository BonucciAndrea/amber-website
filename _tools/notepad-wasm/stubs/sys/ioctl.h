/* sys/ioctl.h - wasm32 stub. The browser has no terminal to query, so TIOCGWINSZ
   always fails and i.c keeps its default plot size. */
#pragma once
struct winsize { unsigned short ws_row, ws_col, ws_xpixel, ws_ypixel; };
#define TIOCGWINSZ 0x5413
static inline int ioctl(int fd, unsigned long req, ...) { (void)fd; (void)req; return -1; }
