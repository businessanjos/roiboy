"""Read-only browser regression: original notification components, no account writes.

Run against the running Vite app: python3 scripts/qa/notification-popups.py
Screenshots stay under /tmp/browser/notifications; no messages or decisions are sent.
"""
import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

OUTPUT = Path("/tmp/browser/notifications")
OUTPUT.mkdir(parents=True, exist_ok=True)

SETUP = """async () => {
  const React = await import('/node_modules/.vite/deps/react.js');
  const {toast} = await import('/src/components/ui/sonner.tsx');
  const {ZappNotificationToast} = await import('/src/components/royzapp/ZappNotificationToast.tsx');
  const {GlobalNotificationToast} = await import('/src/components/notifications/GlobalNotificationToast.tsx');
  window.qaClicks = [];
  window.qaShow = kind => toast.custom(t => React.createElement(
    kind === 'zapp' ? ZappNotificationToast : GlobalNotificationToast,
    kind === 'zapp' ? {
      contactName:'TESTE QA', messagePreview:'Notification click check', origin:'mine',
      onViewChat:()=>{window.qaClicks.push('open');toast.dismiss(t);},
      onDismiss:()=>{window.qaClicks.push('close');toast.dismiss(t);}
    } : {
      title:'TESTE QA', content:'TESTE QA task\\nNotification click check', hasLink:true,
      sourceType:kind === 'task' ? 'marketing_task_comment' : undefined,
      actorName:kind === 'task' ? 'TESTE QA' : undefined,
      onOpen:()=>{window.qaClicks.push('open');toast.dismiss(t);},
      onDismiss:()=>{window.qaClicks.push('close');toast.dismiss(t);}
    }), {duration:Infinity,position:'top-right'});
  window.qaOrdinary = () => toast('TESTE QA ordinary', {
    duration:Infinity, position:'top-right', closeButton:true,
    action:{label:'TESTE QA action',onClick:()=>window.qaClicks.push('action')}
  });
}
"""


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for width, height in [(803, 674), (390, 844), (1440, 900)]:
            page = await browser.new_page(viewport={"width": width, "height": height})
            await page.goto("http://localhost:8080/auth", wait_until="networkidle")
            await page.evaluate(SETUP)
            for kind in ["zapp", "global", "task"]:
                for action in ["open", "close"]:
                    await page.evaluate("kind => window.qaShow(kind)", kind)
                    name = ({"zapp": "Ver chat", "global": "Abrir", "task": "Abrir tarefa"}[kind]
                            if action == "open" else "Fechar" if kind == "global" else "Fechar aviso")
                    toast = page.locator('[data-sonner-toast][data-removed="false"]')
                    button = toast.get_by_role("button", name=name, exact=True)
                    await button.wait_for()
                    await toast.screenshot(path=str(OUTPUT / f"{width}-{kind}-{action}.png"))
                    box = await button.bounding_box()
                    assert box is not None
                    assert 0 <= box["x"] and box["x"] + box["width"] <= width, (kind, action, box)
                    assert 0 <= box["y"] and box["y"] + box["height"] <= height, (kind, action, box)
                    await button.click(timeout=2500)
                    assert await page.evaluate("window.qaClicks.at(-1)") == action
                    await page.locator('[data-sonner-toast]').wait_for(state="detached")
                    print(f"PASS {width}: {kind} {action}")
            await page.evaluate("window.qaOrdinary()")
            ordinary = page.get_by_text("TESTE QA ordinary", exact=True)
            await ordinary.wait_for()
            assert await ordinary.evaluate("e => getComputedStyle(e).pointerEvents") == "none"
            await page.get_by_role("button", name="TESTE QA action", exact=True).click(timeout=2500)
            assert await page.evaluate("window.qaClicks.at(-1)") == "action"
            print(f"PASS {width}: ordinary action and click-through preserved")
            await page.close()
        page = await browser.new_page()
        await page.goto("http://localhost:8080/royzapp?conversation=qa-chat", wait_until="networkidle")
        assert "/auth?next=" in page.url and "%2Froy-zapp" in page.url, page.url
        assert await page.get_by_text("404", exact=True).count() == 0
        await page.screenshot(path=str(OUTPUT / "legacy-sign-in-guard.png"))
        print("PASS legacy link: canonical destination retained behind existing sign-in guard")
        await browser.close()


asyncio.run(main())