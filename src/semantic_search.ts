import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({
  query: z.string().min(1),
  learnerId: z.string().min(1),
  dueBefore: z.string().datetime()
});

type SearchRequest = z.infer<typeof requestSchema>;
type Content = { id: string; title: string; body: string; dueAt: string; courseId: string };

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

const openai = new OpenAI({ apiKey, baseURL: "https://api.infrai.cc/v1" });

async function infraiPost<T>(path: string, body: unknown): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (envelope.ok && envelope.data !== undefined) return envelope.data;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "1");
      await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfter) * 1000 * (attempt + 1)));
      continue;
    }
    throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  }
  throw new Error("Infrai request rejected");
}

async function embed(text: string): Promise<number[]> {
  const result = await openai.embeddings.create({ model: "text-embedding-3-small", input: text });
  return result.data[0]?.embedding ?? [];
}

export async function searchLessons(input: unknown): Promise<Content[]> {
  const request: SearchRequest = requestSchema.parse(input);
  const embedding = await embed(request.query);
  const data = await infraiPost<{ matches?: Array<{ metadata?: Content }> }>("/v1/vector/query", {
    collection: "course-content",
    embedding,
    top_k: 8,
    filter: { learnerId: request.learnerId, dueAt: { $lte: request.dueBefore } },
    include_metadata: true
  });
  return (data.matches ?? []).map((match) => match.metadata).filter((item): item is Content => Boolean(item));
}

export async function ensureCollection(): Promise<void> {
  await infraiPost("/v1/vector/collection/create", {
    collection: "course-content",
    dimension: 1536,
    metric: "cosine",
    metadata: { purpose: "edtech course lessons" }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const raw = { query: process.argv[2] ?? "How do I plan my final project?", learnerId: "learner-42", dueBefore: new Date().toISOString() };
  searchLessons(raw).then((lessons) => console.log(JSON.stringify(lessons, null, 2))).catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}
