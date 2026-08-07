// Single source of truth for the port this backend listens on -- imported by
// index.ts (to actually listen) and hookInstaller.ts (to bake the right port
// into the notify.mjs command it installs into target repos), so the two can
// never drift apart.
export const SERVER_PORT = Number(process.env.GAUNTLET_WRAPPER_PORT ?? 4577);
