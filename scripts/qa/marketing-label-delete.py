import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path('/tmp/browser/labels-delete')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True);page=await browser.new_page(viewport={'width':1440,'height':1000});errors=[];writes=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  async def block(route):
   if route.request.method not in ['GET','HEAD','OPTIONS']: writes.append(route.request.method)
   await route.abort()
  await page.route('**/rest/v1/**',block);await page.route('**/functions/v1/**',block)
  await page.route('**/src/hooks/useCurrentUser.tsx*',lambda r:r.fulfill(content_type='application/javascript',body='export const useCurrentUser=()=>({currentUser:{id:"qa-person",account_id:"qa-account",name:"TESTE QA"},loading:false});export const CurrentUserProvider=({children})=>children;'))
  await page.goto('http://localhost:8080/auth',wait_until='domcontentloaded')
  await page.evaluate('''async()=>{
   const React=await import('/node_modules/.vite/deps/react.js');const {createRoot}=await import('/node_modules/.vite/deps/react-dom_client.js');
   const {QueryClient,QueryClientProvider,useQuery}=await import('/node_modules/.vite/deps/@tanstack_react-query.js');
   const {TooltipProvider}=await import('/src/components/ui/tooltip.tsx');
   const {TaskLabelFilter,TaskLabelEditor,TaskLabelBadge}=await import('/src/components/marketing/tasks/TaskLabels.tsx');
   const {TASK_LABEL_PALETTE}=await import('/src/lib/marketing/taskLabelColors.ts');
   const {useMarketingTaskLabelCatalog}=await import('/src/hooks/useMarketingTaskLabelCatalog.ts');
   const {supabase}=await import('/src/integrations/supabase/client.ts');
   window.qaRecords=[{id:'qa-one',title:'TESTE QA original',tags:['TESTE QA Compartilhada','Outra'],custom_fields:{preserved:true,delivery_details:{due_time:'17:30',label_colors:{'teste qa compartilhada':'#207449',outra:'purple'}}},status:'done',updated_at:'before'},{id:'qa-two',title:'TESTE QA segunda',tags:['TESTE QA Compartilhada'],custom_fields:{preserved:true},status:'pending',updated_at:'before'}];
   window.qaCalls=[];window.qaFailure=false;
   supabase.rpc=async(name,args)=>{window.qaCalls.push({name,args});if(window.qaFailure)return {data:null,error:{code:'42501',message:'Sem permissão para remover a etiqueta de todas as tarefas.'}};
     const key=args.p_name.toLocaleLowerCase('pt-BR');window.qaRecords=window.qaRecords.map(t=>{if(!t.tags.some(s=>s.toLowerCase()===key))return t;const custom=structuredClone(t.custom_fields);if(custom.delivery_details?.label_colors)delete custom.delivery_details.label_colors[key];return {...t,tags:t.tags.filter(s=>s.toLowerCase()!==key),custom_fields:custom,updated_at:'after'};});return {data:window.qaRecords,error:null};};
   document.getElementById('root').remove();const host=document.createElement('div');host.id='qa-host';host.className='min-h-screen bg-background p-6';document.body.append(host);
   const client=new QueryClient();client.setQueryData(['marketing-tasks','qa-account','qa-person'],window.qaRecords);
   function App(){const {data:tasks=[]}=useQuery({queryKey:['marketing-tasks','qa-account','qa-person'],queryFn:()=>window.qaRecords,enabled:false});const {catalog,createLabel,editLabel,deleteLabel}=useMarketingTaskLabelCatalog(tasks);const [selected,setSelected]=React.useState(['teste qa compartilhada']);const [value,setValue]=React.useState([{name:'TESTE QA Compartilhada',color:'#207449'},{name:'Outra',color:'purple'}]);window.qaSelection=selected;window.qaDraft=value;return React.createElement(React.Fragment,null,
    React.createElement('div',{className:'mb-6 flex justify-end'},React.createElement(TaskLabelFilter,{catalog,selected,onChange:setSelected,onCreate:createLabel,onEdit:editLabel,onDelete:deleteLabel})),
    React.createElement('div',{id:'qa-editor',className:'max-w-md'},React.createElement(TaskLabelEditor,{value,onChange:setValue,catalog,portalContainer:null,onCreate:createLabel,onEdit:editLabel,onDelete:deleteLabel})),
    React.createElement('div',{id:'qa-badges',className:'mt-10 flex max-w-xl flex-wrap gap-3'},[...TASK_LABEL_PALETTE.map(o=>({name:o.name,color:o.value})),{name:'Branco',color:'#ffffff'},{name:'Preto',color:'#000000'},{name:'Neon',color:'#00ff00'}].map(label=>React.createElement(TaskLabelBadge,{key:label.name,label}))));}
   window.qaRoot=createRoot(host);window.qaRemount=()=>window.qaRoot.render(React.createElement(QueryClientProvider,{client},React.createElement(TooltipProvider,null,React.createElement(App))));window.qaRemount();
  }''')
  await page.get_by_role('button',name='Filtrar por etiquetas',exact=True).wait_for()
  await page.locator('#qa-badges').screenshot(path=str(OUT/'badges-light.png'))
  print('colors',await page.locator('#qa-badges').evaluate('''e=>[...e.children].map(b=>({name:b.textContent,ink:getComputedStyle(b).color,bg:getComputedStyle(b).backgroundColor,parent:getComputedStyle(document.getElementById('qa-host')).backgroundColor}))'''))
  for dark in [False,True]:
   await page.evaluate('(dark)=>document.documentElement.classList.toggle("dark",dark)',dark)
   for width,height in [(1440,1000),(668,674),(390,844)]:
    await page.set_viewport_size({'width':width,'height':height});await page.get_by_role('button',name='Filtrar por etiquetas',exact=True).click()
    pop=page.get_by_label('Etiquetas do filtro',exact=True);await pop.screenshot(path=str(OUT/f'list-{width}-dark{dark}.png'))
    await page.get_by_role('button',name='Editar etiqueta TESTE QA Compartilhada',exact=True).click()
    await page.get_by_role('button',name='Excluir etiqueta TESTE QA Compartilhada',exact=True).click()
    await pop.screenshot(path=str(OUT/f'confirm-{width}-dark{dark}.png'))
    bounds=await pop.bounding_box();assert bounds and bounds['x']>=0 and bounds['x']+bounds['width']<=width+1 and bounds['y']>=0 and bounds['y']+bounds['height']<=height+1,bounds
    assert await page.evaluate('window.qaCalls.length')==0
    await page.get_by_role('button',name='Cancelar',exact=True).click();await page.get_by_role('button',name='Fechar etiquetas',exact=True).click()
  await page.set_viewport_size({'width':1440,'height':1000})
  await page.get_by_role('button',name='Filtrar por etiquetas',exact=True).click();await page.get_by_role('button',name='Editar etiqueta TESTE QA Compartilhada',exact=True).click();await page.get_by_role('button',name='Excluir etiqueta TESTE QA Compartilhada',exact=True).click()
  await page.evaluate('window.qaFailure=true');await page.get_by_role('button',name='Excluir etiqueta',exact=True).click();await page.get_by_text('Sem permissão para remover a etiqueta de todas as tarefas.',exact=True).wait_for();assert await page.evaluate('window.qaRecords[0].tags.length')==2
  await page.evaluate('window.qaFailure=false');await page.get_by_role('button',name='Excluir etiqueta',exact=True).click();await page.get_by_role('button',name='Editar etiqueta Outra',exact=True).wait_for()
  assert await page.evaluate('window.qaSelection.length')==0
  assert await page.evaluate('window.qaRecords.length===2 && window.qaRecords[0].tags.join()==="Outra" && window.qaRecords[1].tags.length===0 && window.qaRecords[0].title==="TESTE QA original" && window.qaRecords[0].status==="done" && window.qaRecords[0].custom_fields.delivery_details.due_time==="17:30"')
  print('PASS confirmation, cancel, denied then retry, shared removal keeps tasks and clears filter')
  await page.get_by_role('button',name='Fechar etiquetas',exact=True).click()
  await page.get_by_role('button',name='Selecionar etiquetas da tarefa',exact=True).click();editor=page.get_by_label('Etiquetas da tarefa',exact=True);await editor.get_by_role('button',name='Editar etiqueta Outra',exact=True).click();await editor.get_by_role('button',name='Excluir etiqueta Outra',exact=True).click();await editor.get_by_role('button',name='Excluir etiqueta',exact=True).click();await page.wait_for_timeout(400)
  assert await page.evaluate('window.qaDraft.length===1 && window.qaDraft[0].name==="TESTE QA Compartilhada"');print('PASS editor deletion only removes selected label from draft')
  await page.get_by_role('button',name='Fechar etiquetas',exact=True).click()
  await page.locator('#qa-badges').screenshot(path=str(OUT/'badges-dark.png'))
  print('dark colors',await page.locator('#qa-badges').evaluate('''e=>[...e.children].map(b=>({name:b.textContent,ink:getComputedStyle(b).color,bg:getComputedStyle(b).backgroundColor,parent:getComputedStyle(document.getElementById('qa-host')).backgroundColor}))'''))
  print('errors',errors,'network writes',writes);assert not errors;assert not writes
  await browser.close()
asyncio.run(main())
