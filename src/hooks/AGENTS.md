# AGENTS.md — src/hooks

- Notification INSERTs delivered late (tab asleep, browser back, realtime reconnect) only refresh the bell once; sound/toast/push fire only for fresh events, at most one per 1.2s. Why: a backlog flush used to interrupt for every event and froze the screen.
