"""Read-only authenticated chart and TV regression.

Run lovable auth-session --json --self, then python3 scripts/qa/insights-chart-tv.py.
Requires the existing dev server; does not change saved dashboards or records.
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from lovable_playwright_defaults import signed_in_context

OUT = Path('/tmp/browser/insights-chart-tv')
URL = 'http://localhost:8080/insights/05fe3fc0-139f-4de2-b46c-da526bcd022a?setor=vendas&periodo=este_mes'


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await signed_in_context(browser)
        page = await context.new_page()
        page.set_default_timeout(45000)
        errors, writes = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: writes.append(request.method)
                if '/rest/v1/' in request.url and '/rpc/' not in request.url
                and request.method not in ['GET', 'HEAD', 'OPTIONS'] else None)
        # Keep the requested CSS viewport instead of Chromium's headless fullscreen size.
        await page.add_init_script('HTMLElement.prototype.requestFullscreen=()=>Promise.resolve()')
        await page.goto(URL, wait_until='domcontentloaded')
        title = page.locator('h3').filter(has_text='Negócios por vendedor')
        await title.wait_for()
        await page.wait_for_timeout(6500)
        card = title.locator('xpath=ancestor::div[contains(@class,"relative") and contains(@class,"flex")][1]')
        initial = await card.inner_text()
        for value in ['171', '118', '48']:
            assert value in initial, 'Reference dashboard totals changed'

        for dark in [False, True]:
            await page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)', dark)
            for width, height in [(1440, 1000), (668, 674), (390, 844)]:
                await page.set_viewport_size({'width': width, 'height': height})
                await page.wait_for_timeout(800)
                await card.screenshot(path=str(OUT / f'chart-{width}-dark{dark}.png'))
                bounds = await card.evaluate('''c=>{
                  const legend=c.querySelector('[aria-label="Legenda do gráfico"]').getBoundingClientRect();
                  const plot=c.querySelector('[data-stacked-plot]').getBoundingClientRect();
                  return {legendBottom:legend.bottom,plotTop:plot.top,
                    bars:[...c.querySelectorAll('.recharts-bar-rectangle path')].map(e=>e.getBoundingClientRect().width),
                    names:[...c.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick')].map(e=>e.textContent)};
                }''')
                assert bounds['legendBottom'] <= bounds['plotTop'] + 1, bounds
                assert max(bounds['bars']) <= 129, bounds
                assert len(bounds['names']) == 3, bounds
                print('PASS chart', width, 'dark', dark)

        await page.set_viewport_size({'width': 1440, 'height': 1000})
        await page.wait_for_timeout(800)
        await card.locator('.recharts-bar-rectangle').first.click()
        dialog = page.get_by_role('dialog')
        await dialog.wait_for()
        await page.wait_for_timeout(2000)
        text = await dialog.inner_text()
        assert 'Darlan Ferreira' in text and '118 registros' in text
        await dialog.screenshot(path=str(OUT / 'drilldown.png'))
        await page.keyboard.press('Escape')
        await dialog.wait_for(state='hidden')
        print('PASS click opens the same 118 records and closes back to the chart')

        for dark in [False, True]:
            for width, height in [(1920, 1080), (1366, 768), (1280, 720)]:
                await page.set_viewport_size({'width': width, 'height': height})
                await page.goto(URL + '&foco=1&tv=1', wait_until='domcontentloaded')
                await page.locator('.fixed.inset-0 .stacked-vertical-chart').wait_for()
                await page.wait_for_timeout(5500)
                await page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)', dark)
                await page.mouse.move(0, 0)
                result = await page.evaluate('''()=>{
                  const root=[...document.querySelectorAll('.fixed.inset-0')].find(e=>e.querySelector('h1')?.textContent==='Leaderboard');
                  const r=e=>{const b=e.getBoundingClientRect();return {bottom:b.bottom,right:b.right}};
                  return {cards:[...root.querySelectorAll('h3')].filter(h=>!h.closest('.company-ranking')).map(h=>r(h.closest('.relative.flex'))),
                    calls:[...root.querySelectorAll('.overflow-auto.px-2')].map(e=>({client:e.clientHeight,scroll:e.scrollHeight,bounds:r(e),
                      sellers:[...e.children[0].children].map(r)}))};
                }''')
                assert len(result['calls']) == 2, result
                assert all(c['bottom'] <= height + 1 and c['right'] <= width + 1 for c in result['cards']), result
                for calls in result['calls']:
                    assert calls['scroll'] <= calls['client'] + 1, result
                    assert all(s['bottom'] <= calls['bounds']['bottom'] + 1 for s in calls['sellers']), result
                await page.screenshot(path=str(OUT / f'tv-{width}-dark{dark}.png'))
                print('PASS complete calls and cards', width, height, 'dark', dark)
        assert not errors, errors
        assert not writes, writes
        print('PASS no runtime errors or record writes; physical TV unverified')
        await browser.close()


asyncio.run(main())