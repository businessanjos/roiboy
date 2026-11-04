# AGENTS.md — src/components/royzapp

- Internal team numbers (registered in `zapp_internal_contacts` plus collaborator phones, compared through `zappPhoneCore`) are not client service: `ZappConversationItem` hides the wait badges and `ZappChatHeader` shows "Interno" instead of a client-waiting status. Why: `zapp_productivity_metrics` already drops those numbers, so the UI must not present a colleague as a client waiting.
