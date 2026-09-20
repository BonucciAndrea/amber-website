/* ln_stubs.c - wasm32 build only. 2.1.0's terminal status bar hooks (defined in the
   non-wasm half of src/ln.c) have no terminal to act on in the browser. */
void am_ln_sb_capture(const char *s, unsigned long n) { (void)s; (void)n; }
double am_ln_exec_ms(void) { return 0.0; }
