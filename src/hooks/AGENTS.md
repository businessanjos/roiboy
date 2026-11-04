# AGENTS.md — src/hooks

- Notification INSERTs delivered late (tab asleep, browser back, realtime reconnect) only refresh the bell once; sound/toast/push fire only for fresh events, at most one per 1.2s. Why: a backlog flush used to interrupt for every event and froze the screen.
- RoyZapp tag badges update live: `zapp_conversation_tags` and `zapp_tags` are in the `supabase_realtime` publication and `useZappConversations` patches `assignments.conversation_tags` from those events. Why: the badge next to the name must change without reloading the screen.

- RoyZapp media uploads retry transient storage failures through `withZappRetry` (src/lib/zappTransientErrors.ts) and treat "already exists" as success; WhatsApp send calls are not auto-retried, and errors shown to the team go through `friendlyZappError`. Why: a storage 504 must not surface raw "Unexpected token <" text, and retrying the send itself could deliver twice.
