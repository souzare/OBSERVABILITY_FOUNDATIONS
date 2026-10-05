# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

This repo is at a very early stage: it holds no source code, build system, tests, or linter, so there are no build/lint/test commands yet. The only content is planning material for an **Observability Foundations** course (written in Portuguese):

- `Roteiro.txt` — the course outline (5 modules) with the teaching assets and demos to produce. Treat it as the source of truth for scope.
- `Prompts.md` — currently empty; intended for prompts used to generate course assets.

Write course content and assets in Portuguese (pt-BR) to match the outline.

## Course structure (from `Roteiro.txt`)

1. **Module 1 – Concepts:** noise vs. signal (HTML/infographic), MELT infographic, an activity to identify observability consumers, latest maturity model.
2. **Module 2 – Pillars demo:** build an architecture diagram that is progressively "turned on" as each pillar is enabled. Demo app is started from scratch and instrumented incrementally (logs/metrics/traces) to show how the pillars complement each other. Traces via Jaeger or Datadog; infographic (or Datadog example) for trace/span and sampling.
3. **Module 3 – OpenTelemetry:** redo the Module 2 instrumentation using OTEL, with an improved use case.
4. **Module 4 – Service mapping:** correlate services and infrastructure; better explanation of Time Travel Topology.
5. **Module 5 – Security/AIOps:** CIA Triad; possibly run an AIOps demo to show the importance of data.

## Cross-module dependencies

The modules build on each other: the demo app and architecture diagram from Module 2 are reused in Module 3 (re-instrumented with OTEL) and Module 4 (service map). Keep the app, service names, and diagram consistent across modules when creating them.
