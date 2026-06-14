# AI_USAGE.md: AI Collaboration Log

This document details the AI tools used during the development of the Shared Expenses App, key prompts, and three concrete cases where AI generation required correction.

---

## 1. AI Tools & Key Prompts

### AI Collaboration:
- **Collaborator**: Gemini 3.5 Flash / Google DeepMind Antigravity Agent.
- **Role**: Pair Programmer and Code Generator.

### Key Prompts:
- *“Scan and parse the expenses_export.csv file. Identify the 12+ deliberate data problems and create a resolution strategy for each.”*
- *“Write a Prisma relational schema that tracks user membership durations over time, expenses, and splits, supporting dual SQLite/PostgreSQL connectors.”*
- *“Implement a greedy min-transfers algorithm to simplify flatmate debts.”*

---

## 2. Three Concrete Cases of AI Corrections

### Case 1: Prisma 7 Datasource URL Validation Failure
- **AI Output**: The AI initially generated a standard `schema.prisma` file containing:
  ```prisma
  datasource db {
    provider = "sqlite"
    url      = env("DATABASE_URL")
  }
  ```
- **How We Caught It**: When running `npx prisma migrate dev --name init`, the CLI threw a validation error `P1012`: *`error: The datasource property url is no longer supported in schema files. Move connection URLs to prisma.config.ts`*. This was because the project was initialized with the latest Prisma 7.8.0.
- **What We Changed**: We researched the new Prisma 7 configuration conventions, removed the `url` field from `schema.prisma`, and moved it entirely into the newly introduced `prisma.config.ts` file under `datasource.url`.

### Case 2: Prisma Client Empty Constructor Error During Seeding
- **AI Output**: The AI generated the seed script `prisma/seed.js` using the default constructor `const prisma = new PrismaClient();`.
- **How We Caught It**: Running the seed command failed with `PrismaClientInitializationError: PrismaClient needs to be constructed with a non-empty, valid PrismaClientOptions`.
- **What We Changed**: Since Prisma 7 no longer reads database URLs directly from the schema, the client requires an explicit driver adapter inside JS runtimes. We updated `prisma/seed.js` to import `@prisma/adapter-better-sqlite3` and `better-sqlite3`, and initialized the client with the SQLite adapter:
  ```javascript
  const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
  const prisma = new PrismaClient({ adapter });
  ```

### Case 3: Node-Specific Modules Leaked to Client-Side Bundles
- **AI Output**: The AI generated `src/lib/csvParser.js` with an unused import at the top:
  ```javascript
  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
  ```
- **How We Caught It**: When running `npm run build`, Next.js's static analysis in Turbopack threw compile errors stating that `fs` and `path` modules could not be resolved inside client-side components. The CSV parser was imported by `ImportWizard.js` (a client component), causing Webpack to attempt bundling the database driver adapter for the browser.
- **What We Changed**: We audited `src/lib/csvParser.js` and removed the unused import. Since the parser only handles string parsing and data normalization, removing the database driver reference cleaned the bundle dependencies and resolved the compilation block.
