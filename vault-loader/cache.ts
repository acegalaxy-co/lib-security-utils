"use strict";
export class TTLCache {
    ttlMs: number;
    store: Map<string, { value: unknown; expiresAt: number }>;
    constructor({ ttlMs = 10 * 60 * 1000 }: { ttlMs?: number } = {}) {
        this.ttlMs = ttlMs;
        this.store = new Map();
    }
    get(key: string): unknown {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    }
    set(key: string, value: unknown, ttlMs?: number): void {
        this.store.set(key, {
            value,
            expiresAt: Date.now() + (ttlMs ?? this.ttlMs),
        });
    }
    has(key: string): boolean {
        return this.get(key) !== undefined;
    }
    delete(key: string): void {
        this.store.delete(key);
    }
    clear(): void {
        this.store.clear();
    }
    size(): number {
        return this.store.size;
    }
}