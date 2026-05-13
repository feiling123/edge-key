type RuntimeBootstrapEnv = {
  RUNTIME_D1_BOOTSTRAP?: string;
};

function normalizeFlag(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readProcessEnv(name: string) {
  return typeof process !== "undefined" ? process.env[name] : undefined;
}

export function shouldBootstrapD1OnRequest(env?: RuntimeBootstrapEnv | null) {
  const flag = normalizeFlag(env?.RUNTIME_D1_BOOTSTRAP ?? readProcessEnv("RUNTIME_D1_BOOTSTRAP"));
  return ["1", "true", "yes", "on"].includes(flag);
}

export async function ensureD1ReadyOnRequest(database: D1Database, env?: RuntimeBootstrapEnv | null) {
  if (!shouldBootstrapD1OnRequest(env)) return;
  const { ensureD1Ready } = await import("./d1-bootstrap");
  await ensureD1Ready(database);
}
