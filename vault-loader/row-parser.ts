"use strict";

// Parse Notion DB row into normalized vault entry
// Handles different schemas across the 10 vault DBs (some have extra fields)

interface StructuredEntity {
  host: string;
  port: string;
  user: string;
  target_alias: string;
}

interface ParsedRow {
  key: string;
  value: string;
  env: string[];
  projects: string[];
  category: string | undefined;
  active: boolean;
  lastRotated: string | undefined;
  notes: string;
  aliases: string[];
  provider: string | undefined;
  modelName: string;
  account: string;
  scopeType: string | undefined;
  botRole: string | undefined;
  channelPurpose: string | undefined;
  resourceType: string | undefined;
  dbPurpose: string;
  botName: string | undefined;
  structured: StructuredEntity;
  hasStructured: boolean;
}

interface NotionProperty {
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
  multi_select?: Array<{ name: string }>;
  select?: { name: string };
  checkbox?: boolean;
  date?: { start: string };
}

interface NotionRow {
  properties?: Record<string, NotionProperty>;
}

function textProp(arr: Array<{ plain_text?: string }> | undefined): string {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr.map((t) => t.plain_text || '').join('');
}

export function parseRow(row: NotionRow): ParsedRow {
  const props = row.properties || {};

  const key = textProp(props.Name?.title);
  const value = textProp(props.value?.rich_text);
  const env = (props.env?.multi_select || []).map((e: { name: string }) => e.name);
  const category = props.category?.select?.name;
  const active = props.active?.checkbox ?? true;
  const lastRotated = props.last_rotated?.date?.start;
  const notes = textProp(props.notes?.rich_text);

  // project: Select (old schema) OR projects: Multi-select (llm, google, telegram, notion)
  let projects: string[] = [];
  if (props.projects?.multi_select) {
    projects = props.projects.multi_select.map((p: { name: string }) => p.name);
  } else if (props.project?.select?.name) {
    projects = [props.project.select.name];
  }

  // alias_keys: comma-separated list (only in llm DB) — used for backward compat
  const aliasKeys = textProp(props.alias_keys?.rich_text);
  const aliases = aliasKeys
    ? aliasKeys.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  // Optional schema-specific fields
  const provider = props.provider?.select?.name;
  const modelName = textProp(props.model_name?.rich_text);
  const account = textProp(props.account?.rich_text);
  const scopeType = props.scope_type?.select?.name;
  const botRole = props.bot_role?.select?.name;
  const channelPurpose = props.channel_purpose?.select?.name;
  const resourceType = props.resource_type?.select?.name;
  const dbPurpose = textProp(props.db_purpose?.rich_text);
  const botName = props.bot_name?.select?.name;

  // Structured entity columns (shared_config consolidation 2026-04-27).
  // When a row has any of these populated, vault loader auto-emits derived
  // env vars: <Name>_HOST, <Name>_PORT, <Name>_USER, <Name>_TARGET.
  // Backward-compat: existing callers using process.env.DEV_SSH_HOST etc.
  // continue to work because emit happens at load() time.
  const structured: StructuredEntity = {
    host:         textProp(props.host?.rich_text),
    port:         textProp(props.port?.rich_text),
    user:         textProp(props.user?.rich_text),
    target_alias: textProp(props.target_alias?.rich_text),
  };
  const hasStructured = Object.values(structured).some((v) => v && v.length > 0);

  return {
    key,
    value,
    env,
    projects,
    category,
    active,
    lastRotated,
    notes,
    aliases,
    // Optional metadata (not all rows have these)
    provider,
    modelName,
    account,
    scopeType,
    botRole,
    channelPurpose,
    resourceType,
    dbPurpose,
    botName,
    // Structured entity columns
    structured,
    hasStructured,
  };
}