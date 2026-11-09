# AGENTS.md — src/components/csProcesses

- CS process steps render one at a time from typed actions derived by `toStepInfo` (src/lib/csProcessActions.ts) over the unchanged markdown format. Why: clearer reading without changing the text managers edit.
- The "Em andamento" tab is a read-only board built by `useCsInProgress` from existing fields: onboarding step comes from the client's Onboarding Hub stage via `stepOfStage` (unmapped stages show as "Sem fase definida") and event steps from the event date via the shared offsets in `src/lib/csToday.ts`. Why: Processos is the team's map; work happens in the existing CS areas, so nothing is invented or counted here.
- Example links in process texts are swapped per client by `resolveProcessLink` (src/lib/csClientLinks.ts); the markdown keeps the example URLs. Why: managers keep editing one text while each client gets her own links.
- Managers edit one step at a time (StepEditDialog via hover pencil in StepNavigator); saving re-serializes all processes with `serializeProcesses` into `cs_process_content`, never exposing the raw source document. Why: editors change messages, not the source prompt.
- "Em andamento" shows all consultants only to management or users with override `cs`/`processos_ver_todas` (granted in SeeAllAccessDialog); page opens on "Processos". Why: consultants see their own clients unless a manager grants more.
