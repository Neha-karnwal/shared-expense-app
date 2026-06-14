# DECISIONS.md: Engineering & Product Decision Log

This document records the architectural and product decisions made during the design and development of the Shared Expenses App, listing options considered and the rationale behind each choice.

---

## 1. Technology Stack: Next.js + Prisma ORM + Vanilla CSS

### Options Considered:
- **Option A**: React SPA + Express.js + Prisma + PostgreSQL (Dual-project setup)
- **Option B**: Next.js App Router (unified server/client runtime) + Prisma ORM + SQLite/PostgreSQL (Dual-DB configuration)
- **Option C**: Python Flask backend + React frontend + SQLite

### Chosen Path: **Option B (Next.js App Router + Prisma + Dual-DB)**
### Rationale:
- **Unified Codebase**: Next.js App Router combines our frontend React elements and server action backend controllers into a single project. This makes development, state sharing, local execution, and deployment extremely fast and cohesive.
- **ORM Portability**: Prisma ORM allows us to write database queries in standard JavaScript/TypeScript and model the schema once. By using the new Prisma 7 driver adapters, we can run a single-file SQLite database locally (`better-sqlite3`) for the user to try instantly with zero-setup, and swap to a PostgreSQL server (`pg` / Neon / Supabase) for the public deployed website by simply changing the `DATABASE_URL` environment string.
- **Styling Control**: Using Vanilla CSS (via Next.js scoped CSS Modules) gives us complete layout flexibility and ensures the glassmorphic dark mode styling is customized without the dependencies or bloat of Tailwind configurations.

---

## 2. CSV Importer Architecture: Interactive Wizard vs. Headless Ingestion

### Options Considered:
- **Option A**: Silent Auto-Correction. The app uploads the CSV, guesses the best resolutions silently (e.g. auto-deletes Row 6, converts USD at a fixed rate, and ignores the Meera April rent split), and shows the final dashboard.
- **Option B**: Crash on Error. The app refuses to import if any row fails validation, requiring the user to edit the CSV file manually in Excel/Notepad.
- **Option C**: Interactive Reconciliation Wizard (Chosen). The app ingests the CSV, identifies all anomalies in memory, and guides the user through a multi-step verification and approval screen.

### Chosen Path: **Option C (Interactive Wizard)**
### Rationale:
- **Meera's Request**: Meera specifically requested: *"Clean up the duplicates — but I want to approve anything the app deletes or changes."* Option C satisfies this product requirement by prompting for confirmation before committing any changes.
- **USD Conversions**: Priya noted that the spreadsheet treats a dollar as a rupee. Option C allows the user to dynamically adjust the USD/INR conversion rate in the UI rather than hardcoding it.
- **Product Transparency**: Option C transforms a boring import process into an interactive experience, showing exact comparison cards for duplicates (Marina Bites) and conflicts (Thalassa Dinner), making it clear which rows are kept and which are discarded.

---

## 3. Debt Settlement: Greedy Min-Transfers Algorithm (Splitwise)

### Options Considered:
- **Option A**: Pairwise Netting. If Rohan owes Aisha ₹2,000, and Aisha owes Rohan ₹1,000, they settle pairwise. This results in $N(N-1)/2$ potential transactions.
- **Option B**: Greedy Min-Transfers Algorithm (Chosen). Aggregate all individual splits into a single net balance (Total Paid - Total Owed) per person. Match the largest net debtors with the largest net creditors, and resolve their balances iteratively.

### Chosen Path: **Option B (Greedy Min-Transfers)**
### Rationale:
- **Aisha's Request**: Aisha requested: *"I just want one number per person. Who pays whom, how much, done."* Greedy min-transfers produces the absolute minimum number of payments to settle the flat, resolving complex multi-party debts into simple, direct transactions (e.g. Rohan pays Aisha ₹5,000).

---

## 4. Database Schema for Settlements vs. Expenses

### Options Considered:
- **Option A**: Separate tables for `Expense` and `Settlement`.
- **Option B**: Unified `Expense` table with an `isSettlement` boolean flag.

### Chosen Path: **Option B (Unified table)**
### Rationale:
- **Unified Balance Calculation**: Calculating roommate balances requires scanning both splits of regular expenses and direct P2P payments (settlements). Storing them in a single table structure with splits allows us to calculate net balances using a single, unified database query.
- **Simpler Ledger Rendering**: Rohan's itemized ledger view can display both expenses and settlements chronologically in a single table without complex multi-table SQL joins.
