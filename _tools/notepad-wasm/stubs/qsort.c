/* qsort.c - 2.6.0's parallel distinct (src/f.c) sorts with qsort, and the freestanding wasm build has no
   libc. A plain heapsort: no recursion, no extra memory. On wasm the pool runs on one thread, so this only
   sees the small tables the serial-equivalent path makes. */
typedef __SIZE_TYPE__ size_t;

static void swp(unsigned char *a, unsigned char *b, size_t n)
{
	while (n--) { unsigned char t = *a; *a++ = *b; *b++ = t; }
}

static void sift(unsigned char *b, size_t root, size_t n, size_t sz, int (*cmp)(const void *, const void *))
{
	for (;;) {
		size_t c = 2 * root + 1;
		if (c >= n) return;
		if (c + 1 < n && cmp(b + c * sz, b + (c + 1) * sz) < 0) c++;
		if (cmp(b + root * sz, b + c * sz) >= 0) return;
		swp(b + root * sz, b + c * sz, sz);
		root = c;
	}
}

void qsort(void *base, size_t n, size_t sz, int (*cmp)(const void *, const void *))
{
	unsigned char *b = base;
	if (n < 2 || !sz) return;
	for (size_t i = n / 2; i-- > 0;) sift(b, i, n, sz, cmp);
	for (size_t e = n - 1; e > 0; e--) {
		swp(b, b + e * sz, sz);
		sift(b, 0, e, sz, cmp);
	}
}
