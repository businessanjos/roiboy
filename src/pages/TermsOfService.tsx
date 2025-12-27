import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/home">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">Termos de Uso</h1>
        <p className="text-muted-foreground mb-8">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Aceitação dos Termos</h2>
            <p className="text-muted-foreground">
              Ao acessar e utilizar nossos serviços, você concorda com estes Termos de Uso. 
              Se você não concordar com qualquer parte destes termos, não deverá usar nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Descrição do Serviço</h2>
            <p className="text-muted-foreground">
              Nossa plataforma oferece ferramentas de gestão de relacionamento com clientes, 
              incluindo CRM, análise de dados, gestão de eventos e integrações com outras plataformas. 
              O serviço é oferecido mediante assinatura mensal ou anual.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Cadastro e Conta</h2>
            <p className="text-muted-foreground">
              Para utilizar nossos serviços, você deve criar uma conta fornecendo informações 
              verdadeiras e completas. Você é responsável por manter a confidencialidade de sua 
              senha e por todas as atividades realizadas em sua conta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Período de Teste</h2>
            <p className="text-muted-foreground">
              Oferecemos um período de teste gratuito de 7 dias. Após o término do período de teste, 
              você deve assinar um plano pago para continuar utilizando os serviços. Durante o período 
              de teste, você terá acesso a todas as funcionalidades do plano selecionado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Pagamento e Faturamento</h2>
            <p className="text-muted-foreground">
              As assinaturas são cobradas de acordo com o plano selecionado (mensal ou anual). 
              O pagamento pode ser realizado via PIX, boleto bancário ou cartão de crédito. 
              A renovação é automática, a menos que você cancele antes da data de renovação.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Cancelamento</h2>
            <p className="text-muted-foreground">
              Você pode cancelar sua assinatura a qualquer momento. O cancelamento entra em vigor 
              ao final do período de faturamento atual. Não há reembolso para períodos parciais 
              de uso.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Uso Aceitável</h2>
            <p className="text-muted-foreground">
              Você concorda em não utilizar nossos serviços para atividades ilegais, fraudulentas 
              ou que violem direitos de terceiros. Reservamo-nos o direito de suspender ou cancelar 
              contas que violem estas políticas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Propriedade Intelectual</h2>
            <p className="text-muted-foreground">
              Todos os direitos de propriedade intelectual relacionados à plataforma pertencem 
              exclusivamente a nós. Você recebe uma licença limitada para uso pessoal ou 
              comercial conforme o plano contratado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Limitação de Responsabilidade</h2>
            <p className="text-muted-foreground">
              Nossos serviços são fornecidos "como estão". Não garantimos disponibilidade 
              ininterrupta ou ausência de erros. Nossa responsabilidade é limitada ao valor 
              pago pelo serviço nos últimos 12 meses.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Alterações nos Termos</h2>
            <p className="text-muted-foreground">
              Podemos atualizar estes termos periodicamente. Notificaremos sobre alterações 
              significativas por e-mail ou através da plataforma. O uso continuado após as 
              alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contato</h2>
            <p className="text-muted-foreground">
              Para dúvidas sobre estes Termos de Uso, entre em contato através do suporte 
              da plataforma ou pelo e-mail disponível em nossa página de contato.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}