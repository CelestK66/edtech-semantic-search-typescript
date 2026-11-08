import { describe, expect, it } from "vitest";
import { z } from "zod";

const searchRequest = z.object({ query: z.string().min(1), learnerId: z.string().min(1), dueBefore: z.string().datetime() });

describe("course search request", () => {
  it("accepts a learner deadline and rejects an empty query", () => {
    const valid = searchRequest.safeParse({ query: "grading rubric", learnerId: "learner-42", dueBefore: "2026-10-01T00:00:00.000Z" });
    const invalid = searchRequest.safeParse({ query: "", learnerId: "learner-42", dueBefore: "2026-10-01T00:00:00.000Z" });
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });
});
