export function betterAuth() {
  return {
    api: {
      getSession: async () => null,
    },
  };
}
