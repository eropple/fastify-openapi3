# Project: fastify-openapi3

## Package Manager

This project uses **pnpm**. Do not use npm or yarn.

```bash
pnpm install          # Install dependencies
pnpm test             # Run tests
pnpm lint             # Run linter
pnpm lint --fix       # Auto-fix lint issues
```

## Project Overview

A Fastify plugin for generating OpenAPI 3.1 specifications from route definitions using TypeBox schemas.

## Key Commands

- `pnpm test` - Run vitest test suite
- `pnpm lint` - Run ESLint with Prettier
- `pnpm build` - Build TypeScript
- `pnpm demo` - Run example server

## Architecture

- `src/plugin.ts` - Main plugin entry point
- `src/autowired-security/` - Security scheme handling (API key, HTTP Basic, Bearer)
- `src/test/` - Test files (vitest)
