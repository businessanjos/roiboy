# Notification monitoring review

## User-facing rule
Notification buttons must open their destination or dismiss the pop-up; transfer alerts must reach RoyZapp without a missing-page error. Existing access checks and previously sent records remain unchanged.

## Confirmed findings
- **9211a1a2-46be-58c8-ba9a-fc42e722a47e:** reproduced WhatsApp button hit-testing failure in the running app. The current generic/task system pop-ups already restore pointer events, contrary to the report's claim that every custom toast ignores clicks. Both generic system and WhatsApp pop-ups also exceeded the existing Sonner width, putting close buttons outside the screen. Custom toasts now regain pointer events centrally via Sonner's `data-styled=false`; their content uses the available width. Ordinary toast surfaces and empty toaster space still pass clicks through; built-in action/cancel/close slots retain their overrides.
- **a416f501-5799-517c-a99e-9983d02f4fd9:** reproduced `/royzapp` → 404. Read the current Cloud function definitions: both accepted and rejected outcomes still generate this link. Added an exact compatibility redirect to `/roy-zapp?sector=vendas`, preserving conversation/integration parameters and replacing history. The canonical page retains its existing authentication, subscription, sector/profile and conversation checks. No function or notification record was modified.

## Sibling paths read now
| Place | Code read | Result |
| --- | --- | --- |
| Shared Sonner host, ordinary actions/cancel/close | `src/components/ui/sonner.tsx`, installed Sonner CSS | Ordinary click-through preserved; custom hit-testing fixed centrally. |
| WhatsApp foreground toast | `useZappNotifications.tsx`, `ZappNotificationToast.tsx` | Open/dismiss callbacks already correct; pointer inheritance and fixed content width corrected. |
| Generic system foreground toast | `useNotifications.tsx`, `GlobalNotificationToast.tsx` | Pointer override already correct; content width corrected to make close reachable. |
| Marketing assignment/comment foreground toasts | Same `GlobalNotificationToast.tsx` task branch | Existing full-width/pointer override correct; browser open/close passed. |
| Notification history | `src/pages/Notifications.tsx` | Navigates stored links after marking read; compatibility route handles legacy links without record rewrites. |
| Desktop/mobile bell | `GlobalHeader.tsx`, `MobileAppHeader.tsx` notification handlers | Both correctly open `/notifications`; unchanged. |
| Browser system notification fallback | `useNotifications.tsx` `showBrowserNotification` | Loads stored link; legacy route now resolves. |
| WhatsApp background browser notification | `useZappNotifications.tsx` `showSystemNotification` | Uses existing `onViewChat(conversationId)`; no missing route. |
| Actual conversation selection and URL lookup | `RoyZapp.tsx` `handleNotificationViewChat` and conversation-param effect | Existing agent checks, mobile history and user-scoped lookup unchanged. |
| App routing and dashboard/TV notice suppression | `App.tsx`, `AppLayout.tsx` authentication/sector/profile checks | Legacy alias redirects before guarded canonical route; dashboard/TV suppression unchanged. |
| Legacy Radix toast implementation | `src/components/ui/toast.tsx` | Toast roots use pointer-events-auto; unaffected. |
| App transfer decision | `ZappTransferDecision.tsx`, deployed `decide_zapp_transfer` | Both decisions call shared core; no changes to decisions/access. |
| WhatsApp button decision | `uazapi-webhook/index.ts` ztr branch, deployed `decide_zapp_transfer_by_phone` | Both decisions call shared core; no changes. |
| Shared transfer notice insertion | Migration 0075 and deployed `decide_zapp_transfer_core` read-only | Uses `/royzapp`; compatibility route now handles future and existing alerts without rewriting settled decisions/messages. |
| Queue-pull notices | Migration 0077 and deployed `notify_zapp_queue_pull` read-only | Already uses `/roy-zapp?sector=vendas`; unchanged. |
| WhatsApp transfer notifications | `zapp-transfer-whatsapp/index.ts` | Manager links use `/transferencia-conversa/:id`; seller decisions are text-only. Neither uses missing `/royzapp` links. |
| New-message push producer | `uazapi-webhook/index.ts` push destination | Uses canonical `/roy-zapp?conversation=...`; unchanged. |
| Push sender | `send-push/index.ts` payload forwarding | Forwards caller URL; app compatibility route handles legacy transfer destinations. Preferences/delivery unchanged. |
| Push service worker | Registration in `useNotifications.tsx`; `/sw.js` absent from current checkout and local server | Handler implementation cannot be verified here. No service-worker changes or claim of device push verification. |

Only two `toast.custom` producers exist in `src`; both were read. The only application URL literal `/royzapp` found outside the new alias/test is the shared transfer core's notification insertion.

## Verification
- Browser reproduction before edits: WhatsApp `pointer-events:none` and click timeout; generic system `pointer-events:auto` and working open callback; close outside screen; legacy link 404.
- `python3 scripts/qa/notification-popups.py`: original components mounted through the running app's real toaster, with local TESTE QA callbacks only. WhatsApp, generic and task open/close passed at 803×674, 390×844 and 1440×900. Buttons stayed within viewport and clicks read back callback state. Ordinary action and surface click-through passed. Legacy link reached canonical destination behind existing sign-in guard, not 404.
- 34 tests passed across App routes, delivery/deduplication, read reconciliation, dashboard suppression, mobile chat history and pull-approval behavior.
- Preview compilation log: build OK. No backend edits, notification inserts, decisions, real record updates, sends, permissions changes or publication.
- Authenticated end-to-end notification-to-conversation testing remains unavailable: own-session command found no matching account and temporary-test-user command failed. Isolated original-component browser checks and route tests do not verify a real seller session or device push delivery.

## Architecture
The compatibility alias stays in the existing App router and reuses the existing query-preserving redirect. Custom toast hit-testing stays in the shared Sonner host. Root AGENTS.md has only 13 bytes available and contains user-authored rules, so no rules were rewritten to make room.