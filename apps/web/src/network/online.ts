import { expeditionDifficultySchema } from '@web-game-world/contracts';
import { Client } from 'colyseus.js';
import { z } from 'zod';
import { profileSchema } from '@web-game-world/contracts';
import type { Profile } from '@web-game-world/contracts';

export const base = import.meta.env.BASE_URL;
export async function request(path: string, options: { token?: string; body?: unknown; method?: string } = {}): Promise<unknown> {
  const headers: Record<string, string> = {}; if (options.token) headers.authorization = `Bearer ${options.token}`;
  let body: string | undefined; if (options.body !== undefined) { body = JSON.stringify(options.body); headers['content-type'] = 'application/json'; }
  const signal = AbortSignal.timeout(10000); const response = await fetch(`${base}api/${path}`, { method: options.method ?? (body ? 'POST' : 'GET'), headers, body, signal });
  const data: unknown = await response.json();
  if (!response.ok) { const parsed = z.object({ error: z.string() }).safeParse(data); const message = parsed.success ? parsed.data.error : '请求失败，请稍后重试'; throw new Error(message); }
  return data;
}
const loginResultFields = { token: z.string(), profile: profileSchema };
export const loginResultSchema = z.object(loginResultFields);
const roomItemFields = { difficulty: expeditionDifficultySchema.default('normal'), roomId: z.string(), clients: z.number(), maxClients: z.number(), name: z.string() };
const roomItemSchema = z.object(roomItemFields);
export const roomListSchema = z.array(roomItemSchema);
const runHistoryFields = { difficulty: expeditionDifficultySchema.default('normal'), status: z.string(), createdAt: z.string() };
const runHistorySchema = z.object(runHistoryFields);
const historyItemFields = { outcome: z.string().default('active'), baseCleared: z.boolean().default(false), hellFloor: z.number().int().min(0).max(20).default(0), runId: z.string(), settled: z.boolean(), coins: z.number(), materials: z.number(), run: runHistorySchema };
const historyItemSchema = z.object(historyItemFields);
export const historySchema = z.array(historyItemSchema);
export function roomClient(): Client { const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'; const endpoint = `${protocol}//${location.host}${base}room`; return new Client(endpoint); }
export async function fetchProfile(token: string): Promise<Profile> { const data = await request('me', { token }); return profileSchema.parse(data); }
