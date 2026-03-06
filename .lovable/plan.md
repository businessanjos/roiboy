

## Fix: Shared Dashboard Visuals Not Loading

### Root Cause
The `shared-dashboard` Edge Function is **not listed in `supabase/config.toml`**, so `verify_jwt` defaults to `true`. The Supabase API gateway rejects requests from unauthenticated visitors (the shared link) before the function code ever executes. The frontend's `callEdge` sends only an `apikey` header, not an `Authorization: Bearer` JWT, so the gateway returns a 401.

The initial token-only call (`?token=X`, no email) may succeed intermittently depending on caching or gateway behavior, showing the dashboard name and "approved" state. But the full data call fails silently — `res.json()` on a 401 returns `{"msg":"Invalid JWT"}`, which has no `status === "approved"` match, so visuals never get populated.

### Fix
Add `shared-dashboard` to `config.toml` with `verify_jwt = false`, then redeploy the function.

**File: `supabase/config.toml`** — append:
```toml
[functions.shared-dashboard]
verify_jwt = false
```

**Deployment**: Redeploy the `shared-dashboard` Edge Function.

### Why This Regressed
The `config.toml` is auto-managed. A recent regeneration or edit may have dropped the entry if it was previously present, or it was never added — meaning the function only worked when called with authenticated sessions (e.g., when the owner tested from within the app).

