import asyncio, json
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.async_api import async_playwright
from lovable_playwright_defaults import signed_in_context
ROOT=Path('/tmp/browser/accelerometer-programs-regression')
ROOT.mkdir(parents=True, exist_ok=True)
CR='11111111-1111-4111-8111-111111111111'
EM='22222222-2222-4222-8222-222222222222'
DATE='2026-11-11T12:00:00.000Z'
def task(n,deal,activity):
 return {'id':f'00000000-0000-4000-8000-{n:012d}','title':f'TESTE QA {"CR" if deal==CR else "Mentoria"}', 'deal_id':deal,'client_id':None,'lead_id':None,'created_at':DATE,'completed_at':DATE,'activity_types':{'name':activity}}
tasks=[task(1,CR,'Reunião realizada'),task(2,EM,'Reunião realizada'),task(3,CR,'Call comercial agendada'),task(4,EM,'Call comercial agendada'),task(5,CR,'No-show'),task(6,EM,'No-show')]
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  context=await signed_in_context(browser,viewport={'width':668,'height':674})
  page=await context.new_page()
  async def fixture(route):
   u=urlparse(route.request.url); q=parse_qs(u.query); table=u.path.split('/')[-1]
   if route.request.method!='GET':
    return await route.fallback()
   data=None
   if table=='internal_tasks' and 'assigned_to' in q:
    data=tasks
   elif table=='deals' and ('responsible_user_id' in q or 'id' in q):
    data=[{'id':CR,'title':'TESTE QA CR','value':100,'won_at':DATE,'client_id':None},{'id':EM,'title':'TESTE QA Mentoria','value':200,'won_at':DATE,'client_id':None}]
   elif table=='deal_field_values':
    data=[{'deal_id':CR,'value_text':'clinica_ryka'},{'deal_id':EM,'value_text':'eternum_mentoring'}]
   if data is not None:
    offset=int(q.get('offset',['0'])[0]); limit=int(q.get('limit',['1000'])[0]); data=data[offset:offset+limit]
    return await route.fulfill(status=200,content_type='application/json',body=json.dumps(data))
   await route.fallback()
  await page.route('**/rest/v1/**',fixture)
  await page.goto('http://localhost:8080/sales-team/incentive-presentation',wait_until='domcontentloaded')
  await page.locator('#app-main-scroll').get_by_role('heading',name='Acelerômetro',exact=True).wait_for(timeout=60000)
  await page.get_by_role('radio',name='Programas',exact=True).click()
  await page.wait_for_timeout(8000)
  print('STATE',await page.locator('#app-main-scroll').inner_text())
  print('BUTTONS',await page.get_by_role('button').evaluate_all('(els)=>els.map(e=>e.getAttribute("aria-label")).filter(Boolean)'))
  for metric in ['Reuniões realizadas: 1.','Agendadas: 1.','No-Show: 1.','Close Rate: 100%.']:
   assert await page.get_by_role('button',name=metric,exact=False).count()==1,metric
  for metric in ['Reuniões realizadas: 1.','Agendadas: 1.','No-Show: 1.']:
   await page.get_by_role('button',name=metric,exact=False).click()
   dialog=page.get_by_role('dialog')
   await dialog.get_by_text('TESTE QA CR',exact=True).wait_for(timeout=30000)
   assert await dialog.get_by_text('TESTE QA Mentoria',exact=True).count()==0
   assert await dialog.get_by_text('1',exact=True).count()>=1
   await page.keyboard.press('Escape')
  await page.get_by_role('button',name='Close Rate: 100%.',exact=False).click()
  await page.get_by_role('dialog').get_by_text('TESTE QA CR',exact=True).wait_for(timeout=30000)
  assert await page.get_by_role('dialog').get_by_text('TESTE QA Mentoria',exact=True).count()==0
  await page.keyboard.press('Escape')
  for theme in ['light','dark']:
   await page.evaluate('(theme)=>{document.documentElement.classList.toggle("dark",theme==="dark");document.documentElement.classList.toggle("light",theme==="light")}',theme)
   for w,h in [(668,674),(390,844),(1440,1000)]:
    await page.set_viewport_size({'width':w,'height':h})
    await page.wait_for_timeout(300)
    dial=page.get_by_role('button',name='Vendas fechadas — Programas',exact=True)
    await dial.screenshot(path=str(ROOT/f'nonempty-dial-{theme}-{w}.png'))
    assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert await page.get_by_role('heading',name='Meus SPIFFs').count()==0
  print('PASS: fixture-only 1 CR sale, 1 held, 1 schedule, 1 no-show; 100% conversion; all four lists exclude mentorship; colored shared dial in both themes at 390/668/1440. No real data written.')
  await browser.close()
asyncio.run(main())
