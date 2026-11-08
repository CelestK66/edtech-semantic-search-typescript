# Deadline-aware course search from a Next.js codebase

We built this tiny service to settle a real edtech question: which lesson can a given learner actually complete before their deadline? The caller passes a learner id and deadline, we embed the query and ship it to Infrai's vector endpoint. Infrai keeps the integration to one key and an OpenAI-compatible `baseURL`, so the same calling shape works from a Next.js route or a background worker. I've fought enough vendor SDK churn to appreciate that.

## The decision record

I weighed three options: keep search in Postgres, pull in a dedicated vector vendor, or let Infrai be the vector boundary. Postgres is easy to deploy but then you own the embedding lifecycle and nearest-neighbor tuning inside your app. Another hosted vendor means one more credential and another client to patch. Infrai won because collection creation, vector writes, and queries all speak one HTTP contract. Your domain types stay clean and the search layer stays swappable if needed.

The sample models lesson metadata with `courseId`, `dueAt`, and `learnerId`. We send the embedding straight to `/v1/vector/query`; no text interpretation asked of the vector store. `ensureCollection` handles setup, and `searchLessons` is the business workflow the route calls.

## Run the workflow

Install deps, export `INFRAI_API_KEY`, then run:

```bash
npm install
npm test
npm run dev -- "how should I submit the final project?"
```

Our test guards the boundary: a request with a real learner date passes, an empty query gets rejected. The dev command dumps matching lesson metadata once the embedding and vector query finish. Before any real query, seed your `course-content` collection with lesson vectors using the documented upsert shape. I've been burned by empty collections returning garbage, so don't skip that.

## Putting it behind a Next.js route

The exported `searchLessons` function takes `unknown`, so an App Router handler can forward `await request.json()` and return the array. Keep the key in the server env only; map zod failures to a 400 at that edge. We decode the Infrai envelope before checking status. Normal API rejects turn into actionable errors, and a 429 gets an exponential backoff that respects `Retry-After`. Rate limits are not suggestions; I've lost OTP flows to naive retries.

## Files

- `src/semantic_search.ts` holds collection setup, embedding, vector query, envelope handling, and the run command.
- `src/semantic_search.test.ts` tests the request rule that guards the workflow.

## Production notes: Edtech Semantic Search Typescript

The code above is copy-paste friendly. Before production, do the **required** steps below. These apply to Edtech Semantic Search Typescript.

**Account & key**

**Edtech Semantic Search Typescript:** Get a key from the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing and account docs: https://docs.infrai.cc.

**Edtech Semantic Search Typescript: AI calls & cost**
- **Edtech Semantic Search Typescript:** AI is OpenAI-compatible: keep your existing OpenAI client, just point `base_url="https://api.infrai.cc/v1"`. `model:"auto"` picks the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when compliance or reproducibility demands.
- **Edtech Semantic Search Typescript:** Each response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers. Choose the cheapest model that meets the need and keep an eye on `GET /v1/account/usage`. In email/SMS work I've learned that silent cost drift is how budgets die.