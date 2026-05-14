import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail } from "lucide-react";

export default function DataDeletion() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/auth">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">Data Deletion / Exclusão de Dados</h1>
        <p className="text-muted-foreground mb-8">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">How to request data deletion</h2>
            <p className="text-muted-foreground">
              If you are a user of Roy (iamroy.app) and want to delete your personal data,
              including any data obtained through Meta / Facebook / WhatsApp Business
              integrations, please follow the instructions below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Como solicitar a exclusão dos seus dados</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                Envie um e-mail para{" "}
                <a href="mailto:contato@iamroy.app" className="text-primary underline">
                  contato@iamroy.app
                </a>{" "}
                com o assunto <strong>"Exclusão de Dados"</strong>.
              </li>
              <li>
                Inclua no corpo do e-mail: seu nome completo, telefone (com DDD/DDI) e
                e-mail cadastrado.
              </li>
              <li>
                Nossa equipe processará a solicitação em até <strong>30 dias</strong> e
                confirmará a remoção por e-mail.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">O que é excluído</h2>
            <p className="text-muted-foreground">
              Após a confirmação, removemos permanentemente: dados de cadastro, histórico
              de conversas (incluindo mensagens recebidas via WhatsApp/Meta), arquivos
              enviados, e quaisquer dados pessoais associados à sua conta. Dados retidos
              por obrigação legal (ex.: registros fiscais) serão mantidos apenas pelo
              período exigido por lei.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contato</h2>
            <p className="text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <a href="mailto:contato@iamroy.app" className="text-primary underline">
                contato@iamroy.app
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
