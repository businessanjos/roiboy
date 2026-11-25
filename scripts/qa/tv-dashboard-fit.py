"""Read-only full-dashboard fit regression with original renderers and local data.

Uses the seller dashboard's saved row/column proportions, not authenticated data.
Run: python3 scripts/qa/tv-dashboard-fit.py
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path('/tmp/browser/tv-dashboard-compact-zoom')
OUT.mkdir(parents=True, exist_ok=True)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width':1920,'height':1080})
        errors, writes = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))

        async def block(route):
            if route.request.method not in ['GET','HEAD','OPTIONS']:
                writes.append(route.request.method)
            await route.abort()

        await page.route('**/rest/v1/**', block)
        await page.route('**/functions/v1/**', block)
        modules = {
            'hooks/useCurrentUser.tsx': 'export const useCurrentUser=()=>({currentUser:null,loading:false});export const CurrentUserProvider=({children})=>children;',
            'contexts/CompanyContext.tsx': 'export const useCompany=()=>({companies:[{id:"eternum",trade_name:"Eternum"},{id:"anjos",trade_name:"Anjos"}],loading:false});export const CompanyProvider=({children})=>children;',
            'hooks/useInsightsDashboards.tsx': 'export const useInsightsDashboardsSafe=()=>null;export const useInsightsDashboards=()=>window.qaDashboard??{};export const InsightsDashboardsProvider=({children})=>children;',
            'hooks/useVisualData.ts': 'export const useVisualData=({config})=>({data:window.qaData?.[config?.qaKey]??[],isLoading:false,error:null});export const enrichDealsWithCanal=async(a,b)=>b;export const enrichDealsWithProduct=async(a,b)=>b;export const enrichDealsWithMql=async(a,b)=>b;export const enrichLeadsWithMql=async(a,b)=>b;export const enrichLeadsWithFaturamento=async(a,b)=>b;export const getLeadIdsByDealConstraints=async()=>[];export const compareDateLabels=(a,b)=>a.localeCompare(b);',
            'hooks/useStackedVisualData.ts': 'export const useStackedVisualData=()=>({data:window.qaStacked,isLoading:false,error:null});',
            'hooks/useMapVisualData.ts': 'export const useMapVisualData=()=>({data:null,isLoading:false,error:null});',
            'components/insights/visuals/DrilldownDialog.tsx': 'export const DrilldownDialog=()=>null;',
            'components/insights/VisualStudioDialog.tsx': 'export const VisualStudioDialog=()=>null;',
            'components/insights/ShareDashboardModal.tsx': 'export const ShareDashboardModal=()=>null;',
            'components/insights/ComparativeAnalysisDialog.tsx': 'export const ComparativeAnalysisDialog=()=>null;',
            'components/insights/InsightsFilterBar.tsx': 'export const InsightsFilterBar=()=>null;',
            'components/insights/SendToTvButton.tsx': 'export const SendToTvButton=()=>null;',
        }
        def stub_module(code):
            async def stub(route):
                await route.fulfill(content_type='application/javascript', body=code)
            return stub

        for path, body in modules.items():
            await page.route('**/src/'+path+'*', stub_module(body))
        await page.goto('http://localhost:8080/auth', wait_until='domcontentloaded')
        await page.evaluate('''async () => {
          const React=await import('/node_modules/.vite/deps/react.js');
          const {createRoot}=await import('/node_modules/.vite/deps/react-dom_client.js');
          const {MemoryRouter}=await import('/node_modules/.vite/deps/react-router-dom.js');
          const {TvFitStage}=await import('/src/components/insights/TvFitStage.tsx');
          const {InsightsGrid}=await import('/src/components/insights/grid/InsightsGrid.tsx');
          const {InsightsFiltersProvider,useInsightsFilters}=await import('/src/hooks/useInsightsFilters.tsx');
          const host=document.createElement('div');host.id='qa-tv-panel';
          host.className='fixed inset-0 z-[9999] flex flex-col overflow-auto bg-background p-2';document.body.append(host);
          window.qaData={ranking:[{name:'Jonathan Marcato',value:241200,count:7,companyId:'eternum',products:[{name:'EM l Eternum Mentoring',qty:3},{name:'REN. EM l Eternum Mentoring',qty:4}]},{name:'Darlan Ferreira',value:80400,count:3,companyId:'eternum',products:[{name:'EM l Eternum Mentoring',qty:1},{name:'REN. EM l Eternum Mentoring',qty:2}]},{name:'Darlan Ferreira',value:160000,count:5,companyId:'anjos',products:[{name:'CR l Programa de Aceleração',qty:5}]}],calls:[{name:'Darlan Ferreira',value:0,count:8,salesMonth:1},{name:'Jonathan Marcato',value:0,count:10,salesMonth:3}],cr:[{name:'Darlan Ferreira',value:3,count:6,salesMonth:1}]};
          window.qaStacked={data:[{name:'Jonathan Marcato','EM':30,'EC':13,'CR':0},{name:'Darlan Ferreira','EM':40,'EC':18,'CR':60},{name:'Lincoln','EM':5,'EC':0,'CR':0}],seriesKeys:['EM','EC','CR']};
          const config=key=>({qaKey:key,dataSource:'deals',dimension:{field:'responsible_name',type:'text'},measure:{field:'value',aggregation:'sum'},formatting:{type:'decimal',decimals:0},appearance:{colorPalette:'ember',paletteLocked:true,fontScale:'normal',showDataLabels:true}});
          window.qaVisuals=[{id:'ranking',title:'Ranking de Vendedores',chart_type:'ranking',config:{...config('ranking'),rankingCompanyIds:['eternum','anjos'],formatting:{type:'currency',decimals:2}},layout:{x:0,y:0,w:48,h:10,scale:48}},{id:'bars',title:'Negócios por vendedor',chart_type:'bar',config:{...config('bars'),stackBy:'_custom',stackByCustomField:{fieldId:'qa-product',source:'deal'}},layout:{x:0,y:10,w:48,h:14,scale:48}},{id:'calls',title:'Calls Comerciais',chart_type:'call_commercial',config:config('calls'),layout:{x:0,y:24,w:24,h:9,scale:48}},{id:'cr',title:'Calls Comerciais · Clínica Ryka (CR)',chart_type:'call_commercial',config:config('cr'),layout:{x:24,y:24,w:24,h:9,scale:48}}];
          window.qaOriginal=JSON.stringify(window.qaVisuals);window.qaRequirements=[];
          function App(){const [required,setRequired]=React.useState(0);const [mode,setMode]=React.useState(true);const [header,setHeader]=React.useState(0);const [zoom,setZoom]=React.useState(60);const [revision,refresh]=React.useState(0);const {setPreset}=useInsightsFilters();
            React.useEffect(()=>setPreset('month'),[]);window.qaRefresh=()=>refresh(x=>x+1);window.qaSetMode=setMode;window.qaSetHeader=setHeader;window.qaSetZoom=setZoom;
            const grid=React.createElement(InsightsGrid,{visuals:window.qaVisuals,readOnly:true,fitHeight:mode,onLayoutChange:()=>{throw Error('No writes')},onRequiredHeight:h=>{window.qaRequired=h;window.qaRequirements.push(h);setRequired(h)}});
            return React.createElement(React.Fragment,null,React.createElement('div',{style:{height:header,flexShrink:0}}),React.createElement('div',{className:'min-h-0 flex-1'},mode?React.createElement(TvFitStage,{requiredHeight:required,zoom,presentation:true},grid):grid));
          }
          window.qaRoot=createRoot(host);window.qaRoot.render(React.createElement(MemoryRouter,null,React.createElement(InsightsFiltersProvider,null,React.createElement(App))));
        }''')
        await page.get_by_role('group', name='Calls por vendedor').first.wait_for()

        async def settle():
            await page.wait_for_function('''async()=>{
              const start=window.qaRequired;
              for(let i=0;i<12;i++) await new Promise(requestAnimationFrame);
              return start===window.qaRequired && [...document.querySelectorAll('.commercial-calls')].every(el=>el.scrollHeight<=el.clientHeight+1);
            }''')

        async def check():
            m = await page.evaluate('''()=>{
              const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom}};
              return {required:window.qaRequired,cards:[...document.querySelectorAll('[data-tv-visual]')].map(rect),calls:[...document.querySelectorAll('.commercial-calls')].map(el=>({client:el.clientHeight,scroll:el.scrollHeight,bounds:rect(el),sellers:[...el.querySelectorAll('.commercial-calls-seller')].map(s=>({name:s.getAttribute('aria-label'),bounds:rect(s),blocks:[...s.querySelectorAll('.commercial-calls-block')].map(b=>({bounds:rect(b),children:[...b.children].map(rect)}))}))})),width:innerWidth,height:innerHeight};
            }''')
            assert len(m['cards']) == 4, m
            for card in m['cards']:
                assert card['left']>=0 and card['right']<=m['width']+1 and card['top']>=0 and card['bottom']<=m['height']+1, m
            for calls in m['calls']:
                assert calls['scroll']<=calls['client']+1, m
                for seller in calls['sellers']:
                    assert seller['bounds']['bottom']<=calls['bounds']['bottom']+1, m
                    for block in seller['blocks']:
                        for child in block['children']:
                            assert child['top']>=block['bounds']['top']-1 and child['bottom']<=block['bounds']['bottom']+1, m
                            assert child['left']>=block['bounds']['left']-1 and child['right']<=block['bounds']['right']+1, m
            return m

        for dark in [False,True]:
            await page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)',dark)
            for width,height in [(1920,1080),(1366,768),(1280,720),(803,674),(668,674)]:
                await page.set_viewport_size({'width':width,'height':height})
                for controls in [0,48]:
                    await page.evaluate('(h)=>window.qaSetHeader(h)',controls)
                    await settle()
                    small = await page.locator('.commercial-calls-number').first.bounding_box()
                    await page.evaluate('window.qaSetZoom(100)')
                    await settle(); await check()
                    large = await page.locator('.commercial-calls-number').first.bounding_box()
                    assert small and large and small['height'] < large['height'], (small, large)
                    await page.evaluate('window.qaSetZoom(60)')
                    await settle()
                    m=await check()
                    assert [s['name'] for s in m['calls'][0]['sellers']] == ['Jonathan Marcato','Darlan Ferreira'],m
                    await page.locator('#qa-tv-panel').screenshot(path=str(OUT/f'{width}-dark{dark}-controls{controls}.png'))
                    print('PASS smaller 60% vs 100%, full TV fit',width,height,'dark',dark,'controls',controls,'required',m['required'])

        await page.set_viewport_size({'width':1366,'height':768})
        base=await page.evaluate('window.qaRequired')
        await page.evaluate('window.qaData.calls.push({name:"TESTE QA — Nome extenso para conferir quebra de linha",value:0,count:5,salesMonth:0});window.qaRefresh()')
        await page.wait_for_function('document.querySelectorAll(".commercial-calls-seller").length===4')
        await settle(); grown=await check()
        assert grown['required']>base,grown
        await page.evaluate('window.qaData.calls.pop();window.qaRefresh()')
        await page.wait_for_function('document.querySelectorAll(".commercial-calls-seller").length===3')
        await settle(); shrunk=await check()
        assert shrunk['required']<grown['required'],(grown,shrunk)
        await page.evaluate('window.qaData.calls=[];window.qaRefresh()')
        await page.wait_for_function('document.querySelectorAll(".commercial-calls-seller").length===1')
        await settle(); await check()
        await page.evaluate('window.qaData.calls=[{name:"Darlan Ferreira",value:0,count:8,salesMonth:1},{name:"Jonathan Marcato",value:0,count:10,salesMonth:3}];window.qaRefresh()')
        await page.wait_for_function('document.querySelectorAll(".commercial-calls-seller").length===3')
        await settle(); await check()
        assert await page.evaluate('JSON.stringify(window.qaVisuals)===window.qaOriginal')
        print('PASS sellers added/removed/empty/reloaded: full fit and original saved configuration preserved')
        await page.evaluate('window.qaSetMode(false)')
        await page.set_viewport_size({'width':1440,'height':900})
        await page.locator('.react-grid-layout').wait_for()
        assert await page.locator('[data-tv-visual]').count()==0
        assert await page.get_by_role('region',name='Jonathan Marcato',exact=True).count()==1
        await page.set_viewport_size({'width':390,'height':844})
        await page.wait_for_function('document.querySelectorAll(".commercial-calls-seller").length===3 && !document.querySelector("[data-tv-visual]")')
        assert await page.evaluate('JSON.stringify(window.qaVisuals)===window.qaOriginal')
        await page.set_viewport_size({'width':1920,'height':1080})
        await page.evaluate('''async()=>{
          const React=await import('/node_modules/.vite/deps/react.js');
          const {MemoryRouter}=await import('/node_modules/.vite/deps/react-router-dom.js');
          const {QueryClient,QueryClientProvider}=await import('/node_modules/.vite/deps/@tanstack_react-query.js');
          const {InsightsMainContent}=await import('/src/components/insights/InsightsMainContent.tsx');
          const {InsightsFiltersProvider,useInsightsFilters}=await import('/src/hooks/useInsightsFilters.tsx');
          const id='05fe3fc0-139f-4de2-b46c-da526bcd022a';
          window.qaDashboard={activeDashboard:{id,name:'Ranking de Vendedores'},activeDashboardId:id,dashboards:[{id,name:'Ranking de Vendedores'}],visuals:window.qaVisuals,isLoading:false,isLoadingVisuals:false,updateVisual:()=>{throw Error('No saved changes')},removeVisual:()=>{throw Error('No removal')}};
          localStorage.removeItem('insights-tv-pref-v6:'+id);
          localStorage.setItem('insights-tv-pref-v5:'+id,JSON.stringify({tvFit:true,zoom:100}));
          history.replaceState(null,'','/insights/'+id+'?periodo=este_mes');
          HTMLElement.prototype.requestFullscreen=()=>Promise.resolve();
          function Main(){const {setPreset}=useInsightsFilters();React.useEffect(()=>setPreset('month'),[]);return React.createElement(InsightsMainContent);}
          let revision=0;const client=new QueryClient();
          window.qaRenderMain=()=>window.qaRoot.render(React.createElement(MemoryRouter,{key:++revision},React.createElement(QueryClientProvider,{client},React.createElement(InsightsFiltersProvider,null,React.createElement(Main)))));
          window.qaRenderMain();
        }''')
        await page.get_by_role('button',name='Modo Foco',exact=True).click()
        await page.get_by_role('button',name='Ajustado à TV',exact=True).wait_for()
        await page.get_by_role('slider').wait_for()
        assert await page.get_by_role('slider').get_attribute('aria-valuenow') == '60'
        await page.wait_for_function('document.querySelectorAll("[data-tv-visual]").length===4')
        await page.wait_for_timeout(500)
        await check()
        await page.screenshot(path=str(OUT/'main-default-60.png'))
        await page.get_by_role('slider').focus()
        await page.get_by_role('slider').press('ArrowRight')
        await page.wait_for_function('document.querySelector("[role=slider]").getAttribute("aria-valuenow")==="70"')
        await page.wait_for_function('JSON.parse(localStorage.getItem("insights-tv-pref-v6:05fe3fc0-139f-4de2-b46c-da526bcd022a")).zoom===70')
        await page.mouse.move(100,100)
        await page.get_by_role('button',name='Sair do modo foco',exact=True).click()
        await page.get_by_role('button',name='Modo Foco',exact=True).click()
        assert await page.get_by_role('slider').get_attribute('aria-valuenow') == '70'
        await page.wait_for_timeout(300); await check()
        await page.screenshot(path=str(OUT/'main-zoom-70-reopened.png'))
        await page.mouse.move(110,100)
        await page.get_by_role('button',name='Sair do modo foco',exact=True).click()
        await page.evaluate('history.replaceState(null,"","/insights/05fe3fc0-139f-4de2-b46c-da526bcd022a?periodo=este_mes&foco=1&tv=1&zoom=80");window.qaRenderMain()')
        await page.get_by_role('button',name='Ajustado à TV',exact=True).wait_for()
        assert await page.get_by_role('slider').get_attribute('aria-valuenow') == '80'
        await page.wait_for_timeout(300); await check()
        assert await page.evaluate('JSON.stringify(window.qaVisuals)===window.qaOriginal')
        print('PASS original focus controls: old 100% preference replaced by 60%, slider to 70%, exit/reopen retains it, explicit 80% link preserved')

        # Exact TV 1 URL: foco + zoom must fit even without a tv parameter.
        await page.mouse.move(120,100)
        await page.get_by_role('button',name='Sair do modo foco',exact=True).click()
        await page.evaluate('''()=>{
          window.qaStacked={data:[{name:'Darlan Ferreira',CR:59,CA:0,EC:0,'EM I Eternum Mentoring':59,'Eternum MVP':0,NI:0},{name:'Jonathan Marcato',CR:6,CA:9,EC:2,'EM I Eternum Mentoring':27,'Eternum MVP':1,NI:1},{name:'Everton Pieri',CR:0,CA:0,EC:5,'EM I Eternum Mentoring':0,'Eternum MVP':0,NI:0}],seriesKeys:['CR','CA','EC','EM I Eternum Mentoring','Eternum MVP','NI']};
          window.qaData.cr=[{name:'Darlan Ferreira',value:4,count:15,salesMonth:5},{name:'Jonathan Marcato',value:0,count:5,salesMonth:0}];
          history.replaceState(null,'','/insights/05fe3fc0-139f-4de2-b46c-da526bcd022a?periodo=este_mes&foco=1&zoom=75');window.qaRenderMain();
        }''')
        await page.get_by_role('button',name='Ajustado à TV',exact=True).wait_for()
        assert await page.get_by_role('slider').get_attribute('aria-valuenow') == '75'

        async def check_tv1():
            await page.wait_for_function('''()=>{
              const root=document.querySelector('.insights-tv-presentation');
              return root && root.querySelectorAll('.tv-stacked-summary').length===3 && [...root.querySelectorAll('.commercial-calls')].every(el=>el.scrollHeight<=el.clientHeight+1);
            }''')
            await page.wait_for_timeout(600)
            await page.screenshot(path=str(OUT/'tv1-latest.png'))
            result=await page.evaluate('''()=>{
              const root=document.querySelector('.insights-tv-presentation');
              const r=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height}};
              const scale=root.getBoundingClientRect().width/root.offsetWidth;
              const cards=[...root.querySelectorAll('[data-tv-visual]')];
              const columns=[...root.querySelectorAll('.company-ranking-column-content')];
              return {scale,cards:cards.map(r),headers:cards.map(card=>{const header=card.querySelector('.tv-visual-header');return {bounds:r(header),title:r(header.querySelector('h3')),summary:header.children[1]?r(header.children[1]):null,padding:getComputedStyle(header).paddingLeft}}),columns:columns.map(c=>({bounds:r(c),header:r(c.querySelector('header')),list:r(c.querySelector('ol')),rows:[...c.querySelectorAll('li')].map(r)})),calls:[...root.querySelectorAll('.commercial-calls')].map(el=>({bounds:r(el),client:el.clientHeight,scroll:el.scrollHeight,metrics:[...el.querySelectorAll('.commercial-calls-metrics')].map(m=>({bounds:r(m),blocks:[...m.children].map(r)}))})),captions:[...root.querySelectorAll('.commercial-calls-label,.commercial-calls-conversion,.tv-visual-header > div,.company-ranking li [title]')].map(el=>({text:el.textContent,size:parseFloat(getComputedStyle(el).fontSize)*scale})),legend:[...root.querySelectorAll('[aria-label="Legenda do gráfico"] li')].map(el=>el.textContent),totals:[...root.querySelectorAll('.tv-stacked-summary')].map(el=>el.textContent),chart:r(root.querySelector('.recharts-wrapper')),barWidths:[...root.querySelectorAll('.recharts-bar-rectangle path')].map(el=>r(el).width)};
            }''')
            assert len(result['cards'])==4,result
            assert all(c['right']<=1921 and c['bottom']<=1081 for c in result['cards']),result
            assert result['cards'][-1]['bottom']>=1060,result
            for column in result['columns']:
                assert abs(column['list']['width']-column['bounds']['width'])<1,result
                assert all(abs(row['width']-column['bounds']['width'])<1 for row in column['rows']),result
                assert column['rows'][-1]['bottom']<=column['bounds']['bottom']+1,result
            assert abs(result['columns'][0]['header']['y']-result['columns'][1]['header']['y'])<1,result
            # The shorter company centers inside the seller region, not the header.
            one=result['columns'][1];region_top=one['header']['bottom']+6
            assert abs((one['rows'][0]['y']-region_top)-(one['bounds']['bottom']-one['rows'][0]['bottom']))<12,result
            for header in result['headers']:
                if header['summary']: assert header['summary']['y']>=header['title']['bottom'],result
            assert len({header['padding'] for header in result['headers']})==1,result
            for call in result['calls']:
                assert call['scroll']<=call['client']+1,result
                for metric in call['metrics']:
                    assert abs(metric['bounds']['width']-call['bounds']['width'])<1,result
                    assert max(b['width'] for b in metric['blocks'])-min(b['width'] for b in metric['blocks'])<1,result
            assert all(c['size']>=16 for c in result['captions']),result
            assert result['legend']==['CR','CA','EC','EM','MVP','NI'],result
            assert result['totals'][0]=='118CR 59 · EM 59' and result['totals'][2]=='5EC 5',result
            assert all(value in result['totals'][1] for value in ['46','CR 6','CA 9','EC 2','EM 27','MVP 1','NI 1']),result
            assert result['chart']['width']>1800,result
            assert max(result['barWidths'])>220,result
            return result

        for dark in [False,True]:
            await page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)',dark)
            await page.mouse.move(130,100)
            result=await check_tv1()
            await page.screenshot(path=str(OUT/f'tv1-1920-1080-75-dark{dark}-controls.png'))
            await page.wait_for_function('document.querySelector(".insights-tv-presentation").getBoundingClientRect().height>1050',timeout=10000)
            result=await check_tv1()
            await page.screenshot(path=str(OUT/f'tv1-1920-1080-75-dark{dark}-full.png'))
            print('PASS TV1 foco=1 zoom=75', 'dark',dark,'caption minimum',min(c['size'] for c in result['captions']),'visible category values',result['totals'])
        await page.mouse.move(140,100)
        await page.get_by_role('button',name='Sair do modo foco',exact=True).click()
        assert await page.locator('.insights-tv-presentation').count()==0
        assert await page.locator('[data-tv-visual]').count()==0
        normal=await page.locator('.company-ranking-column-content').first.bounding_box()
        assert normal and normal['width']<=513,normal
        print('PASS leaving TV restores original bounded company cards and normal mode')
        assert not errors,errors
        assert not writes,writes
        print('PASS non-TV desktop/mobile unchanged; no runtime errors, layout writes or backend writes')
        await browser.close()


asyncio.run(main())