"""Production task UI/hooks with local TESTE QA responses, never real task writes.

Run: python3 scripts/qa/marketing-bulk-actions.py
Authenticated read/write verification is separate when an app session is available.
"""
import asyncio
import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

OUT = Path("/tmp/browser/marketing-bulk")
OUT.mkdir(parents=True, exist_ok=True)
ACCOUNT = "00000000-0000-4000-8000-000000000001"
USER = "00000000-0000-4000-8000-000000000002"
COLUMNS = [dict(id=f"10000000-0000-4000-8000-{i+1:012d}", account_id=ACCOUNT,
                title=title, color="var(--primary)", display_order=i, is_done=i == 3)
           for i, title in enumerate(["A Fazer", "Fazendo", "Revisão", "Concluído"])]


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        errors, writes = [], []
        page.on("pageerror", lambda error: errors.append(str(error)))
        rows = [dict(id=f"20000000-0000-4000-8000-{i+1:012d}", account_id=ACCOUNT, section_id=None,
                     column_id=COLUMNS[0]["id"], title=f"TESTE QA {i+1}", description="Preservar descrição",
                     assignee_id=USER, assignee=dict(id=USER, name="TESTE QA", avatar_url=None), due_date=None,
                     priority="medium", status="pending", tags=[], custom_fields={}, media_attachments=[],
                     display_order=i, is_completed=False, completed_at=None, created_by=USER,
                     updated_at="2026-11-25T00:00:00.000Z", created_at="2026-11-25T00:00:00.000Z") for i in range(3)]
        version = 0

        async def identity(route):
            await route.fulfill(content_type="application/javascript", body=f"export const CurrentUserProvider=({{children}})=>children; export const useCurrentUser=()=>({{currentUser:{{id:'{USER}',account_id:'{ACCOUNT}',name:'TESTE QA'}},loading:false}});")

        async def team(route):
            await route.fulfill(content_type="application/javascript", body="export const useMarketingTeamUsers=()=>({data:[]});")

        async def local_client(route):
            await route.fulfill(content_type="application/javascript", body="""
              function from(table) {
                let method='GET', patch=null, one=false;const params=new URLSearchParams();
                const query={select:()=>query,order:()=>query,eq:(k,v)=>{params.set(k,'eq.'+v);return query},
                  in:()=>query,range:(start,end)=>{params.set('qa_start',start);params.set('qa_end',end);return query},update:data=>{method='PATCH';patch=data;return query},
                  single:()=>{one=true;return query},maybeSingle:()=>{one=true;return query},
                  then:(resolve,reject)=>fetch('/qa-rest/'+table+'?'+params,{method,headers:{'Content-Type':'application/json','Accept':one?'application/vnd.pgrst.object+json':'application/json'},...(patch?{body:JSON.stringify(patch)}:{})})
                    .then(r=>r.json()).then(data=>({data,error:null})).then(resolve,reject)};
                return query;
              }
              export const supabase={from,auth:{getSession:async()=>({data:{session:null},error:null}),getUser:async()=>({data:{user:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
                channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}};
            """)

        async def api(route):
            nonlocal version
            request = route.request
            parsed = urlparse(request.url)
            table = parsed.path.rsplit("/", 1)[-1]
            params = parse_qs(parsed.query)
            data = rows if table == "marketing_tasks" else COLUMNS if table == "marketing_task_columns" else []
            if table == "marketing_tasks":
                for key in ["id", "account_id", "updated_at"]:
                    if key in params:
                        value = params[key][0].removeprefix("eq.")
                        data = [row for row in data if row.get(key) == value]
            if "qa_start" in params:
                data = data[int(params["qa_start"][0]):int(params["qa_end"][0]) + 1]
            if request.method not in ["GET", "HEAD"]:
                assert request.method == "PATCH" and table == "marketing_tasks", (request.method, table)
                assert params.get("account_id") == ["eq." + ACCOUNT], params
                assert "id" in params and "updated_at" in params, params
                patch = request.post_data_json
                writes.append({"ids": [row["id"] for row in data], "patch": patch, "filters": params})
                for row in data:
                    assert row["title"].startswith("TESTE QA"), "Must never update real tasks"
                    version += 1
                    row.update(patch)
                    row["updated_at"] = f"2026-11-25T00:00:{version:02d}.000Z"
            payload = data[0] if "vnd.pgrst.object" in request.headers.get("accept", "") and data else data
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(payload))

        await page.route("**/src/hooks/useCurrentUser.tsx*", identity)
        await page.route("**/src/hooks/useMarketingTeamUsers.ts*", team)
        await page.route("**/src/integrations/supabase/client.ts*", local_client)
        await page.route("**/qa-rest/**", api)
        await page.route("**/rest/v1/**", api)
        await page.goto("http://localhost:8080/auth", wait_until="domcontentloaded")
        await page.evaluate("""async () => {
          const tabSource=await (await fetch('/src/components/marketing/tasks/MarketingTasksTab.tsx')).text();
          const mainSource=await (await fetch('/src/main.tsx')).text();
          const hookSource=await (await fetch('/src/hooks/useMarketingTasks.ts')).text();
          const modulePath=(source,name)=>source.match(new RegExp('from "([^"\\n]*'+name+'[^"\\n]*)"'))[1];
          const React=await import(modulePath(tabSource,'react__oj_named'));
          const {createRoot}=await import(modulePath(mainSource,'react-dom_client'));
          const {MemoryRouter}=await import(modulePath(tabSource,'react-router-dom'));
          const {QueryClient,QueryClientProvider}=await import(modulePath(hookSource,'tanstack_react-query'));
          const {TooltipProvider}=await import('/src/components/ui/tooltip.tsx');
          const {MarketingTasksTab}=await import('/src/components/marketing/tasks/MarketingTasksTab.tsx');
          const host=document.createElement('div');host.id='qa-tasks';host.className='fixed inset-0 z-10 overflow-y-auto bg-background p-4 text-foreground';document.body.append(host);
          const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
          window.qaClient=client;
          createRoot(host).render(React.createElement(MemoryRouter,{},React.createElement(QueryClientProvider,{client},React.createElement(TooltipProvider,{},React.createElement(MarketingTasksTab)))));
        }""")
        region = page.get_by_role("region", name="Quadro de tarefas de Marketing")
        try:
            await region.get_by_text("TESTE QA 1", exact=True).wait_for()
        except Exception:
            print("QA mount errors:", errors)
            print("QA mount content:", await page.locator("#qa-tasks").inner_text())
            print("QA query status:", await page.evaluate("() => window.qaClient.getQueryCache().getAll().map(q=>({key:q.queryKey,status:q.state.status,fetch:q.state.fetchStatus,error:q.state.error?.message}))"))
            await page.screenshot(path=str(OUT / "mount-failed.png"))
            raise
        await region.get_by_role("button", name="Mais opções do quadro").click()
        await page.get_by_role("menuitem", name="Selecionar tarefas", exact=True).click()
        await region.get_by_role("checkbox", name="Selecionar tarefa TESTE QA 1", exact=True).click()
        await region.get_by_role("checkbox", name="Selecionar tarefa TESTE QA 2", exact=True).click()
        assert writes == [], "Selection must not mutate tasks"
        await region.screenshot(path=str(OUT / "desktop-selected.png"))

        async def move_to(title):
            await region.get_by_role("button", name="Mover", exact=True).click()
            await page.get_by_role("menuitem", name=title, exact=True).click()
            dialog = page.get_by_role("alertdialog")
            await dialog.screenshot(path=str(OUT / "move-confirmation.png"))
            await dialog.get_by_role("button", name="Confirmar", exact=True).click()
            await dialog.wait_for(state="hidden")

        await move_to("Revisão")
        review = region.get_by_role("heading", name="Revisão", exact=True).locator("../../..")
        await review.get_by_text("TESTE QA 1", exact=True).wait_for()
        await review.get_by_text("TESTE QA 2", exact=True).wait_for()
        assert rows[2]["column_id"] == COLUMNS[0]["id"]
        await region.screenshot(path=str(OUT / "desktop-moved.png"))
        await region.get_by_role("button", name="Desfazer última alteração", exact=True).click()
        first = region.get_by_role("heading", name="A Fazer", exact=True).locator("../../..")
        await first.get_by_text("TESTE QA 1", exact=True).wait_for()
        await first.get_by_text("TESTE QA 2", exact=True).wait_for()
        assert all(row["column_id"] == COLUMNS[0]["id"] for row in rows)
        await region.screenshot(path=str(OUT / "desktop-undone.png"))

        await region.get_by_role("checkbox", name="Selecionar tarefas de A Fazer", exact=True).click()
        await region.get_by_role("button", name="Concluir", exact=True).click()
        await page.get_by_role("alertdialog").get_by_role("button", name="Confirmar", exact=True).click()
        await page.get_by_role("alertdialog").wait_for(state="hidden")
        assert all(row["is_completed"] and row["status"] == "done" for row in rows)
        await region.get_by_role("button", name="Desfazer última alteração", exact=True).click()
        await first.get_by_text("TESTE QA 3", exact=True).wait_for()
        assert all(row["completed_at"] is None and not row["is_completed"] for row in rows)

        await region.get_by_role("checkbox", name="Selecionar todas as tarefas filtradas", exact=True).click()
        await region.get_by_role("button", name="Visualizar lista", exact=True).click()
        assert await region.get_by_role("checkbox", name="Selecionar tarefa TESTE QA 1", exact=True).is_checked()
        await region.get_by_role("button", name="Mais ações", exact=True).click()
        await page.get_by_role("menuitem", name="Prioridade alta", exact=True).click()
        await page.get_by_role("alertdialog").get_by_role("button", name="Confirmar", exact=True).click()
        await page.get_by_role("alertdialog").wait_for(state="hidden")
        assert all(row["priority"] == "high" for row in rows)
        await region.get_by_role("button", name="Desfazer última alteração", exact=True).click()
        await region.get_by_role("button", name="Desfazer última alteração", exact=True).wait_for(state="hidden")
        assert all(row["priority"] == "medium" for row in rows)
        await region.screenshot(path=str(OUT / "list-undone.png"))

        await region.get_by_role("button", name="Visualizar quadro", exact=True).click()
        await region.get_by_role("checkbox", name="Selecionar tarefa TESTE QA 1", exact=True).click()
        for width, height in [(803, 674), (390, 844), (1440, 900)]:
            await page.set_viewport_size({"width": width, "height": height})
            for dark in [False, True]:
                await page.evaluate("dark => document.documentElement.classList.toggle('dark', dark)", dark)
                assert await page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                await region.screenshot(path=str(OUT / f"selected-{width}-{'dark' if dark else 'light'}.png"))
                await region.get_by_role("button", name="Expandir quadro em tela cheia", exact=True).click()
                await region.get_by_role("button", name="Reduzir quadro", exact=True).wait_for()
                assert await region.get_by_role("checkbox", name="Selecionar tarefa TESTE QA 1", exact=True).is_checked()
                await page.screenshot(path=str(OUT / f"expanded-{width}-{'dark' if dark else 'light'}.png"))
                await region.get_by_role("button", name="Reduzir quadro", exact=True).click()
        assert not errors, errors
        assert all(row["description"] == "Preservar descrição" and row["assignee_id"] == USER for row in rows)
        print("PASS production task UI: select 2, move, undo, complete all, undo, list priority, undo; 390/803/1440 light/dark and expansion. No runtime errors, only local TESTE QA writes:", len(writes))
        await browser.close()


asyncio.run(main())