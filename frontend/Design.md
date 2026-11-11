# DelTix — Design Spec

Build target: the DelTix web app, an operations console where finance teams run, review and approve AI agents that move real money. Think "Linear for payment operations," not "sci-fi HUD."

Read this whole file before writing UI code. Sections 2 and 3 override any instinct you have about how a fintech or AI product should look.

---

## 1. Product in one paragraph

DelTix compiles agent definitions into deterministic graphs. A run reads invoices or ledger data, verifies figures with deterministic math, checks spend policies, pauses for human approval when a rule requires it, then triggers a disbursement (PayPal first). Users are finance ops staff, controllers and engineers. They open this app to answer four questions fast: what is running, what needs my approval, what went wrong, and what exactly happened in run X.

Design for scanning, comparing and deciding. Not for showing off.

## 2. Design principles

1. **Information density beats atmosphere.** Real tables, real rows, real numbers. Every pixel earns its place by carrying information.
2. **Color is scarce and always means something.** Surfaces are neutral gray. Color appears only for status (running, waiting, failed, succeeded) and the single primary action.
3. **Flat and hairline.** Structure comes from 1px borders and small background steps, never from glows, blurs or big shadows.
4. **Money is unambiguous.** Currency, sign, decimals and environment (Sandbox vs Live) are always visible, never inferred.
5. **Keyboard first.** Every list is navigable with j/k, every page reachable from Cmd+K.
6. **Quiet by default.** Nothing animates unless state actually changed.

## 3. Hard bans (these make a UI look generated)

- No neon glows, `drop-shadow` halos, or `box-shadow` colored by status.
- No glassmorphism or `backdrop-blur` on panels, cards or headers. (Only allowed: the Cmd+K overlay scrim at 40% black, no blur.)
- No gradient logos, gradient text, gradient borders, or gradient backgrounds.
- No dot-grid or micro-grid page backgrounds. Plain flat background.
- No pulsing or breathing animations on badges, nodes or banners.
- No ALL-CAPS labels, no tracked-out eyebrow text above headings, no `01 / 02 / 03` numbering unless the content is a real sequence.
- No monospace for ordinary UI labels. Mono is only for IDs, hashes, JSON, logs, code.
- No identical rounded cards stacked in a grid as the layout. Use tables, lists, split panes.
- No hero sections, marketing copy, taglines ("mission-critical", "sovereign", "zero-hallucination") inside the app.
- No emoji. No decorative illustrations.
- No acid green (`#00F5A0`-type) or saturated cyan on black. Status colors come from the scales in section 4.
- No slider-to-confirm or hold-to-confirm gimmicks. Use a normal two-step confirm.
- Border radius never above 8px except full-round avatars and status dots.

## 4. Design tokens

Use Radix Colors as the color source so the palette is a tested system, not hand-picked hex. Install `@radix-ui/colors`. Map the scales to CSS variables once, then use only variables.

### Color (dark theme is default)

| Role | Radix source (dark) | Notes |
|---|---|---|
| App background | `slateDark.slate1` | page canvas |
| Panel background | `slateDark.slate2` | sidebar, sheets, table container |
| Raised / input | `slateDark.slate3` | inputs, menus, hover rows |
| Hover | `slateDark.slate4` | |
| Border subtle | `slateDark.slate5` | default 1px borders |
| Border strong | `slateDark.slate7` | focus-adjacent, inputs hover |
| Text primary | `slateDark.slate12` | |
| Text secondary | `slateDark.slate11` | |
| Text tertiary | `slateDark.slate9` | placeholders, disabled |
| Success | `greenDark.green9` text `green11`, fill `green3` | verified, completed, approved |
| Warning / waiting | `amberDark.amber9` text `amber11`, fill `amber3` | waiting for approval |
| Danger | `redDark.red9` text `red11`, fill `red3` | failed, rejected, policy block |
| Active / info | `blueDark.blue9` text `blue11`, fill `blue3` | running, selected |

- **Primary button:** solid `slate12` background with `slate1` text (Vercel style). Not green, not gradient.
- **Destructive button:** `red9` background, white text, used only for Reject / Revoke / Cancel run.
- **Selected row / active nav:** `slate4` background plus a 2px left bar in `blue9`.
- Status is shown as a small icon or dot plus text label, never color alone (accessibility). Use `fill` tokens for badge backgrounds, `11` tokens for badge text.
- Light theme: same mapping with Radix light scales. Build it after dark is done; it must pass the same checklist.
- Do not use pure `#000` or `#fff` anywhere.

### Typography

