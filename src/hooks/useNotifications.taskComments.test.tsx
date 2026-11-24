import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationsProvider, useNotifications } from "./useNotifications";

interface Row { id:string;user_id:string;source_type:string;created_at:string;is_read:boolean;type:string;title:string;content:string;link:string }
const state = vi.hoisted(() => ({
  rows: [] as Row[],
  handlers: [] as { event:string;filter:string;callback:(payload:{new:Row})=>Promise<void> }[],
  custom: vi.fn(), dismiss: vi.fn(), single: 0,
}));
vi.mock("sonner", () => ({ toast: { custom: state.custom, dismiss: state.dismiss } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data:{user:{id:"auth-owner"}} }) },
  from: (table:string) => {
    let id:string | null = null;
    const chain = {
      select: (_fields:string, options?: {head?:boolean}) => {
        if (options?.head) return { eq: () => ({ eq: async () => ({ count:state.rows.filter(row=>!row.is_read).length,error:null }) }) };
        return chain;
      },
      eq: (key:string,value:string) => { if (key==="id") id=value; return chain; },
      maybeSingle: async () => ({ data: {id:"owner"}, error:null }),
      order: () => chain,
      limit: async () => ({ data:state.rows,error:null }),
      single: async () => { state.single++;return {data:state.rows.find(row=>row.id===id),error:null}; },
    };
    return table==="users" ? { select:()=>chain } : chain;
  },
  channel: () => {
    const channel = { on: (_kind:string, filter:{event:string;filter:string}, callback:(payload:{new:Row})=>Promise<void>) => {
      state.handlers.push({...filter,callback});return channel;
    }, subscribe:()=>channel };
    return channel;
  },
  removeChannel: vi.fn(),
} }));
const row = (overrides:Partial<Row>={}):Row => ({ id:"comment-notification",user_id:"owner",source_type:"marketing_task_comment",created_at:new Date().toISOString(),is_read:false,type:"mention",title:"Menção",content:"TESTE QA\nRevisar",link:"/marketing/projetos?tab=tarefas&task=task&comment=comment",...overrides });
function Harness() { const {unreadCount}=useNotifications();return <span data-testid="unread">{unreadCount}</span>; }
async function setup() {
  const queryClient=new QueryClient();
  const view=render(<QueryClientProvider client={queryClient}><NotificationsProvider><Harness /></NotificationsProvider></QueryClientProvider>);
  await waitFor(()=>expect(state.handlers.some(handler=>handler.event==="INSERT")).toBe(true));
  const handler=state.handlers.find(item=>item.event==="INSERT");
  if (!handler) throw new Error("Subscription unavailable");
  return {view,handler,queryClient};
}
beforeEach(()=>{cleanup();state.rows=[];state.handlers=[];state.single=0;state.custom.mockClear();vi.stubGlobal("fetch",vi.fn());});
describe("Entrega individual dos avisos de tarefas",()=>{
  it("assina somente notificações do destinatário autenticado",async()=>{
    await setup();
    expect(state.handlers.map(handler=>handler.filter)).toEqual(["user_id=eq.owner","user_id=eq.owner"]);
  });
  it("comentário recebido aparece uma vez no sino, sem duplicar o push do servidor",async()=>{
    const {view,handler}=await setup();const notification=row();state.rows=[notification];
    await act(()=>handler.callback({new:notification}));
    await waitFor(()=>expect(view.getByTestId("unread").textContent).toBe("1"));
    await act(()=>handler.callback({new:notification}));
    expect(state.custom).toHaveBeenCalledTimes(1);
    expect(state.single).toBe(1);
    expect(view.getByTestId("unread").textContent).toBe("1");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("um evento de outro destinatário não atualiza o sino nem abre aviso",async()=>{
    const {view,handler}=await setup();
    await act(()=>handler.callback({new:row({user_id:"someone-else"})}));
    expect(view.getByTestId("unread").textContent).toBe("0");
    expect(state.single).toBe(0);
    expect(state.custom).not.toHaveBeenCalled();
  });
  it("tarefa atribuída chega uma vez, atualiza o quadro e não duplica push",async()=>{
    const {view,handler,queryClient}=await setup();
    const invalidate=vi.spyOn(queryClient,"invalidateQueries");
    const notification=row({id:"assignment",source_type:"marketing_task_assignment",type:"task_assigned",link:"/marketing/projetos?tab=tarefas&task=task"});
    state.rows=[notification];
    await act(()=>handler.callback({new:notification}));
    await waitFor(()=>expect(view.getByTestId("unread").textContent).toBe("1"));
    await act(()=>handler.callback({new:notification}));
    expect(state.custom).toHaveBeenCalledTimes(1);
    expect(state.custom.mock.calls[0]?.[1]).toMatchObject({position:"top-right"});
    expect(state.single).toBe(1);
    expect(invalidate).toHaveBeenCalledWith({queryKey:["marketing-tasks"]});
    expect(fetch).not.toHaveBeenCalled();
  });
});