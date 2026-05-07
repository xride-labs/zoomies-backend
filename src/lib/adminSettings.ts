import prisma from "./prisma.js";

const SETTINGS_SCOPE = "global";
const CACHE_TTL_MS = 30_000;

let cachedSettings: {
  data: Awaited<ReturnType<typeof prisma.adminSettings.findFirst>> | null;
  expiresAt: number;
} = {
  data: null,
  expiresAt: 0,
};

export async function getAdminSettings(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedSettings.data && cachedSettings.expiresAt > now) {
    return cachedSettings.data;
  }

  const settings = await prisma.adminSettings.upsert({
    where: { scope: SETTINGS_SCOPE },
    update: {},
    create: { scope: SETTINGS_SCOPE },
  });

  cachedSettings = { data: settings, expiresAt: now + CACHE_TTL_MS };
  return settings;
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
