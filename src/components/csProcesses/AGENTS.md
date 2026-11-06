# AGENTS.md — src/components/csProcesses

- CS process steps render one at a time from typed actions derived by `toStepInfo` (src/lib/csProcessActions.ts) over the unchanged markdown format. Why: clearer reading without changing the text managers edit.
- The "Hoje" tab is computed client-side by `useCsTodayTasks` from pure rules in `src/lib/csToday.ts`; only Concluir/Adiar persist (`cs_today_task_states` by task key) and client waits live in `cs_process_waits` (alert days per step in `cs_process_wait_settings`). Why: deadlines follow the source data without scheduled jobs, and the sidebar counter uses the same hook.
- Example links in process texts are swapped per client by `resolveProcessLink` (src/lib/csClientLinks.ts); the markdown keeps the example URLs. Why: managers keep editing one text while each client gets her own links.
- Managers edit one step at a time (StepEditDialog via hover pencil in StepNavigator); saving re-serializes all processes with `serializeProcesses` into `cs_process_content`, never exposing the raw source document. Why: editors change messages, not the source prompt.