- Sans: **Geist Sans** (via `geist` package). Mono: **Geist Mono**.
- Base UI size **13px**, table cells 13px, secondary 12px, page title 20px/600, section title 14px/600. Line height 1.45. Letter spacing -0.01em on titles only.
- Money, counts and durations use **Geist Sans with `font-variant-numeric: tabular-nums`**, right-aligned in tables. Do not set amounts in mono.
- Mono (12px) only for: run IDs, node IDs, HMAC/idempotency tokens, JSON, log lines, expressions in the policy editor.
- Sentence case everywhere.

### Spacing, size, shape

- 4px base grid. Page padding 24px. Panel padding 16px.
- Control height 32px, table row height 36px (compact toggle: 28px).
- Radius: 4px badges, 6px buttons and inputs, 8px panels and menus.
- Borders: 1px `slate5`. Panels separate with borders, not shadows.
- Shadow: only on floating layers (menus, popovers, toasts): `0 8px 24px rgba(0,0,0,.35)` plus 1px border.

### Motion

- Hover and focus transitions 120ms ease-out, color only.
- Sheets and dialogs: 160ms fade plus 8px translate.
- Allowed continuous motion: a 12px spinner on a running node/row, and a dashed-line flow on the single currently executing edge, 1px, blue.
- Newly streamed row: background flash `blue3` fading to transparent over 800ms. No other entrance animations.
- Honor `prefers-reduced-motion`: remove everything above except instant state changes.

## 5. References to study (copy structure, not branding)

If you can browse, open these and match their density and patterns. Do not copy logos or exact colors.

- **Linear** — list density, status icons that differ by shape (not only color), side peek panel, Cmd+K, keyboard shortcuts, restrained dark theme.
- **Stripe Dashboard** — Test/Live mode banner, payment detail page with event timeline and raw JSON, right-aligned tabular amounts, subtle badges.
- **Temporal Web UI** — workflow event history table, compact vs timeline toggle, pending activities list, payload viewer.
- **GitHub Actions run view** — job DAG with small status icons, log panel beside graph.
- **Vercel dashboard** — deployments list with status dots, mono hashes, logs viewer, Geist typography.
- **Ramp / Brex** — approvals inbox and spend-policy copy.
- **Inngest / Trigger.dev** — agent/job run pages with step timelines.

## 6. App shell

```
+---------+--------------------------------------------------------------+
| Sidebar | Top bar: breadcrumb ........ [Sandbox|Live] [Cmd+K] [avatar] |
| 232px   +--------------------------------------------------------------+
|         |  Page header (title, filters, primary action)                |
| Runs    |  --------------------------------------------------------   |
| Approv. |  Content                                                     |
| Agents  |                                                              |
| Policies|                                                              |
| Ledger  |                                                              |
| Audit   |                                                              |
+---------+--------------------------------------------------------------+
```

- Sidebar: workspace switcher at top, nav items 32px high with 16px lucide icons, Approvals shows a count badge when > 0. Collapsible to 56px icon rail. Border-right 1px.
- **Environment indicator is mandatory.** In Live mode show a small red-tinted "Live" pill in the top bar. In Sandbox show a full-width 28px banner under the top bar: "Sandbox. No real money moves." (amber fill). Never let the user wonder which environment they are in.
- Top bar 48px. Breadcrumbs left, search/Cmd+K trigger, environment pill, user menu.

## 7. Pages

### 7.1 Runs (home)

A data table, nothing else above it except a filter bar.

- Filter bar: status multi-select, agent, date range, amount range, free text. Saved views as tabs ("All", "Needs approval", "Failed").
- Columns: Status (icon + label), Run (title + mono ID in secondary text), Agent, Counterparty, Amount (right-aligned, tabular, with currency code), Started (relative, tooltip absolute), Duration, Environment.
- Row click opens the Run detail page. Space on a row opens a right-side peek panel with key facts.
- Live updates: new and changed rows flash per section 4. Virtualize at 100+ rows.
- Empty state: one sentence plus the action, e.g. "No runs yet. Run an agent from a test invoice." with a button.

### 7.2 Run detail

Header: status badge, title ("Pay invoice INV-20418"), amount, counterparty, environment, started time, run ID with copy button, actions (Cancel run, Retry from checkpoint) on the right.

Below the header, a **key facts strip** (single row, 4 to 5 items, separated by borders): Amount, Recipient, Policy result, Spend cap used, Duration. Plain text, 12px label above 14px value. This is not a stat-card grid.

