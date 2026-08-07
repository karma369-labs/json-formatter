# JSON Studio

Fast, client-side JSON editor, inspector, and toolkit.

JSON Studio is built for speed and privacy — everything runs entirely in your browser with zero server round-trips.

---

## Key Features

- **Instant Client-Side Formatting**: Beautify (`Cmd/Ctrl+Enter`), Minify (`Cmd/Ctrl+M`), and recursive Key Sorting (`Cmd/Ctrl+S`).
- **1-Click Auto-Fix / Repair**: Automatically detects and fixes unquoted keys, single quotes, trailing commas, and JS comments.
- **Interactive Tree Inspector**: Expandable object/array nodes, item count badges, JSONPath copy (`P`), value copy, and live search filtering.
- **Built-In Test Payloads**: Categorized sample payloads (REST API, GeoJSON, E-Commerce, Package Manifest, Broken JSON for Repair testing).
- **Named Snapshots**: Save, browse, and restore document snapshots persisted via `localStorage`.
- **Drag-and-Drop & Upload**: Drop files directly anywhere on the canvas or pick via upload button.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (or Node 18+)

### Development

```bash
# Install dependencies
bun install

# Start development server
bun dev
```

### Build & Type Check

```bash
# Run TypeScript validation
npx tsc --noEmit

# Production build
npx vite build
```

---

## Documentation & Testing

- **[PRD Spec](file:///c:/PersonalProjects/json-formatter/PRD.md)** — Comprehensive product specification.
- **[Manual Test Suite](file:///c:/PersonalProjects/json-formatter/docs/MANUAL_TEST_SUITE.md)** — Complete test matrix and manual QA scenarios for Antigravity agents & developers.

---

## Tech Stack

React 19 · TypeScript · Vite · CodeMirror 6 · Lucide Icons · Bun
