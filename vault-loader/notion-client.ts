"use strict";

// Notion API client with retry + pagination
// Never logs secret values
// Uses native global fetch (Node 18+) — no node-fetch dependency

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

interface NotionClientOptions {
  token: string;
  retries?: number;
  retryDelayMs?: number;
}

interface QueryDatabaseOptions {
  filter?: Record<string, unknown>;
  pageSize?: number;
}

interface NotionResponse {
  results: unknown[];
  has_more: boolean;
  next_cursor?: string;
  code?: string;
  message?: string;
}

export class NotionClient {
  private token: string;
  private retries: number;
  private retryDelayMs: number;

  constructor({ token, retries = 3, retryDelayMs = 2000 }: NotionClientOptions) {
    if (!token) throw new Error('NotionClient: token required');
    this.token = token;
    this.retries = retries;
    this.retryDelayMs = retryDelayMs;
  }

  async request(method: string, path: string, body?: Record<string, unknown>): Promise<unknown> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const resp = await fetch(`${NOTION_API}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const text = await resp.text();
        if (!text.startsWith('{') && !text.startsWith('[')) {
          if (attempt < this.retries) {
            await sleep(this.retryDelayMs);
            continue;
          }
          throw new Error(`Non-JSON response (HTTP ${resp.status})`);
        }
        const json: NotionResponse = JSON.parse(text);
        if (!resp.ok) {
          const code = json.code || `http_${resp.status}`;
          const msg = json.message || 'unknown error';
          throw new Error(`${code}: ${msg}`);
        }
        return json;
      } catch (e) {
        lastErr = e;
        if (attempt < this.retries) await sleep(this.retryDelayMs);
      }
    }
    throw lastErr;
  }

  async queryDatabase(databaseId: string, opts: QueryDatabaseOptions = {}): Promise<unknown[]> {
    const { filter, pageSize = 100 } = opts;
    const rows: unknown[] = [];
    let cursor: string | undefined;
    while (true) {
      const body: Record<string, unknown> = { page_size: pageSize };
      if (filter) body.filter = filter;
      if (cursor) body.start_cursor = cursor;
      const result = await this.request('POST', `/databases/${databaseId}/query`, body) as NotionResponse;
      rows.push(...result.results);
      if (!result.has_more) break;
      cursor = result.next_cursor;
    }
    return rows;
  }

  async getDatabase(databaseId: string): Promise<unknown> {
    return this.request('GET', `/databases/${databaseId}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}