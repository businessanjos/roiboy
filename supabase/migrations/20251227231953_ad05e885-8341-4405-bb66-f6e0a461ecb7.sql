
-- Create function to create default financial categories for new accounts
CREATE OR REPLACE FUNCTION public.create_default_financial_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.financial_categories (account_id, name, type, color, dre_group, display_order) VALUES
  -- RECEITA OPERACIONAL BRUTA
  (NEW.id, 'Prestação de Serviços à Vista', 'income', '#22c55e', 'gross_revenue', 1),
  (NEW.id, 'Vendas de Produtos à Vista', 'income', '#22c55e', 'gross_revenue', 2),
  (NEW.id, 'Vendas à Prazo - Produto A', 'income', '#22c55e', 'gross_revenue', 3),
  (NEW.id, 'Vendas à Prazo - Produto B', 'income', '#22c55e', 'gross_revenue', 4),
  (NEW.id, 'Vendas à Prazo - Produto C', 'income', '#22c55e', 'gross_revenue', 5),
  (NEW.id, 'Outras Receitas Operacionais', 'income', '#22c55e', 'gross_revenue', 6),

  -- DEDUÇÕES DA RECEITA BRUTA
  (NEW.id, 'Devoluções/Distratos/Cancelamentos', 'expense', '#ef4444', 'deductions', 10),
  (NEW.id, 'Devoluções/Distratos por Acordo', 'expense', '#ef4444', 'deductions', 11),
  (NEW.id, 'Devoluções/Distratos por Demissão', 'expense', '#ef4444', 'deductions', 12),
  (NEW.id, 'ISS', 'expense', '#ef4444', 'deductions', 13),
  (NEW.id, 'PIS', 'expense', '#ef4444', 'deductions', 14),
  (NEW.id, 'COFINS', 'expense', '#ef4444', 'deductions', 15),
  (NEW.id, 'PIS/COFINS/IR Fonte', 'expense', '#ef4444', 'deductions', 16),

  -- DESPESAS COM PESSOAL
  (NEW.id, '13º Salário', 'expense', '#f97316', 'personnel', 20),
  (NEW.id, 'Assistência Médica', 'expense', '#f97316', 'personnel', 21),
  (NEW.id, 'Confraternização', 'expense', '#f97316', 'personnel', 22),
  (NEW.id, 'Contribuição Sindical', 'expense', '#f97316', 'personnel', 23),
  (NEW.id, 'Estagiários', 'expense', '#f97316', 'personnel', 24),
  (NEW.id, 'Farmácia', 'expense', '#f97316', 'personnel', 25),
  (NEW.id, 'Férias', 'expense', '#f97316', 'personnel', 26),
  (NEW.id, 'FGTS', 'expense', '#f97316', 'personnel', 27),
  (NEW.id, 'INSS', 'expense', '#f97316', 'personnel', 28),
  (NEW.id, 'INSS Patronal', 'expense', '#f97316', 'personnel', 29),
  (NEW.id, 'Prêmios e Gratificações', 'expense', '#f97316', 'personnel', 30),
  (NEW.id, 'Recrutamento e Seleção', 'expense', '#f97316', 'personnel', 31),
  (NEW.id, 'Rescisões', 'expense', '#f97316', 'personnel', 32),
  (NEW.id, 'Salários e Ordenados', 'expense', '#f97316', 'personnel', 33),
  (NEW.id, 'Saúde Ocupacional/Exames', 'expense', '#f97316', 'personnel', 34),
  (NEW.id, 'Seguro de Vida', 'expense', '#f97316', 'personnel', 35),
  (NEW.id, 'Uniformes', 'expense', '#f97316', 'personnel', 36),
  (NEW.id, 'Vale Refeição/Alimentação', 'expense', '#f97316', 'personnel', 37),
  (NEW.id, 'Vale Transporte', 'expense', '#f97316', 'personnel', 38),

  -- DESPESAS ADMINISTRATIVAS
  (NEW.id, 'Copa e Cozinha', 'expense', '#8b5cf6', 'administrative', 40),
  (NEW.id, 'Aluguéis de Imóveis', 'expense', '#8b5cf6', 'administrative', 41),
  (NEW.id, 'Aluguéis de Máquinas/Equipamentos', 'expense', '#8b5cf6', 'administrative', 42),
  (NEW.id, 'Assessorias', 'expense', '#8b5cf6', 'administrative', 43),
  (NEW.id, 'Correios', 'expense', '#8b5cf6', 'administrative', 44),
  (NEW.id, 'Cursos e Treinamentos', 'expense', '#8b5cf6', 'administrative', 45),
  (NEW.id, 'DIFAL/DSTDA/IRPJ', 'expense', '#8b5cf6', 'administrative', 46),
  (NEW.id, 'Doações', 'expense', '#8b5cf6', 'administrative', 47),
  (NEW.id, 'Embalagens', 'expense', '#8b5cf6', 'administrative', 48),
  (NEW.id, 'Energia Elétrica', 'expense', '#8b5cf6', 'administrative', 49),
  (NEW.id, 'Fretes', 'expense', '#8b5cf6', 'administrative', 50),
  (NEW.id, 'Honorários Contábeis', 'expense', '#8b5cf6', 'administrative', 51),
  (NEW.id, 'Informações Cadastro', 'expense', '#8b5cf6', 'administrative', 52),
  (NEW.id, 'Informática', 'expense', '#8b5cf6', 'administrative', 53),
  (NEW.id, 'IPTU/Alvará/Bombeiro', 'expense', '#8b5cf6', 'administrative', 54),
  (NEW.id, 'Limpeza/Jardinagem/Higiene', 'expense', '#8b5cf6', 'administrative', 55),
  (NEW.id, 'Manutenção Máquinas/Equipamentos', 'expense', '#8b5cf6', 'administrative', 56),
  (NEW.id, 'Manutenção Predial', 'expense', '#8b5cf6', 'administrative', 57),
  (NEW.id, 'Material de Escritório', 'expense', '#8b5cf6', 'administrative', 58),
  (NEW.id, 'Móvel e Utensílios', 'expense', '#8b5cf6', 'administrative', 59),
  (NEW.id, 'Outras Despesas Tributárias', 'expense', '#8b5cf6', 'administrative', 60),
  (NEW.id, 'Outras Despesas Administrativas', 'expense', '#8b5cf6', 'administrative', 61),
  (NEW.id, 'Refeições/Locomoções', 'expense', '#8b5cf6', 'administrative', 62),
  (NEW.id, 'Saneamento/Esgoto', 'expense', '#8b5cf6', 'administrative', 63),
  (NEW.id, 'Serviços de Segurança', 'expense', '#8b5cf6', 'administrative', 64),
  (NEW.id, 'Taxas e Emolumentos', 'expense', '#8b5cf6', 'administrative', 65),
  (NEW.id, 'Telefonia/Aplicativos', 'expense', '#8b5cf6', 'administrative', 66),

  -- DESPESAS COM VENDAS
  (NEW.id, 'Brindes', 'expense', '#ec4899', 'sales', 70),
  (NEW.id, 'Comissão sobre Vendas', 'expense', '#ec4899', 'sales', 71),
  (NEW.id, 'Feiras e Eventos', 'expense', '#ec4899', 'sales', 72),
  (NEW.id, 'Hospedagem/Refeições', 'expense', '#ec4899', 'sales', 73),
  (NEW.id, 'Locações Espaços/Equipamentos', 'expense', '#ec4899', 'sales', 74),
  (NEW.id, 'Marketing e Propaganda', 'expense', '#ec4899', 'sales', 75),
  (NEW.id, 'Royalties', 'expense', '#ec4899', 'sales', 76),
  (NEW.id, 'Viagens/Passagens', 'expense', '#ec4899', 'sales', 77),

  -- RECEITAS FINANCEIRAS
  (NEW.id, 'Juros Recebidos', 'income', '#10b981', 'financial_income', 80),
  (NEW.id, 'Multas/Rescisões Recebidas', 'income', '#10b981', 'financial_income', 81),
  (NEW.id, 'Outras Receitas Financeiras', 'income', '#10b981', 'financial_income', 82),
  (NEW.id, 'Rendimentos Aplicações Financeiras', 'income', '#10b981', 'financial_income', 83),

  -- DESPESAS FINANCEIRAS
  (NEW.id, 'Tarifas de Cartão Crédito', 'expense', '#dc2626', 'financial_expenses', 90),
  (NEW.id, 'IOF', 'expense', '#dc2626', 'financial_expenses', 91),
  (NEW.id, 'Descontos Concedidos', 'expense', '#dc2626', 'financial_expenses', 92),
  (NEW.id, 'Outras Despesas Financeiras', 'expense', '#dc2626', 'financial_expenses', 93),
  (NEW.id, 'Tarifas Bancárias', 'expense', '#dc2626', 'financial_expenses', 94),

  -- IMPOSTOS SOBRE LUCRO
  (NEW.id, 'IRPJ', 'expense', '#991b1b', 'taxes', 100),
  (NEW.id, 'CSLL', 'expense', '#991b1b', 'taxes', 101);

  RETURN NEW;
END;
$function$;

-- Create trigger to auto-create default financial categories when account is created
CREATE TRIGGER create_default_financial_categories_trigger
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_financial_categories();
