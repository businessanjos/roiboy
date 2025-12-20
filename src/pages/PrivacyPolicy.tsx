import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-muted-foreground mb-8">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introdução</h2>
            <p className="text-muted-foreground">
              Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e 
              protegemos suas informações pessoais. Estamos comprometidos com a proteção 
              da sua privacidade e em conformidade com a Lei Geral de Proteção de Dados (LGPD).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Dados Coletados</h2>
            <p className="text-muted-foreground mb-2">Coletamos os seguintes tipos de dados:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li><strong>Dados de cadastro:</strong> nome, e-mail, telefone, CPF/CNPJ, endereço</li>
              <li><strong>Dados de uso:</strong> interações com a plataforma, logs de acesso</li>
              <li><strong>Dados de pagamento:</strong> informações de faturamento (processadas por terceiros)</li>
              <li><strong>Dados de clientes:</strong> informações dos seus clientes inseridas na plataforma</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Finalidade do Tratamento</h2>
            <p className="text-muted-foreground mb-2">Utilizamos seus dados para:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Fornecer e melhorar nossos serviços</li>
              <li>Processar pagamentos e gerenciar assinaturas</li>
              <li>Enviar comunicações sobre o serviço</li>
              <li>Cumprir obrigações legais</li>
              <li>Prevenir fraudes e garantir segurança</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Base Legal</h2>
            <p className="text-muted-foreground">
              O tratamento de dados é realizado com base no consentimento, execução de contrato, 
              cumprimento de obrigação legal e interesse legítimo, conforme aplicável a cada 
              situação específica.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Compartilhamento de Dados</h2>
            <p className="text-muted-foreground mb-2">Podemos compartilhar dados com:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li><strong>Processadores de pagamento:</strong> para processar transações</li>
              <li><strong>Provedores de serviço:</strong> hospedagem, e-mail, analytics</li>
              <li><strong>Autoridades:</strong> quando exigido por lei</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Não vendemos seus dados pessoais a terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Segurança dos Dados</h2>
            <p className="text-muted-foreground">
              Implementamos medidas de segurança técnicas e organizacionais para proteger 
              seus dados, incluindo criptografia, controle de acesso e monitoramento contínuo. 
              Nossos servidores estão protegidos por firewalls e sistemas de detecção de intrusão.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Retenção de Dados</h2>
            <p className="text-muted-foreground">
              Mantemos seus dados pelo tempo necessário para fornecer os serviços e cumprir 
              obrigações legais. Após o encerramento da conta, os dados são mantidos por até 
              5 anos para fins fiscais e legais, sendo então anonimizados ou excluídos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Seus Direitos</h2>
            <p className="text-muted-foreground mb-2">Conforme a LGPD, você tem direito a:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Confirmar a existência de tratamento de dados</li>
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos ou desatualizados</li>
              <li>Anonimização, bloqueio ou eliminação de dados</li>
              <li>Portabilidade dos dados</li>
              <li>Revogar consentimento</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Cookies</h2>
            <p className="text-muted-foreground">
              Utilizamos cookies essenciais para o funcionamento da plataforma e cookies 
              analíticos para melhorar nossos serviços. Você pode gerenciar suas preferências 
              de cookies nas configurações do navegador.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Transferência Internacional</h2>
            <p className="text-muted-foreground">
              Seus dados podem ser processados em servidores localizados fora do Brasil. 
              Garantimos que estas transferências são realizadas com proteções adequadas 
              conforme a legislação aplicável.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Alterações nesta Política</h2>
            <p className="text-muted-foreground">
              Podemos atualizar esta política periodicamente. Alterações significativas serão 
              comunicadas por e-mail ou através da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Contato do Encarregado (DPO)</h2>
            <p className="text-muted-foreground">
              Para exercer seus direitos ou esclarecer dúvidas sobre esta política, 
              entre em contato com nosso Encarregado de Proteção de Dados através 
              do suporte da plataforma.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}