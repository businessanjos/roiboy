"""Read-only browser regression using the original Calls Commercial renderer.

Local fixtures reproduce the screenshot; no authenticated reads or server writes.
Run: python3 scripts/qa/calls-seller-hierarchy.py
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path('/tmp/browser/calls-seller-hierarchy')
OUT.mkdir(parents=True, exist_ok=True)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 803, 'height': 674})
        errors = []
        writes = []
        page.on('pageerror', lambda e: errors.append(str(e)))

        async def guard(route):
            if route.request.method not in ['GET', 'HEAD', 'OPTIONS']:
                writes.append(route.request.method)
            await route.abort()

        await page.route('**/rest/v1/**', guard)
        await page.route('**/functions/v1/**', guard)
        await page.route('**/src/hooks/useCurrentUser.tsx*', lambda route: route.fulfill(
            content_type='application/javascript',
            body='export const useCurrentUser=()=>({currentUser:null,loading:false});export const CurrentUserProvider=({children})=>children;',
        ))
        await page.goto('http://localhost:8080/auth', wait_until='domcontentloaded')
        await page.evaluate('''async () => {
          const React=await import('/node_modules/.vite/deps/react.js');
          const {createRoot}=await import('/node_modules/.vite/deps/react-dom_client.js');
          const {ConfigurableCallCommercial}=await import('/src/components/insights/visuals/ConfigurableCallCommercial.tsx');
          const {TvModeProvider}=await import('/src/components/insights/TvModeContext.tsx');
          const {InsightsFiltersProvider,useInsightsFilters}=await import('/src/hooks/useInsightsFilters.tsx');
          const host=document.createElement('div');host.id='qa-calls-hierarchy';
          host.className='fixed inset-0 z-[9999] bg-background p-6 text-foreground';document.body.append(host);
          const sheet=document.createElement('style');
          sheet.textContent='#qa-calls-panel{width:min(100%,880px);height:300px;transform-origin:top left}';document.head.append(sheet);
          const data=[{name:'Darlan Ferreira',value:0,count:8,salesMonth:1},{name:'Jonathan Marcato',value:0,count:10,salesMonth:3}];
          const root=createRoot(host);
          function Calls(props){const {setPreset}=useInsightsFilters();React.useEffect(()=>setPreset(props.year?'year':'month'),[props.year]);return React.createElement(ConfigurableCallCommercial,{data:props.data??data,hiddenUsers:props.hiddenUsers,formatting:{type:'number',decimals:0}});}
          window.qaRender=opts=>root.render(React.createElement('div',{id:'qa-calls-panel'},React.createElement(TvModeProvider,{enabled:opts.tv,scale:1.45},React.createElement(InsightsFiltersProvider,null,React.createElement(Calls,opts)))));
          window.qaRender({tv:false});
        }''')
        calls = page.get_by_role('group', name='Calls por vendedor')
        await calls.wait_for()

        async def measure():
            return await calls.evaluate('''el => {
              const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width}};
              return {client:el.clientWidth,scroll:el.scrollWidth,rows:[...el.querySelectorAll('.commercial-calls-seller')].map(s=>({name:s.getAttribute('aria-label'),bounds:rect(s),identity:rect(s.querySelector('.commercial-calls-identity')),metrics:rect(s.querySelector('.commercial-calls-metrics')),blocks:[...s.querySelectorAll('.commercial-calls-block')].map(b=>({bounds:rect(b),content:[...b.children].map(rect)}))}))};
            }''')

        scenarios = [(803,674,False,1), (390,844,False,1), (1440,900,False,1),
                     (1920,1080,True,1), (1366,768,True,1), (803,674,True,1),
                     (803,674,False,.8), (803,674,False,1.5), (1440,900,False,2),
                     (390,844,False,1.5)]
        for dark in [False, True]:
            await page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)', dark)
            for width, height, tv, zoom in scenarios:
                await page.set_viewport_size({'width':width,'height':height})
                await page.evaluate('''opts=>{
                  window.qaRender(opts);
                  const panel=document.getElementById('qa-calls-panel');
                  panel.style.width=`${Math.min(880,(innerWidth-48)/opts.zoom)}px`;
                  panel.style.transform=`scale(${opts.zoom})`;
                  panel.style.height=opts.tv?'240px':'300px';
                }''', {'tv':tv, 'zoom':zoom})
                await page.wait_for_function('document.querySelectorAll(".commercial-calls-seller").length===2 && document.querySelectorAll(".commercial-calls-block").length===6')
                await calls.screenshot(path=str(OUT/f'{width}-tv{tv}-zoom{zoom}-dark{dark}.png'))
                m = await measure()
                assert [r['name'] for r in m['rows']] == ['Jonathan Marcato','Darlan Ferreira'], m
                first, second = m['rows']
                assert second['bounds']['top'] >= first['bounds']['bottom'] + 1, m
                assert abs(first['bounds']['left']-second['bounds']['left']) < 1, m
                assert m['scroll'] <= m['client']+1, m
                for row in m['rows']:
                    assert row['metrics']['top'] >= row['identity']['bottom'], m
                    for block in row['blocks']:
                        for c in block['content']:
                            b = block['bounds']
                            assert c['left'] >= b['left']-.5 and c['right'] <= b['right']+.5, m
                            assert c['top'] >= b['top']-.5 and c['bottom'] <= b['bottom']+.5, m
                assert await page.get_by_role('region',name='Jonathan Marcato').get_by_label('10 calls feitas',exact=True).count()==1
                assert await page.get_by_role('region',name='Jonathan Marcato').get_by_label('3 vendas',exact=True).count()==1
                assert await page.get_by_role('region',name='Darlan Ferreira').get_by_label('8 calls feitas',exact=True).count()==1
                assert await page.get_by_role('region',name='Darlan Ferreira').get_by_label('1 vendas',exact=True).count()==1
                print('PASS hierarchy/blocks',width,'tv',tv,'zoom',zoom,'dark',dark)

        await page.evaluate('window.qaRender({tv:false,data:[{name:"Darlan Ferreira",value:50,count:8,salesMonth:4},{name:"Jonathan Marcato",value:0,count:10,salesMonth:3}]})')
        await page.wait_for_function('document.querySelector(".commercial-calls-seller").getAttribute("aria-label")==="Darlan Ferreira"')
        await page.evaluate('window.qaRender({tv:false,hiddenUsers:["Darlan Ferreira"]})')
        await page.wait_for_function('document.querySelectorAll(".commercial-calls-seller").length===1')
        assert await page.get_by_role('region',name='Jonathan Marcato').count()==1
        await page.evaluate('window.qaRender({tv:false,year:true,data:[{name:"Darlan Ferreira",value:0,count:8,salesMonth:30},{name:"Jonathan Marcato",value:0,count:10,salesMonth:3}]})')
        await page.wait_for_function('document.querySelectorAll(".commercial-calls-block").length===4 && document.querySelector(".commercial-calls-seller").getAttribute("aria-label")==="Jonathan Marcato"')
        await page.evaluate('window.qaRender({tv:false,data:[{name:"TV Escritório",value:99,count:99,salesMonth:99},{name:"Jonathan Marcato",value:0,count:10,salesMonth:3}]})')
        await page.wait_for_function('document.querySelectorAll(".commercial-calls-seller").length===1 && document.querySelectorAll(".commercial-calls-block").length===3')
        assert await page.get_by_role('region',name='TV Escritório').count()==0
        await page.evaluate('window.qaRender({tv:false,data:Array.from({length:8},(_,i)=>({name:"TESTE QA "+i,value:0,count:i,salesMonth:i}))})')
        await page.wait_for_function('document.querySelectorAll(".commercial-calls-seller").length===8')
        assert await calls.evaluate('el=>el.scrollHeight>el.clientHeight && el.scrollWidth<=el.clientWidth+1')
        await calls.evaluate('el=>el.scrollTop=el.scrollHeight')
        assert await calls.evaluate('el=>el.scrollTop>0')
        assert not errors, errors
        assert not writes, writes
        print('PASS live reordering, hidden sellers, annual ordering, technical account exclusion, local scrolling; no runtime errors or writes')
        await browser.close()


asyncio.run(main())