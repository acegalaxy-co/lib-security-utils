"use strict";
const { NotionClient } = require("./notion-client");
const { parseRow } = require("./row-parser");
const { TTLCache } = require("./cache");

interface VaultLoaderOptions {
  token: string;
  databases: Record<string, string>;
  ttlMs?: number;
  logger?: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

interface ParsedRow {
  key?: string;
  value?: string;
  hasStructured?: boolean;
  active?: boolean;
  env: string[];
  projects?: string[];
  aliases: string[];
  category?: string;
  structured?: Record<string, string>;
  _db?: string;
}

interface LoadFilter {
  projects?: string[];
  env?: string;
  injectAliases?: boolean;
  activeOnly?: boolean;
}

interface StatsResult {
  totalRows: number;
  totalAliases: number;
  injectedKeys: number;
  byDb: Record<string, number>;
  byCategory: Record<string, number>;
}

interface BootstrapRow {
  name: string;
  reader_token_local: string;
  reader_token_prod: string;
  dbs_local: string;
  dbs_prod: string;
  active: boolean;
}

interface BootstrapOptions {
  bootstrapToken: string;
  bootstrapDbId: string;
  project: string;
  env: string;
  ttlMs?: number;
  logger?: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

interface BuildDatabasesOptions {
  extraMetadataSlugs?: string[];
}

export class VaultLoader {
  private client: typeof NotionClient;
  private databases: Record<string, string>;
  private cache: typeof TTLCache;
  private logger: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

  constructor({ token, databases, ttlMs = 10 * 60 * 1000, logger = console }: VaultLoaderOptions) {
    if (!token) throw new Error("VaultLoader: token required");
    if (!databases || Object.keys(databases).length === 0) {
      throw new Error("VaultLoader: databases map required");
    }
    this.client = new NotionClient({ token });
    this.databases = databases;
    this.cache = new TTLCache({ ttlMs });
    this.logger = logger;
  }

  async fetchAllRows(): Promise<ParsedRow[]> {
    const cached = this.cache.get("__all_rows__") as ParsedRow[] | undefined;
    if (cached) return cached;

    const allRows: ParsedRow[] = [];
    for (const [slug, dbId] of Object.entries(this.databases)) {
      try {
        const rows = await this.client.queryDatabase(dbId);
        for (const r of rows) {
          const parsed = parseRow(r as Parameters<typeof parseRow>[0]) as unknown as ParsedRow;
          parsed._db = slug;
          allRows.push(parsed);
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        this.logger.warn(`[vault-loader] failed to query DB ${slug}: ${message}`);
      }
    }
    this.cache.set("__all_rows__", allRows);
    this.logger.info(`[vault-loader] loaded ${allRows.length} rows from ${Object.keys(this.databases).length} DBs`);
    return allRows;
  }

  async load({ projects = [], env, injectAliases = true, activeOnly = true }: LoadFilter = {}): Promise<Record<string, string>> {
    const rows = await this.fetchAllRows();
    const out: Record<string, string> = {};

    for (const row of rows) {
      if (!row.key) continue;
      if (!row.value && !row.hasStructured) continue;
      if (activeOnly && !row.active) continue;

      if (env) {
        const matchesEnv = row.env.includes("ALL") || row.env.includes(env);
        if (!matchesEnv) continue;
      }

      if (projects.length > 0) {
        const rowProjects = row.projects || [];
        const isShared = rowProjects.includes("shared");
        const intersects = isShared || rowProjects.some((p) => projects.includes(p));
        if (!intersects) continue;
      }

      if (row.value) out[row.key] = row.value;

      if (injectAliases && row.aliases.length > 0) {
        for (const alias of row.aliases) {
          out[alias] = row.value as string;
        }
      }

      if (row.hasStructured) {
        const map: Record<string, string> = { host: "HOST", port: "PORT", user: "USER", target_alias: "TARGET" };
        for (const [col, suffix] of Object.entries(map)) {
          const v = row.structured?.[col];
          if (v) out[`${row.key}_${suffix}`] = v;
        }
      }
    }

    return out;
  }

  async get(key: string, filter: LoadFilter = {}): Promise<string | undefined> {
    const env = await this.load(filter);
    return env[key];
  }

  async stats({ projects = [], env, activeOnly = true }: { projects?: string[]; env?: string; activeOnly?: boolean } = {}): Promise<StatsResult> {
    const rows = await this.fetchAllRows();
    const visibleRows = rows.filter((row) => {
      if (activeOnly && !row.active) return false;
      if (env) {
        const matches = row.env.includes("ALL") || row.env.includes(env);
        if (!matches) return false;
      }
      if (projects.length > 0) {
        const rp = row.projects || [];
        const shared = rp.includes("shared");
        const intersects = shared || rp.some((p) => projects.includes(p));
        if (!intersects) return false;
      }
      return true;
    });
    const byDb: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let totalAliases = 0;
    for (const r of visibleRows) {
      byDb[r._db || ""] = (byDb[r._db || ""] || 0) + 1;
      if (r.category) byCategory[r.category] = (byCategory[r.category] || 0) + 1;
      totalAliases += r.aliases.length;
    }
    return {
      totalRows: visibleRows.length,
      totalAliases,
      injectedKeys: visibleRows.length + totalAliases,
      byDb,
      byCategory,
    };
  }

  invalidateCache(): void {
    this.cache.clear();
  }

  static async fromBootstrap({ bootstrapToken, bootstrapDbId, project, env, ttlMs, logger = console }: BootstrapOptions): Promise<VaultLoader> {
    if (!bootstrapToken) throw new Error("fromBootstrap: bootstrapToken required");
    if (!bootstrapDbId) throw new Error("fromBootstrap: bootstrapDbId required");
    if (!project) throw new Error("fromBootstrap: project required");
    if (!env) throw new Error("fromBootstrap: env required");

    const envUpper = String(env).toUpperCase();
    if (envUpper !== "LOCAL" && envUpper !== "PROD") {
      throw new Error(`fromBootstrap: env must be 'LOCAL' or 'PROD', got '${env}'`);
    }

    const tokenField = envUpper === "LOCAL" ? "reader_token_local" : "reader_token_prod";
    const dbsField = envUpper === "LOCAL" ? "dbs_local" : "dbs_prod";

    const client = new NotionClient({ token: bootstrapToken });
    const rawRows = await client.queryDatabase(bootstrapDbId);

    const rows = (rawRows as Record<string, unknown>[]).map(parseBootstrapRow).filter((r) => r.active !== false);

    const projectRow = rows.find((r) => r.name === project);
    if (!projectRow) {
      throw new Error(`fromBootstrap: project '${project}' not found in bootstrap DB`);
    }

    const projectToken = projectRow[tokenField];
    if (!projectToken) {
      throw new Error(`fromBootstrap: row '${project}' missing ${tokenField}`);
    }

    let projectDbs: Record<string, string>;
    try {
      projectDbs = projectRow[dbsField] ? JSON.parse(projectRow[dbsField]) : {};
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`fromBootstrap: row '${project}' ${dbsField} not valid JSON: ${message}`);
    }
    if (!projectDbs || typeof projectDbs !== "object") {
      throw new Error(`fromBootstrap: row '${project}' ${dbsField} must be a JSON object`);
    }

    let sharedDbs: Record<string, string> = {};
    const sharedRow = rows.find((r) => r.name === "_shared_dbs");
    if (sharedRow) {
      try {
        sharedDbs = sharedRow[dbsField] ? JSON.parse(sharedRow[dbsField]) : {};
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`fromBootstrap: row '_shared_dbs' ${dbsField} not valid JSON: ${message}`);
      }
      if (!sharedDbs || typeof sharedDbs !== "object") sharedDbs = {};
    }

