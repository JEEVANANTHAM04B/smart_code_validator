# Smart Code Validator — Complete Technical & Architecture Documentation

This document provides a detailed breakdown of the programming languages, framework architectures, libraries, packages, execution runtimes, and engineering techniques used in the **Smart Code Validator** portal.

---

## 1. Programming & Query Languages

| Layer | Language | Purpose & Usage |
| :--- | :--- | :--- |
| **Frontend UI** | **TypeScript / TSX** | Strong type safety across all React UI components, TanStack Router routes, state management, and user interactions. |
| **Styling & Design** | **CSS3 / TailwindCSS v4** | Custom design tokens, glassmorphism UI styles, dark/light theme management, responsive grid and flexbox layouts. |
| **Backend & API** | **TypeScript (Node.js)** | TanStack Start Server Functions, Supabase Admin client integrations, authentication middleware, and report generation workflows. |
| **Code Sandboxes** | **Python 3** | User submitted Python assessment code executed in WebAssembly sandboxes via Pyodide. |
| **Code Sandboxes** | **SQL (ANSI & SQLite)** | User submitted SQL queries evaluated against in-memory datasets extracted from question contexts using `sql.js`. |
| **Database** | **PostgreSQL / PL/pgSQL** | PostgreSQL DDL/DML database schemas, foreign keys, indexes, Row-Level Security (RLS) policies, and RPC stored procedures (`authenticate_employee`). |

---

## 2. Frontend Technologies & Libraries

### Core Framework & Routing
- **React 19 (`react`, `react-dom`)**: Core UI library rendering component trees, hooks, and reactive UI state.
- **TanStack Router (`@tanstack/react-router`)**: Fully type-safe, file-based routing system powering layout hierarchies (`/employee/*`, `/admin/*`, `/history/*`).
- **TanStack Start (`@tanstack/react-start`)**: Full-stack React framework providing Server-Side Rendering (SSR) and full-stack integration.
- **TanStack Query (`@tanstack/react-query`)**: Client-side state caching, background query refetching, and cache invalidation.

### UI Design System & Component Primitives
- **Shadcn UI & Radix UI Primitives**: Accessible UI components built on Radix primitives:
  - `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tabs`, `@radix-ui/react-select`
  - `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-tooltip`, `@radix-ui/react-switch`
  - `@radix-ui/react-avatar`, `@radix-ui/react-checkbox`, `@radix-ui/react-radio-group`, `@radix-ui/react-slider`
- **Monaco Editor (`@monaco-editor/react`)**: Embedded VS Code code editor with syntax highlighting, line numbers, and theme matching for Python & SQL code editing.
- **Lucide React (`lucide-react`)**: Modern icon suite used across navigation, dashboard statistics cards, and validation status indicators.
- **Sonner (`sonner`)**: Toast notification system for user feedback (uploads, validation status, logouts).
- **Recharts (`recharts`)**: Data visualization library powering analytics dashboard charts.

### Styling & Utility Libraries
- **TailwindCSS v4 (`tailwindcss`, `@tailwindcss/vite`)**: Utility-first CSS framework for layout, spacing, typography, and responsive design.
- **Class Variance Authority (`class-variance-authority`)**: Utility for managing variant-based component styles.
- **clsx & tailwind-merge (`clsx`, `tailwind-merge`)**: Utility functions for conditionally joining CSS class names without styling conflicts.
- **Date-fns (`date-fns`)**: Formatting and manipulating submission timestamps and upload dates.

---

## 3. Validation Engines & WebAssembly Runtimes

### 1. Python Validation Engine
- **Pyodide (`pyodide` v314.0.3)**:
  - WebAssembly (WASM) port of the Python 3 runtime running directly in isolated environments.
  - Captures `stdout` and `stderr` streams line-by-line during code execution.
  - Returns real runtime execution timing, execution status, and exact console output.

### 2. SQL Validation Engine
- **sql.js (`sql.js` v1.14.1)**:
  - C-compiled SQLite database engine ported to WebAssembly.
  - **In-Memory Table Builder**: Parses Markdown & ASCII tables from question text to dynamically construct SQLite tables and insert typed row values.
  - **Dataset Aliasing**: Automatically registers table names under case-sensitive, lowercase, and uppercase aliases (`Employees`, `employees`, `EMPLOYEES`) matching `FROM` and `JOIN` query clauses.
  - **Semantic SQL Fallback Validator**: Syntactically validates queries and evaluates logic against expected outputs if database tables are unpopulated in prose.

### 3. AI Code Reviewer & Deterministic Fallbacks
- **Vercel AI SDK (`ai`, `@ai-sdk/openai`)**:
  - Connects to Lovable Gateway API (`openai/gpt-5.6-sol`) to perform static analysis, quality scoring, complexity estimation, and solution generation.
- **Deterministic Fallback Engine**:
  - Automatically calculates static complexities (`O(n log n)`, `O(n)`) and realistic quality scores when AI APIs are unconfigured or offline, ensuring core validation is never blocked.

---

## 4. Document Processing & Report Generation

- **Mammoth (`mammoth` v1.12.1)**: Server-side Word document processing library that extracts raw text and converts `.docx` documents into HTML previews.
- **Docx Preview (`docx-preview` v0.4.0)**: In-browser library that renders `.docx` files on HTML5 Canvas containers with preserved formatting.
- **jsPDF (`jspdf` v4.2.1) & html2canvas (`html2canvas`)**: PDF generation suite capturing assessment reports and converting UI layouts into downloadable PDF documents.
- **docx (`docx` v9.7.1)**: Programmatic Word document builder generating structured `.docx` assessment reports.

---

## 5. Database, Storage & Security Architecture

### Supabase PostgreSQL Database
- **`employees` table**: Stores employee IDs, names, departments, access statuses (`access_status`), and admin flags (`is_admin`).
- **`employee_files` table**: Tracks uploaded task documents, original filenames, file paths, file sizes, and validation statuses (`validation_status`).
- **`submissions` table**: Stores published validation results, code submissions, execution outputs, scores, complexity analysis, and JSONB reports.

### Security & Access Control
- **Row-Level Security (RLS)**: Enforced across PostgreSQL tables.
- **Service Role Execution**: Server functions query Supabase via `@supabase/supabase-js` using `SUPABASE_SERVICE_ROLE_KEY` on the server, keeping service keys hidden from client bundles.
- **Cookie Authentication**: HttpOnly cookie (`employee_session`) storing Zod-validated session payloads (`SessionPayload`).
- **Tenant Data Isolation**: Employee queries are strictly scoped to `employee_uuid = session.id` or `employee_code = session.employeeId`.

---

## 6. Build System & Tools

- **Vite 8 (`vite`)**: Next-generation frontend build tool and dev server with instant HMR (Hot Module Replacement).
- **Nitro (`nitro`)**: Server engine powering TanStack Start SSR builds and Cloudflare/Node deployment bundles.
- **TypeScript 5.8 (`typescript`)**: Static type checker enforcing type safety across client and server.
- **ESLint & Prettier (`eslint`, `prettier`)**: Code linting and formatting configuration.
