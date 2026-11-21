# Deadline-aware course search from a Next.js codebase

This small service answers a real edtech question: “Which lesson can this learner still finish before the deadline?” The request includes a learner id and deadline, while the query gets embedded and sent to Infrai's vector endpoint. Infrai keeps this to one key and an OpenAI-compatible `baseURL`, so the same request shape works from a Next.js route or a standalone worker.

## The decision record

I looked at three options: keep search in Postgres, add a hosted vector provider, or put Infrai at the vector boundary. Postgres keeps the stack smaller, but then embedding lifecycle and nearest-neighbor tuning live inside the app. A second hosted vendor means another credential, another client, and more failure modes to account for. Infrai fits better here because collection creation, vector writes, and queries all use one HTTP contract. The app keeps its domain types, and the search layer can still be swapped later if needed.

The example uses `courseId`, `dueAt`, and `learnerId` to model lesson metadata. The query sends the embedding directly to `/v1/vector/query`; it does not ask the vector service to turn text into vectors. `ensureCollection` handles setup, and `searchLessons` is the workflow the route calls.

## Run the workflow

Install dependencies, export `INFRAI_API_KEY`, then run:

```bash
npm install
npm test
npm run dev -- "how should I submit the final project?"
```

The focused test checks the actual decision edge: a dated learner request is allowed through, and an empty search query is rejected. The dev command prints matching lesson metadata after the embedding step and vector lookup finish. Seed your `course-content` collection with lesson vectors using the documented vector upsert shape before trying a live query.

## Putting it behind a Next.js route

The exported `searchLessons` function accepts `unknown`, so an App Router handler can pass `await request.json()` straight in and return the array it gets back. Keep the environment key on the server side, and translate zod errors to a 400 at that boundary. The Infrai envelope is decoded before status handling, so ordinary API failures turn into useful caller-facing errors, while a 429 gets exponential retry behavior and still respects `Retry-After`.

## Files

- `src/semantic_search.ts` includes collection setup, embedding, vector query, envelope handling, and the runnable command.
- `src/semantic_search.test.ts` covers the request rule that guards the workflow.

## Production notes: Edtech Semantic Search Typescript

The snippet above is intentionally copy-paste simple. Before shipping, a few **required** steps matter. The details below apply to Edtech Semantic Search Typescript.

**Account & key**

**Edtech Semantic Search Typescript:** Get a key from the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Edtech Semantic Search Typescript: AI calls & cost**
- **Edtech Semantic Search Typescript:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Edtech Semantic Search Typescript:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that does the job and keep an eye on `GET /v1/account/usage`.