    const mergedDbs = { ...sharedDbs, ...projectDbs };
    if (Object.keys(mergedDbs).length === 0) {
      throw new Error(`fromBootstrap: merged dbs map for project '${project}' env '${envUpper}' is empty`);
    }

    if (logger && typeof logger.info === "function") {
      logger.info(
        `[vault-loader] loaded bootstrap meta: project=${project} env=${envUpper} dbCount=${Object.keys(mergedDbs).length}`
      );
    }

    return new VaultLoader({
      token: projectToken,
      databases: mergedDbs,
      ttlMs,
      logger,
    });
  }
}

function parseBootstrapRow(row: Record<string, unknown>): BootstrapRow {
  const props = (row.properties || {}) as Record<string, Record<string, unknown>>;
  const text = (arr: unknown): string => {
    if (!Array.isArray(arr) || arr.length === 0) return "";
    return arr.map((t: Record<string, string>) => t.plain_text || "").join("");
  };
  return {
    name: text(props.Name?.title),
    reader_token_local: text(props.reader_token_local?.rich_text),
    reader_token_prod: text(props.reader_token_prod?.rich_text),
    dbs_local: text(props.dbs_local?.rich_text),
    dbs_prod: text(props.dbs_prod?.rich_text),
    active: (props.active?.checkbox as boolean) ?? true,
  };
}

export function buildDatabasesFromEnv(envObj: Record<string, string>, projects: string[] = [], opts: BuildDatabasesOptions = {}): Record<string, string> {
  const BASE_METADATA_SLUGS = ["old_flat", "container_page", "container"];
  const extraSlugs = Array.isArray(opts.extraMetadataSlugs) ? opts.extraMetadataSlugs : [];
  const METADATA_SLUGS = new Set([
    ...BASE_METADATA_SLUGS,
    "nexus_reader",
    ...extraSlugs.map((s) => String(s).toLowerCase()),
  ]);
  const SHARED_INFRA_SLUGS = new Set(["bots_write", "reminders", "_reminders"]);

  const projectSet = new Set((projects || []).map((p) => String(p).toLowerCase()));
  const scopeAll = projectSet.size === 0;

  const dbs: Record<string, string> = {};
  for (const [k, v] of Object.entries(envObj)) {
    const m = k.match(/^NOTION_VAULT_(.+)_DB_ID$/);
    if (!m) continue;
    const slug = m[1].toLowerCase();
    if (METADATA_SLUGS.has(slug)) continue;
    if (slug.includes("reader_token")) continue;

    if (scopeAll) {
      dbs[slug] = v;
      continue;
    }

    if (slug.startsWith("shared_") || slug === "shared") {
      dbs[slug] = v;
    } else if (SHARED_INFRA_SLUGS.has(slug)) {
      dbs[slug] = v;
    } else if (projectSet.has(slug)) {
      dbs[slug] = v;
    }
  }
  return dbs;
}