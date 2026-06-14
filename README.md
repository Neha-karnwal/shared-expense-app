# SharedExpense: Shared Expenses App

SharedExpense is a Next.js web application built to consolidate, cleanse, and resolve a messy roommate shared expense spreadsheet. It features interactive anomaly detection, timeline-based splits, and debt simplification.

## 🛠️ Technology Stack
- **Framework**: Next.js (App Router, React 19)
- **Database**: Relational Database via **Prisma ORM**
  - **Local Development**: SQLite (via `better-sqlite3` driver adapter)
  - **Production/Deployment**: PostgreSQL (via `pg` adapter, e.g. Neon or Supabase)
- **Styling**: Scoped Vanilla CSS Modules
- **Authentication**: Native session cookie authentication
- **AI Tool Used**: Gemini 3.5 Flash via Antigravity Agent

---

## 🚀 Setup & Installation (Local Execution)

Follow these steps to run the application locally on your machine:

### 1. Install Dependencies
Ensure you have Node.js (v18+) and npm installed. Run:
```bash
npm install
```

### 2. Configure Database & Migrations
Initialize the SQLite database schema and generate the Prisma client:
```bash
# Generate Prisma Client
npx prisma generate

# Create and apply migration database tables
npx prisma migrate dev --name init
```

### 3. Seed Database
Seed the database with the default group ("Cozy Flat 404") and the 6 roommate users:
```bash
npx prisma db seed
```

### 4. Run Development Server
Start both the frontend and backend servers locally:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 🔑 Login Credentials for Roommates

For convenience during evaluation, the login screen includes **Autofill Buttons** for all six flatmates. If logging in manually, use the following credentials:

| Roommate | Username | Password | Tenancy Status |
| :--- | :--- | :--- | :--- |
| **Aisha** | `Aisha` | `aisha123` | Active since Feb 1, 2026 |
| **Rohan** | `Rohan` | `rohan123` | Active since Feb 1, 2026 |
| **Priya** | `Priya` | `priya123` | Active since Feb 1, 2026 |
| **Meera** | `Meera` | `meera123` | Left flat on March 31, 2026 |
| **Sam** | `Sam` | `sam123` | Joined flat on April 15, 2026 |
| **Dev** | `Dev` | `dev123` | Guest (Weekend visits & March Trip) |

---

## 📂 Deliverables Included in this Repo
- [README.md](file:///c:/Users/hp/OneDrive/Desktop/Assignment/README.md) — Setup guide.
- [SCOPE.md](file:///c:/Users/hp/OneDrive/Desktop/Assignment/SCOPE.md) — Log of all 15 deliberate CSV anomalies, resolution policies, and the DB schema.
- [DECISIONS.md](file:///c:/Users/hp/OneDrive/Desktop/Assignment/DECISIONS.md) — Log of architectural decisions, options, and justifications.
- [AI_USAGE.md](file:///c:/Users/hp/OneDrive/Desktop/Assignment/AI_USAGE.md) — AI tools, prompts, and 3 concrete debugging cases.
- `IMPORT_REPORT.md` (See below) — Produced by the importer on ingestion.

---

## 📝 How to Import the CSV via UI
1. Start the server and navigate to [http://localhost:3000](http://localhost:3000).
2. Click on the **Aisha Quick Login** button.
3. Since the database is clean and has no expenses, you will be automatically redirected to the **CSV Import Wizard**.
4. Drag and drop the `expenses_export.csv` file (located in the project root) or copy-paste its content, and click **Scan & Parse**.
5. Step through the 7-step wizard to resolve names, missing payers, USD rates, percentage splits, tenancy timelines, duplicates, and conflicts.
6. Click **Save & Import** to commit the cleaned dataset to the database.
7. You will be redirected back to the dashboard, where you can view all roommate balances and itemized ledgers.