Tabs: **Graph** (default), **Timeline**, **Checkpoints**, **Policy**, **Raw**.

**Graph tab** — split view:

- Left (about 65%): React Flow canvas (`@xyflow/react`), auto-laid-out left to right with dagre. Flat `slate1` background, no grid pattern. Controls bottom-left, minimap off.
- Right (about 35%, resizable): node inspector. Shows selected node's inputs, outputs, duration, tokens, and a JSON viewer. Default selection is the current or failed node.
- Node: 208x56, 1px `slate5` border, 6px radius, `slate2` fill. Left: 16px lucide icon by type (calculator = deterministic math, shield-check = grounding verifier, zap = tool call, user-check = approval, scale = policy gate). Middle: title 13px/500, subtitle 11px mono node type. Right: 14px status icon (spinner, check-circle, pause-circle, x-circle, dashed circle for pending).
- Node states: pending (text secondary, dashed border), running (border `blue9`), succeeded (border stays `slate5`, green check icon only), waiting (border `amber9`, pause icon), failed (border `red9`). No glow, no pulsing.
- Edges: 1px `slate7`. Completed edges stay `slate7`. Only the currently executing edge is blue with a slow dash flow.
- Selected node: 2px `blue9` outline.

**Timeline tab** — Temporal-style event history table: offset (+0.42s), event (e.g. "Node completed"), node, summary, duration. Expand a row to see the payload JSON. Toggle for "Compact". Auto-scroll with a "Jump to latest" button when the user scrolls up.

**Checkpoints tab** — list of checkpoints, each with a JSON diff against the previous one (added green, removed red, 12px mono, line numbers). "Retry from here" action.

**Policy tab** — table of policy rules evaluated: rule name, expression (mono), input value, result (passed / blocked / needs approval), evaluated at.

**Raw tab** — full run JSON in a read-only code viewer with copy and download.

### 7.3 Approval (inside Run detail, and in the Approvals inbox)

When a run is waiting, the Run detail page shows a **decision panel pinned at the top of the right column** (or a right sheet in the Approvals inbox). It is not a full-screen modal.

Contents, top to bottom:

1. Amber banner row: "Waiting for approval" plus why: "Amount exceeds the per-payment limit of $500.00".
2. **What will happen** (plain definition list): Pay `$1,250.00 USD` to `Northwind Logistics` via PayPal (`pp:NWL-8841-AQ`) from `Operating account ending 4417`. Scheduled: immediately after approval.
3. **Checks passed** list with green check icons: "3 of 3 line items match the invoice", "Total recomputed: $1,250.00", "Recipient is on the approved vendor list", "No duplicate payment found".
4. **Rule that triggered** shown as a mono expression: `amount_usd > max_budget_usd (1250.00 > 500.00)`.
5. Actions: **Reject** (secondary, opens a reason textarea) and **Approve $1,250.00** (primary). Approve opens a confirm dialog repeating amount and recipient with a final "Sign and release payment" button. After success, show the signed token (mono, copyable) in the timeline.
6. Separation of duties: if the current user started the run, disable Approve with the reason "You started this run. Another approver must sign."

Approvals inbox page: table of pending items, newest first, columns Amount, Counterparty, Rule triggered, Waiting for, Requested by. Right sheet shows the decision panel. Keyboard: `A` opens approve flow, `R` reject.

### 7.4 Agents and Agent Studio

Agents list is a table (name, version, last run, success rate, owner). Agent Studio:

- Split pane, resizable. Left: CodeMirror or Monaco editor with the agent definition (natural language and IR sections, tabs for each). Right: **compiler output** styled like VS Code's Problems panel: a list of diagnostics with severity icons (error, warning, info), message, location (click jumps to the line), plus a read-only graph preview below it.
- Diagnostics examples: "Node `reconcile` is unreachable", "Policy `max_budget_usd` is not set for tool `paypal.payout`".
- Bottom bar: validation status ("0 errors, 1 warning"), "Run in sandbox" (secondary), "Publish version" (primary, disabled while errors exist).

### 7.5 Policies, Ledger, Audit log

Tables with filters, same patterns as Runs. Audit log rows are append-only, each with actor, action, target, timestamp, and a hash column (mono, truncated, copy on click).

## 8. Core components

Build these first with shadcn/ui (Radix primitives) restyled to the tokens above. Delete every default shadcn shadow and large radius.

