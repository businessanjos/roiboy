# AGENTS.md — src/lib

- Team numbers are never clients: `public.internal_client_ids(p_account_id)` (SECURITY INVOKER over `zapp_internal_contacts` + `hr_collaborators` phone cores) drives exclusion in the `list-clients` edge function, global search, finance client badge and MCP counts; `src/lib/internalClients.ts` + `useInternalClientIds` are the app-side path and `isInternalClientRecord` in `src/lib/zappInternalContacts.ts` covers client records. Why: a colleague's number registered as a client must not be listed, counted or exported as a client anywhere.
