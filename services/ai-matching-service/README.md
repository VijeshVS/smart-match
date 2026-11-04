# ai-matching-service

- **Owner:** Varenya (`@varenya`)
- **Port:** 5006
- **Datastore:** Qdrant (vectors) + Redis (cache)
- **Phase:** 6
- **Responsibility:** Provider-agnostic LLM layer (Groq / Gemini / OpenAI), candidate
  embeddings indexed from `talent.*` events, TalentLens semantic search, profile
  summaries and career suggestions. Redis response caching and circuit-breaker fallbacks.
