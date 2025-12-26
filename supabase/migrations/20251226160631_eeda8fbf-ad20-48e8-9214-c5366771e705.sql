-- Create enum for zapp agent roles
CREATE TYPE public.zapp_agent_role AS ENUM ('admin', 'supervisor', 'agent');

-- Create enum for conversation assignment status
CREATE TYPE public.zapp_assignment_status AS ENUM ('pending', 'active', 'waiting', 'closed');

-- Create departments/queues table
CREATE TABLE public.zapp_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_distribution BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create agents table
CREATE TABLE public.zapp_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.zapp_departments(id) ON DELETE SET NULL,
  role zapp_agent_role NOT NULL DEFAULT 'agent',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_online BOOLEAN NOT NULL DEFAULT false,
  max_concurrent_chats INTEGER NOT NULL DEFAULT 5,
  current_chats INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, user_id)
);

-- Create conversation assignments table
CREATE TABLE public.zapp_conversation_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.zapp_agents(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.zapp_departments(id) ON DELETE SET NULL,
  status zapp_assignment_status NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  assigned_at TIMESTAMP WITH TIME ZONE,
  first_response_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id)
);

-- Create transfer history table
CREATE TABLE public.zapp_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  from_agent_id UUID REFERENCES public.zapp_agents(id) ON DELETE SET NULL,
  to_agent_id UUID REFERENCES public.zapp_agents(id) ON DELETE SET NULL,
  from_department_id UUID REFERENCES public.zapp_departments(id) ON DELETE SET NULL,
  to_department_id UUID REFERENCES public.zapp_departments(id) ON DELETE SET NULL,
  reason TEXT,
  transferred_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  transferred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.zapp_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapp_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapp_conversation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapp_transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for zapp_departments
CREATE POLICY "Users can view departments in their account"
  ON public.zapp_departments FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert departments in their account"
  ON public.zapp_departments FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update departments in their account"
  ON public.zapp_departments FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete departments in their account"
  ON public.zapp_departments FOR DELETE
  USING (account_id = get_user_account_id());

-- RLS Policies for zapp_agents
CREATE POLICY "Users can view agents in their account"
  ON public.zapp_agents FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert agents in their account"
  ON public.zapp_agents FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update agents in their account"
  ON public.zapp_agents FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete agents in their account"
  ON public.zapp_agents FOR DELETE
  USING (account_id = get_user_account_id());

-- RLS Policies for zapp_conversation_assignments
CREATE POLICY "Users can view assignments in their account"
  ON public.zapp_conversation_assignments FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert assignments in their account"
  ON public.zapp_conversation_assignments FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update assignments in their account"
  ON public.zapp_conversation_assignments FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete assignments in their account"
  ON public.zapp_conversation_assignments FOR DELETE
  USING (account_id = get_user_account_id());

-- RLS Policies for zapp_transfers
CREATE POLICY "Users can view transfers in their account"
  ON public.zapp_transfers FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert transfers in their account"
  ON public.zapp_transfers FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

-- Create indexes for performance
CREATE INDEX idx_zapp_agents_account ON public.zapp_agents(account_id);
CREATE INDEX idx_zapp_agents_user ON public.zapp_agents(user_id);
CREATE INDEX idx_zapp_agents_department ON public.zapp_agents(department_id);
CREATE INDEX idx_zapp_agents_online ON public.zapp_agents(account_id, is_online, is_active);

CREATE INDEX idx_zapp_assignments_account ON public.zapp_conversation_assignments(account_id);
CREATE INDEX idx_zapp_assignments_agent ON public.zapp_conversation_assignments(agent_id);
CREATE INDEX idx_zapp_assignments_status ON public.zapp_conversation_assignments(account_id, status);
CREATE INDEX idx_zapp_assignments_conversation ON public.zapp_conversation_assignments(conversation_id);

CREATE INDEX idx_zapp_transfers_conversation ON public.zapp_transfers(conversation_id);

-- Create trigger for updated_at
CREATE TRIGGER update_zapp_departments_updated_at
  BEFORE UPDATE ON public.zapp_departments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_zapp_agents_updated_at
  BEFORE UPDATE ON public.zapp_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_zapp_assignments_updated_at
  BEFORE UPDATE ON public.zapp_conversation_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();