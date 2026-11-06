# AGENTS.md — src/components/dashboard

- Clickable dashboard metric cards open their client list through `ClientListDialog` (src/components/dashboard/ClientListDialog.tsx), which owns the search box, the reset-on-open behavior, and a secondary label that hides itself when every row shares the same value. Why: one dialog shape for "who are these clients" lists instead of a new modal per card, with no redundant column.
