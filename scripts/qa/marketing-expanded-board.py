"""Read-only layout regression for the production Marketing kanban.

Uses local TESTE QA fixtures and a stub current-user context; never writes tasks.
Run: python3 scripts/qa/marketing-expanded-board.py
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("/tmp/browser/marketing-expanded")
OUT.mkdir(parents=True, exist_ok=True)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1562, "height": 768})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        async def identity(route):
            await route.fulfill(content_type="application/javascript", body="export const CurrentUserProvider=({children})=>children;export const useCurrentUser=()=>({currentUser:window.qaUser??null,loading:false});")

        await page.route("**/src/hooks/useCurrentUser.tsx*", identity)
        await page.goto("http://localhost:8080/auth", wait_until="domcontentloaded")
        await page.evaluate("""async () => {
          const React=await import('/node_modules/.vite/deps/react.js');
          const {createRoot}=await import('/node_modules/.vite/deps/react-dom_client.js');
          const {MarketingTaskKanban}=await import('/src/components/marketing/tasks/MarketingTaskKanban.tsx');
          const {Button}=await import('/src/components/ui/button.tsx');
          const host=document.createElement('div');host.id='qa-expanded';host.className='fixed inset-0 z-[9999] overflow-hidden bg-background p-5 text-foreground';document.body.append(host);
          const root=createRoot(host);window.qaEdits=[];window.qaUser={id:'qa-person',account_id:'qa-account'};
          const columns=['A Fazer','Fazendo','Revisão','Concluído'].map((title,i)=>({id:'column-'+i,title,is_done:i===3,color:'var(--primary)',display_order:i}));
          const tasks=Array.from({length:16},(_,i)=>({id:'qa-'+i,account_id:'qa-account',column_id:'column-'+(i<13?0:i-12),title:'TESTE QA '+i,assignee_id:'qa-person',assignee:{id:'qa-person',name:'TESTE QA',avatar_url:null},priority:'medium',status:'pending',is_completed:false,due_date:null,tags:[],custom_fields:{}}));
          window.qaFixture=tasks;
          const noWrite=()=>{throw Error('Test must not write tasks');};
          function App(){const [expanded,setExpanded]=React.useState(false);return React.createElement('div',{className:'flex h-full min-h-0 flex-col gap-3'},React.createElement(Button,{onClick:()=>setExpanded(!expanded),className:'self-end'},expanded?'Reduzir quadro':'Expandir quadro em tela cheia'),React.createElement(MarketingTaskKanban,{fullHeight:expanded,columns,tasks,separators:[],subtaskCounts:{},onEditTask:id=>window.qaEdits.push(id),onToggleComplete:noWrite,onColumnChange:noWrite,onAddTask:noWrite,onAddSeparator:noWrite,onEditSeparator:noWrite,onMoveSeparator:noWrite}));}
          root.render(React.createElement(App));
        }""")
        await page.get_by_role("button", name="Expandir quadro em tela cheia", exact=True).wait_for()

        async def measure():
            return await page.evaluate("""() => {
              const cols=[...document.querySelectorAll('#qa-expanded h3')].map(h=>h.parentElement.parentElement.parentElement);
              const board=cols[0].parentElement;
              const b=board.getBoundingClientRect();
              return {width:b.width,client:board.clientWidth,scroll:board.scrollWidth,
                widths:cols.map(c=>c.getBoundingClientRect().width),
                left:cols[0].getBoundingClientRect().left-b.left,
                right:b.right-cols.at(-1).getBoundingClientRect().right};
            }""")

        normal = await measure()
        assert all(w <= 350.5 for w in normal["widths"]), normal
        await page.get_by_role("button", name="Expandir quadro em tela cheia", exact=True).click()
        for width, height in [(1562, 768), (1920, 1080), (1440, 900), (803, 674), (390, 844)]:
            await page.set_viewport_size({"width": width, "height": height})
            await page.get_by_role("button", name="Reduzir quadro", exact=True).screenshot(path=str(OUT / f"control-{width}.png"))
            m = await measure()
            assert max(m["widths"]) - min(m["widths"]) < 1, m
            assert min(m["widths"]) >= 299.5, m
            if width >= 1440:
                assert abs(m["left"]) < 1 and abs(m["right"]) < 1, m
                assert m["scroll"] <= m["client"] + 1, m
            else:
                assert m["scroll"] > m["client"], m
            assert await page.evaluate("document.documentElement.scrollWidth <= innerWidth"), m
            await page.locator("#qa-expanded").screenshot(path=str(OUT / f"expanded-{width}.png"))
            print("PASS expanded", width, m)
        await page.set_viewport_size({"width":1562,"height":768})
        await page.get_by_text("TESTE QA 1", exact=True).click()
        assert await page.evaluate("window.qaEdits") == ["qa-1"]
        await page.get_by_role("button", name="Reduzir quadro", exact=True).click()
        await page.get_by_role("button", name="Expandir quadro em tela cheia", exact=True).wait_for()
        restored = await measure()
        assert restored["widths"] == normal["widths"], (normal, restored)
        assert await page.evaluate("window.qaFixture.length") == 16
        assert not errors, errors
        print("PASS reducing restores original widths; edit action preserved; no runtime errors or task writes")
        await browser.close()


asyncio.run(main())