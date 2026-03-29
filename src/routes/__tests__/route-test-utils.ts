type RouteEntry = {
  path: string;
  methods: string[];
};

type RouteDescribeOptions = {
  minRoutes?: number;
  expectedMethods?: string[];
};

function extractRouteEntries(router: any): RouteEntry[] {
  const stack = router?.stack ?? [];

  return stack
    .filter((layer: any) => layer?.route)
    .map((layer: any) => {
      const path = String(layer.route.path ?? "");
      const methods = Object.keys(layer.route.methods ?? {}).filter(
        (method) => layer.route.methods[method],
      );

      return { path, methods };
    });
}

export function describeRouteModule(
  label: string,
  router: any,
  options: RouteDescribeOptions = {},
) {
  const minRoutes = options.minRoutes ?? 1;
  const expectedMethods = options.expectedMethods ?? ["get", "post"];

  describe(label, () => {
    const entries = extractRouteEntries(router);

    it("exports a router instance", () => {
      expect(router).toBeDefined();
      expect(Array.isArray(router.stack)).toBe(true);
    });

    it(`contains at least ${minRoutes} route handlers`, () => {
      expect(entries.length).toBeGreaterThanOrEqual(minRoutes);
    });

    it("uses serializable route paths", () => {
      for (const entry of entries) {
        expect(typeof entry.path).toBe("string");
        expect(entry.path.length).toBeGreaterThan(0);
      }
    });

    it("declares HTTP methods per route", () => {
      for (const entry of entries) {
        expect(entry.methods.length).toBeGreaterThan(0);
      }
    });

    it("includes expected HTTP method coverage", () => {
      const routeMethods = new Set(entries.flatMap((entry) => entry.methods));
      expect(
        expectedMethods.some((method) =>
          routeMethods.has(method.toLowerCase()),
        ),
      ).toBe(true);
    });

    it("does not duplicate identical path+method signatures", () => {
      const signatures = entries.flatMap((entry) =>
        entry.methods.map((method) => `${method.toLowerCase()} ${entry.path}`),
      );
      const unique = new Set(signatures);
      expect(unique.size).toBe(signatures.length);
    });
  });
}
