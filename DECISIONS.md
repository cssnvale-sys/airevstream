# Architecture & Design Decisions

## D001: Fastify over Express for Services
**Date**: 2026-03-17
**Decision**: Use Fastify as the HTTP framework for all backend services.
**Rationale**: Fastify is significantly faster than Express, has first-class TypeScript support, built-in JSON schema validation, and a robust plugin ecosystem. It also supports async/await natively without wrapper hacks.

## D002: Prisma as ORM
**Date**: 2026-03-17
**Decision**: Use Prisma ORM for database access.
**Rationale**: Prisma provides type-safe database queries, automatic migration management, and excellent DX with auto-generated types. It integrates well with TypeScript monorepos.

## D003: BullMQ for Job Queues
**Date**: 2026-03-17
**Decision**: Use BullMQ (backed by Redis) for all background job processing.
**Rationale**: BullMQ is the de facto standard for Node.js job queues. It provides reliable job processing, rate limiting, job scheduling, retries, and dashboard monitoring via Bull Board.

## D004: Zod for Runtime Validation
**Date**: 2026-03-17
**Decision**: Use Zod for all runtime validation and schema definitions.
**Rationale**: Zod provides TypeScript-first schema validation with excellent type inference. Schemas can be shared between frontend and backend, ensuring consistent validation.

## D005: Pino for Logging
**Date**: 2026-03-17
**Decision**: Use Pino as the logging library across all services and packages.
**Rationale**: Pino is the fastest Node.js logger, outputs structured JSON, and integrates natively with Fastify. Consistent logging across the monorepo simplifies debugging and monitoring.

## D006: Vitest for Testing
**Date**: 2026-03-17
**Decision**: Use Vitest for all unit and integration tests.
**Rationale**: Vitest is fast, has native ESM support, is compatible with the Jest API (easy migration), and works well with TypeScript without extra configuration.

## D007: AES-256-GCM for Secret Encryption
**Date**: 2026-03-17
**Decision**: Use AES-256-GCM for encrypting stored secrets (API tokens, OAuth credentials).
**Rationale**: AES-256-GCM provides authenticated encryption, preventing both decryption without the key and tampering. It's the industry standard for at-rest encryption and is available natively in Node.js crypto module.

## D008: Ollama as Default AI Provider
**Date**: 2026-03-17
**Decision**: Use Ollama as the default/primary AI provider, with the ai-client package designed to support additional providers later.
**Rationale**: Ollama provides free, local AI inference with no API costs. The system is designed for self-hosted operation, so local AI aligns with the architecture. The client abstraction allows adding OpenAI/Anthropic/etc. later.

## D009: Multi-Provider AI Service Registry with Fallback Chains
**Date**: 2026-03-17
**Decision**: Evolve @airevstream/ai-client from a thin Ollama wrapper into a full Service Registry with provider abstraction, fallback chains, circuit breaker, and cost tracking.
**Rationale**: The PRD requires multi-provider support (Ollama, OpenAI, Anthropic, ComfyUI, ElevenLabs, video APIs). The registry pattern allows: (1) dynamic service selection based on type/health/cost/quality, (2) automatic fallback when a service fails, (3) circuit breaker to avoid hammering failing services, (4) usage/cost tracking per request. The design uses dependency injection (ServiceFetcher, UsageLogger) to avoid tight coupling to Prisma, keeping the package testable without a database.

## D010: CSS Variable Design System with RGB Channel Format
**Date**: 2026-03-17
**Decision**: Use CSS custom properties with RGB channel values (e.g., `--accent-blue: 59 130 246`) rather than hex colors.
**Rationale**: Tailwind CSS opacity modifiers (e.g., `bg-accent-blue/50`) require colors defined as color channels, not opaque hex values. The RGB channel format with `rgb(var(--color) / <alpha-value>)` in tailwind.config.ts enables full opacity modifier support while maintaining dark/light theme switching via CSS variable overrides.

## D011: Next.js API Routes as Backend-for-Frontend
**Date**: 2026-03-17
**Decision**: Use Next.js API routes (/api/v1/*) as the primary web dashboard backend instead of proxying to separate Fastify services.
**Rationale**: Running Prisma queries directly in API routes eliminates network hops, simplifies deployment, and allows the dashboard to function independently. The Fastify services (workflow-engine, ai-assistant, production-pipeline) remain as separate microservices for worker orchestration, long-running AI tasks, and production pipeline operations. This BFF pattern gives the best of both worlds: fast dashboard queries + specialized service processes.

## D012: SWR for Client-Side Data Fetching
**Date**: 2026-03-17
**Decision**: Use SWR (stale-while-revalidate) for all dashboard data fetching instead of React Query or raw fetch.
**Rationale**: SWR is lightweight (~4KB), integrates naturally with Next.js (same team), provides automatic revalidation, deduplication, and optimistic updates. The `useApi()` hook wraps SWR with auth headers and error handling, while `apiPost/apiPut/apiDelete` helpers handle mutations with SWR cache invalidation.
