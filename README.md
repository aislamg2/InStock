# InStock — Sprint 1: Equipment Registration

Asset tracking system for managing building equipment (printers, projectors, etc).

## Sprint 1 User Story
**Registering Equipment** (SP: 8)
> As a user, I want to register new equipment by scanning the serial number so that I don't have to hunt for physical tags and can avoid manual spreadsheet entry.

## Quick Start

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## Run Tests

```bash
npm test
```

This runs all 39 tests:
- **23 Unit Tests** — pure business logic (validation, search, CRUD)
- **8 Integration Tests** — UI interaction flows via React Testing Library
- **8 User Acceptance Tests** — maps to acceptance criteria for the user story

Watch mode: `npm run test:watch`

## Project Structure

```
instock/
├── index.html              # Entry point
├── package.json
├── vite.config.js          # Vite + Vitest config
├── src/
│   ├── main.jsx            # React mount
│   ├── InStock.jsx         # Main app component
│   └── equipmentService.js # Business logic (testable)
└── test/
    ├── setup.js
    ├── equipmentService.unit.test.js
    ├── registration.integration.test.jsx
    └── registration.uat.test.jsx
```