- `Button` (primary, secondary, ghost, destructive; 32px; icon-only variant)
- `StatusBadge` (icon + label; fill token; used in tables and headers)
- `DataTable` (TanStack Table + virtualization, sticky header, column resize, row hover `slate3`)
- `KeyFacts` strip
- `Sheet` (right side), `Dialog`, `Popover`, `DropdownMenu`, `Tooltip` (delay 400ms)
- `CommandPalette` (cmdk): search runs by ID, jump to pages, run actions
- `JsonViewer` (collapsible, 12px mono, copy per node)
- `DiffViewer` for checkpoints
- `Money` component: takes cents + currency, renders `$1,250.00` plus `USD` in secondary text, tabular, right-aligned in tables. Never format amounts inline elsewhere.
- `EnvPill` and `SandboxBanner`
- `Toast` (bottom-right, 4s, with action)

## 9. Content and copy rules

- Use plain labels. Show the enum only as secondary mono text. Example: label "Waiting for approval", secondary `PAUSED_FOR_APPROVAL`.
- Buttons say exactly what happens: "Approve $1,250.00", "Retry from checkpoint", not "Submit" or "Continue".
- Errors state what failed and how to fix it: "PayPal rejected the payout: recipient account is not verified. Ask the vendor to confirm their PayPal email, then retry from the Disburse step." No apologies, no vague messages.
- Money always shows currency and two decimals (or the currency's native exponent). Negative amounts use a minus sign, not color alone.
- Dates: relative in lists ("3m ago"), absolute with timezone in tooltips and detail pages (`2026-11-11 14:02:07 UTC`).
- No marketing language anywhere.

## 10. Mock data and realtime

Seed a realistic dataset so the UI looks real from the first render:

- 40 runs across 5 agents (payables-reconciler, vendor-onboarding, refund-processor, payroll-checker, expense-auditor). Mix: 70% succeeded, 10% running, 8% waiting for approval, 8% failed, 4% rejected.
- Realistic vendors, invoice IDs (`INV-20418`), amounts from `$38.20` to `$48,900.00`, failure reasons (duplicate idempotency key, recipient unverified, policy block, circuit breaker open).
- A mock event stream (SSE or WebSocket abstraction) that emits node start/complete events so the Run detail graph and timeline update live. Keep it behind an interface so the real gRPC gateway can replace it later.

## 11. Accessibility and quality floor

- Contrast AA minimum on all text, including secondary text on `slate2`.
- Visible 2px `blue9` focus ring with 2px offset on every interactive element.
- Status never conveyed by color alone.
- Full keyboard navigation: `Cmd+K` palette, `j/k` list nav, `Enter` open, `Esc` close, `?` shows shortcuts, `g r` goes to Runs, `g a` goes to Approvals.
- Responsive: desktop first, usable down to 768px (sidebar collapses to icon rail, inspector becomes a bottom sheet). Mobile phone layout is limited to the Approvals inbox and decision panel.
- Tables never cause body horizontal scroll; the table container scrolls.

## 12. Suggested stack

Next.js (App Router) + TypeScript, Tailwind with CSS variables for tokens, shadcn/ui, `@radix-ui/colors`, `geist`, `lucide-react`, `@xyflow/react` + `dagre`, `@tanstack/react-table` + `@tanstack/react-virtual`, `cmdk`, CodeMirror 6, Zustand for stream state. Adapt if the existing codebase differs, but keep the tokens and component rules.

## 13. Build order

1. Tokens (CSS variables), fonts, theme provider, base `Button`, `StatusBadge`, `Money`.
2. App shell: sidebar, top bar, env pill, sandbox banner, Cmd+K.
3. Runs table with seeded data and live updates.
4. Run detail: header, key facts, Timeline tab, then Graph tab with React Flow and inspector.
5. Decision panel and approval flow.
6. Approvals inbox.
7. Agent Studio.
8. Policies, Ledger, Audit log.
9. Light theme and responsive pass.

## 14. Acceptance checklist (check before calling any page done)

- [ ] Take a screenshot. Could it pass as a screenshot from Linear, Stripe or Temporal? If it looks like a landing page or a game HUD, redo it.
- [ ] Zero items from the hard bans list (section 3) are present.
- [ ] Color appears only on status indicators and the primary action. Squint test: the page reads as grayscale with a few small colored marks.
- [ ] Every amount uses `Money`, is right-aligned in tables and shows currency.
- [ ] Environment (Sandbox or Live) is visible on every screen.
- [ ] Mono font appears only on IDs, hashes, JSON, logs and code.
- [ ] Nothing moves unless state changed.
- [ ] Keyboard-only path exists for the page's main task.
- [ ] Data looks real: varied amounts, believable names, at least one failed and one waiting item.