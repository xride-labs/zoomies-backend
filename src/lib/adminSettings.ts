import prisma from "./prisma.js";

const SETTINGS_SCOPE = "global";
const CACHE_TTL_MS = 30_000;

type AdminSettings = Awaited<ReturnType<typeof prisma.adminSettings.upsert>>;

let cachedSettings: {
  data: AdminSettings | null;
  expiresAt: number;
} = {
  data: null,
  expiresAt: 0,
};

// Deduplicates concurrent calls so only one DB round-trip runs at a time.
// Without this, simultaneous requests on startup all attempt the upsert and
// race to INSERT the same unique `scope` row, causing P2002 crashes.
let inflight: Promise<AdminSettings> | null = null;

export async function getAdminSettings(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedSettings.data && cachedSettings.expiresAt > now) {
    return cachedSettings.data;
  }

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      let settings;
      try {
        settings = await prisma.adminSettings.upsert({
          where: { scope: SETTINGS_SCOPE },
          update: {},
          create: { scope: SETTINGS_SCOPE },
        });
      } catch (err: any) {
        // P2002 = unique constraint — another concurrent request won the race.
        // Fall back to a plain read since the row now exists.
        if (err?.code === "P2002") {
          settings = await prisma.adminSettings.findUniqueOrThrow({
            where: { scope: SETTINGS_SCOPE },
          });
        } else {
          throw err;
        }
      }
      cachedSettings = { data: settings, expiresAt: Date.now() + CACHE_TTL_MS };
      return settings;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export async function updateAdminSettings(data: Record<string, unknown>) {
  const settings = await prisma.adminSettings.upsert({
    where: { scope: SETTINGS_SCOPE },
    update: data,
    create: { scope: SETTINGS_SCOPE, ...(data as object) },
  });

  cachedSettings = { data: settings, expiresAt: Date.now() + CACHE_TTL_MS };
  return settings;
}
