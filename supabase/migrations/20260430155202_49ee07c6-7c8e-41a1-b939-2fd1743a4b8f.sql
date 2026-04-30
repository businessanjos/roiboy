UPDATE public.contract_templates SET content_html = '<div class="contract-document"><style>
/* ============================================================
   RYKAS MENTORING — CONTRATO PREMIUM PRETO & BRANCO
   Visual Law / Legal Design — paleta monocromática
   ============================================================ */
@import url(''https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@400;500;600&display=swap'');

.contract-document{
  --ink:#000000;
  --ink-2:#111111;
  --muted:#6B6B70;
  --muted-2:#9A9A9F;
  --line:#E5E5E5;
  --line-2:#D1D1D1;
  --paper:#FFFFFF;
  --soft:#F5F5F5;
  font-family: ''Geist'', ''Inter'', system-ui, -apple-system, BlinkMacSystemFont, sans-serif; font-feature-settings: ''ss01'', ''cv11'';
  color:var(--ink);
  background:var(--paper);
  line-height:1.7;
  font-size:11pt;
  letter-spacing:.005em;
  font-weight:400;
}
.contract-document *{box-sizing:border-box;}

.rk-page{ background:#fff; padding:64px 72px; border:1px solid var(--line); margin-bottom:24px; position:relative; }

.rk-cover{ padding:0; border:none; overflow:hidden; background:#fff; }
.rk-cover-top{ background:#000; color:#fff; padding:96px 72px 72px; position:relative; }
.rk-cover-mark{ display:flex; align-items:center; gap:14px; margin-bottom:96px; }
.rk-cover-mark .dot{ width:10px; height:10px; background:#fff; border-radius:50%; }
.rk-cover-mark .label{ font-size:9pt; font-weight:600; letter-spacing:.4em; text-transform:uppercase; color:#fff; }
.rk-cover-eyebrow{ font-size:9pt; font-weight:500; letter-spacing:.4em; text-transform:uppercase; color:#fff; opacity:.65; margin-bottom:28px; }
.rk-cover h1{ font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, Georgia, serif; font-size:54pt; line-height:1.02; font-weight:700; margin:0 0 24px; letter-spacing:-.02em; color:#fff; }
.rk-cover h1 em{ font-style:italic; font-weight:500; }
.rk-cover-sub{ font-size:11pt; line-height:1.6; color:#fff; opacity:.8; max-width:520px; margin:0 0 40px; }
.rk-cover-rule{ width:64px; height:2px; background:#fff; margin-bottom:36px; }
.rk-cover-bottom{ background:#fff; padding:48px 72px 72px; }
.rk-cover-meta{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:32px 48px; margin-bottom:48px; }
.rk-cover-meta .item .k{ font-size:8pt; font-weight:600; letter-spacing:.28em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
.rk-cover-meta .item .v{ font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:14pt; font-weight:600; color:var(--ink); line-height:1.3; }
.rk-cover-footer{ display:flex; justify-content:space-between; align-items:center; padding-top:24px; border-top:1px solid var(--ink); font-size:8.5pt; letter-spacing:.28em; text-transform:uppercase; color:var(--ink); }

.rk-toc{ margin-bottom:56px; }
.rk-toc h3{ font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:9pt; font-weight:600; letter-spacing:.4em; text-transform:uppercase; color:var(--ink); margin:0 0 24px; padding-bottom:14px; border-bottom:2px solid var(--ink); }
.rk-toc ol{ list-style:none; counter-reset:toc; padding:0; margin:0; }
.rk-toc ol li{ counter-increment:toc; display:flex; align-items:baseline; gap:14px; padding:14px 0; border-bottom:1px solid var(--line); font-size:10.5pt; }
.rk-toc ol li::before{ content:counter(toc, decimal-leading-zero); font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:13pt; font-weight:600; color:var(--ink); min-width:36px; }
.rk-toc ol li .t{ flex:1; color:var(--ink); font-weight:500; }
.rk-toc ol li .p{ font-size:9pt; letter-spacing:.2em; color:var(--muted); }

.rk-section{ margin-bottom:48px; }
.rk-section-head{ display:flex; align-items:flex-start; gap:24px; padding-bottom:20px; border-bottom:2px solid var(--ink); margin-bottom:28px; }
.rk-section-num{ font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:42pt; font-weight:700; line-height:1; color:var(--ink); letter-spacing:-.02em; }
.rk-section-titles{ flex:1; }
.rk-section-titles .eyebrow{ font-size:8.5pt; font-weight:600; letter-spacing:.32em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
.rk-section-titles h2{ font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:24pt; font-weight:700; margin:0; line-height:1.15; color:var(--ink); letter-spacing:-.015em; }

.contract-document p{ margin:0 0 14px; color:var(--ink-2); text-align:justify; }
.contract-document strong{ color:var(--ink); font-weight:600; }

.rk-clause{ display:grid; grid-template-columns:84px 1fr; gap:18px; padding:14px 0; border-bottom:1px solid var(--line); }
.rk-clause:last-child{ border-bottom:none; }
.rk-clause-num{ font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:11pt; font-style:italic; font-weight:600; color:var(--ink); padding-top:2px; }
.rk-clause p{ margin:0; }

.rk-parties{ display:grid; grid-template-columns:1fr 1fr; gap:24px; margin:24px 0; }
.rk-party{ border:1px solid var(--ink); padding:24px; }
.rk-party .role{ font-size:8pt; font-weight:600; letter-spacing:.32em; text-transform:uppercase; color:#fff; background:#000; padding:6px 10px; display:inline-block; margin-bottom:14px; }
.rk-party .name{ font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:18pt; font-weight:600; color:var(--ink); margin-bottom:14px; line-height:1.2; }
.rk-party dl{ margin:0; display:grid; grid-template-columns:auto 1fr; gap:6px 14px; }
.rk-party dt{ font-size:8pt; font-weight:600; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); padding-top:2px; }
.rk-party dd{ margin:0; font-size:9.5pt; color:var(--ink-2); }

.rk-pullquote{ font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:14pt; font-style:italic; font-weight:500; line-height:1.45; color:var(--ink); border-left:3px solid var(--ink); padding:8px 0 8px 22px; margin:24px 0; max-width:80%; }

.rk-pillars{ display:grid; grid-template-columns:repeat(4,1fr); gap:0; border:1px solid var(--ink); margin:24px 0; }
.rk-pillar{ padding:22px 20px; border-right:1px solid var(--line); position:relative; background:#fff; }
.rk-pillar:last-child{ border-right:none; }
.rk-pillar .num{ font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:24pt; font-weight:700; color:var(--ink); line-height:1; margin-bottom:12px; }
.rk-pillar .name{ font-size:9pt; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:var(--ink); margin-bottom:8px; }
.rk-pillar .desc{ font-size:9.5pt; color:var(--muted); line-height:1.5; }

.rk-hero{ background:#000; color:#fff; padding:40px 36px; margin:24px 0; }
.rk-hero .label{ font-size:8.5pt; font-weight:600; letter-spacing:.4em; text-transform:uppercase; color:#fff; opacity:.7; margin-bottom:16px; }
.rk-hero .total{ font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:42pt; font-weight:700; color:#fff; line-height:1; letter-spacing:-.02em; margin-bottom:8px; }
.rk-hero .total-words{ font-style:italic; font-size:10.5pt; color:#fff; opacity:.75; margin-bottom:28px; }
.rk-hero-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:24px; padding-top:24px; border-top:1px solid rgba(255,255,255,.25); }
.rk-hero-grid .k{ font-size:8pt; font-weight:600; letter-spacing:.28em; text-transform:uppercase; color:#fff; opacity:.7; margin-bottom:6px; }
.rk-hero-grid .v{ font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:14pt; font-weight:600; color:#fff; }

.rk-table{ width:100%; border-collapse:collapse; margin:20px 0; font-size:10pt; }
.rk-table thead th{ text-align:left; font-size:8.5pt; font-weight:600; letter-spacing:.24em; text-transform:uppercase; color:#fff; background:#000; padding:14px 16px; border:none; }
.rk-table tbody td{ padding:18px 16px; border-bottom:1px solid var(--line); vertical-align:top; color:var(--ink-2); }
.rk-table tbody tr:last-child td{ border-bottom:1px solid var(--ink); }
.rk-table .col-cause{ font-weight:600; color:var(--ink); width:42%; }
.rk-table .col-penalty{ font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:15pt; font-weight:700; color:var(--ink); width:18%; letter-spacing:-.01em; }
.rk-table .col-base{ color:var(--muted); font-size:9.5pt; }

.rk-notice{ margin:24px 0; padding:22px 24px; border:1px solid var(--ink); background:#fff; display:grid; grid-template-columns:auto 1fr; gap:20px; align-items:start; }
.rk-notice .icon{ width:40px; height:40px; background:#000; color:#fff; display:flex; align-items:center; justify-content:center; font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:20pt; font-weight:700; line-height:1; flex-shrink:0; }
.rk-notice .body .t{ font-size:8.5pt; font-weight:700; letter-spacing:.28em; text-transform:uppercase; color:var(--ink); margin-bottom:8px; }
.rk-notice .body p{ margin:0; font-size:10pt; color:var(--ink-2); }

.rk-grid-2{ display:grid; grid-template-columns:1fr 1fr; gap:18px; margin:20px 0; }
.rk-card{ background:#fff; border:1px solid var(--ink); padding:24px; }
.rk-card .h{ font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:16pt; font-weight:700; color:var(--ink); margin-bottom:12px; letter-spacing:-.01em; padding-bottom:10px; border-bottom:1px solid var(--line); }
.rk-card p{ margin:0; font-size:10pt; color:var(--ink-2); }

.rk-sign-block{ margin-top:64px; padding-top:40px; border-top:2px solid var(--ink); }
.rk-sign-intro{ font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:13pt; font-style:italic; color:var(--ink-2); text-align:center; margin-bottom:56px; }
.rk-sign-grid{ display:grid; grid-template-columns:1fr 1fr; gap:48px; margin-bottom:48px; }
.rk-sign{ text-align:center; }
.rk-sign .line{ border-top:1.5px solid var(--ink); margin-bottom:14px; padding-top:14px; }
.rk-sign .role{ font-size:8.5pt; font-weight:700; letter-spacing:.32em; text-transform:uppercase; color:var(--ink); margin-bottom:6px; }
.rk-sign .name{ font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:14pt; font-weight:700; color:var(--ink); letter-spacing:-.005em; }
.rk-sign .doc{ font-size:9pt; color:var(--muted); margin-top:6px; }

.rk-footer{ margin-top:48px; padding-top:24px; border-top:1px solid var(--ink); display:flex; justify-content:space-between; align-items:center; font-size:8.5pt; letter-spacing:.2em; text-transform:uppercase; color:var(--muted); }
.rk-footer .brand{ font-family:''Geist'', ''Inter'', system-ui, -apple-system, sans-serif, serif; font-size:13pt; font-style:italic; font-weight:700; letter-spacing:.04em; text-transform:none; color:var(--ink); }

@media print{
  .contract-document{ background:#fff; }
  .rk-page{ box-shadow:none; border:none; padding:32mm 24mm; }
  .rk-cover-top, .rk-hero, .rk-table thead th, .rk-notice .icon, .rk-party .role{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .rk-section{ page-break-inside:avoid; }
}
</style>

<div class="rk-page rk-cover">
  <div class="rk-cover-top">
    <div class="rk-cover-mark"><span class="dot"></span><span class="label">Rykas Mentoring</span></div>
    <div class="rk-cover-eyebrow">Instrumento Particular</div>
    <h1>Contrato de<br/>Prestação de<br/>Serviços <em>de Mentoria</em></h1>
    <p class="rk-cover-sub">Programa estruturado pela metodologia exclusiva 3P1R&reg; — Posicionamento, Performance, Procedimento e Resultado.</p>
    <div class="rk-cover-rule"></div>
  </div>
  <div class="rk-cover-bottom">
    <div class="rk-cover-meta">
      <div class="item"><div class="k">Contratante</div><div class="v">{{CLIENT_NAME}}</div></div>
      <div class="item"><div class="k">Documento</div><div class="v">{{CLIENT_DOCUMENT}}</div></div>
      <div class="item"><div class="k">Programa</div><div class="v">{{PRODUCT_NAME}}</div></div>
      <div class="item"><div class="k">Investimento Total</div><div class="v">{{TOTAL_VALUE}}</div></div>
      <div class="item"><div class="k">Vigência</div><div class="v">{{CONTRACT_DURATION}}</div></div>
      <div class="item"><div class="k">Data de Celebração</div><div class="v">{{CONTRACT_DATE}}</div></div>
    </div>
    <div class="rk-cover-footer"><span>Confidencial &middot; Documento Particular</span><span>Anno MMXXVI</span></div>
  </div>
</div>

<div class="rk-page">
  <div class="rk-toc">
    <h3>Sumário</h3>
    <ol>
      <li><span class="t">Das Partes Contratantes</span><span class="p">02</span></li>
      <li><span class="t">Do Objeto e da Metodologia 3P1R&reg;</span><span class="p">03</span></li>
      <li><span class="t">Do Procedimento e da Execução</span><span class="p">04</span></li>
      <li><span class="t">Do Investimento e Forma de Pagamento</span><span class="p">05</span></li>
      <li><span class="t">Das Penalidades e Multas</span><span class="p">06</span></li>
      <li><span class="t">Da Vigência e Rescisão</span><span class="p">07</span></li>
      <li><span class="t">Das Disposições Gerais e do Foro</span><span class="p">08</span></li>
    </ol>
  </div>

  <div class="rk-section">
    <div class="rk-section-head"><div class="rk-section-num">I</div><div class="rk-section-titles"><div class="eyebrow">Preâmbulo</div><h2>Das Partes Contratantes</h2></div></div>
    <p>Pelo presente instrumento particular de prestação de serviços, de um lado, doravante denominada <strong>CONTRATADA</strong>, e, de outro lado, doravante denominado(a) <strong>CONTRATANTE</strong>, têm entre si, justo e contratado, o quanto segue, mediante as cláusulas e condições a seguir estabelecidas.</p>
    <div class="rk-parties">
      <div class="rk-party">
        <div class="role">Contratada</div>
        <div class="name">Rykas Mentoring</div>
        <dl><dt>CNPJ</dt><dd>{{COMPANY_CNPJ}}</dd><dt>Endereço</dt><dd>{{COMPANY_ADDRESS}}</dd><dt>Representante</dt><dd>{{COMPANY_REPRESENTATIVE}}</dd></dl>
      </div>
      <div class="rk-party">
        <div class="role">Contratante</div>
        <div class="name">{{CLIENT_NAME}}</div>
        <dl><dt>CPF/CNPJ</dt><dd>{{CLIENT_DOCUMENT}}</dd><dt>Endereço</dt><dd>{{CLIENT_ADDRESS}}</dd><dt>E-mail</dt><dd>{{CLIENT_EMAIL}}</dd><dt>Telefone</dt><dd>{{CLIENT_PHONE}}</dd></dl>
      </div>
     <div class="rk-party" style="grid-column: 1 / -1;">
       <div class="role">Faturamento &middot; Nota Fiscal</div>
       <div class="name">{{RAZAO_SOCIAL}}</div>
       <dl><dt>Nome Fantasia</dt><dd>{{NOME_FANTASIA}}</dd><dt>CNPJ/CPF</dt><dd>{{CNPJ}}</dd><dt>Insc. Municipal</dt><dd>{{INSCRICAO_MUNICIPAL}}</dd><dt>Insc. Estadual</dt><dd>{{INSCRICAO_ESTADUAL}}</dd><dt>Endereço</dt><dd>{{RUA}}, {{NUMERO}} {{COMPLEMENTO}} &mdash; {{BAIRRO}}, {{CIDADE}}/{{ESTADO}} &mdash; CEP {{CEP}}</dd><dt>E-mail NF</dt><dd>{{EMAIL}}</dd><dt>Telefone</dt><dd>{{CELULAR}}</dd></dl>
     </div>
   </div>
    <div class="rk-pullquote">As partes declaram, de comum acordo e boa-fé, ter pleno conhecimento e capacidade jurídica para celebrar o presente contrato, comprometendo-se a cumpri-lo integralmente.</div>
  </div>

  <div class="rk-section">
    <div class="rk-section-head"><div class="rk-section-num">II</div><div class="rk-section-titles"><div class="eyebrow">Cláusula Primeira</div><h2>Do Objeto &amp; da Metodologia</h2></div></div>
    <p>O presente contrato tem por objeto a prestação, pela <strong>CONTRATADA</strong>, dos serviços de mentoria empresarial denominados <strong>{{PRODUCT_NAME}}</strong>, estruturados sobre a metodologia proprietária <strong>3P1R&reg;</strong>, conforme detalhado a seguir.</p>
    <div class="rk-pillars">
      <div class="rk-pillar"><div class="num">01</div><div class="name">Posicionamento</div><div class="desc">Diagnóstico estratégico de mercado, marca e proposta de valor.</div></div>
      <div class="rk-pillar"><div class="num">02</div><div class="name">Performance</div><div class="desc">Execução comercial, gestão de funil e tração de receita.</div></div>
      <div class="rk-pillar"><div class="num">03</div><div class="name">Procedimento</div><div class="desc">Padronização operacional e governança de processos.</div></div>
      <div class="rk-pillar"><div class="num">04</div><div class="name">Resultado</div><div class="desc">Indicadores, escalabilidade e sustentabilidade financeira.</div></div>
    </div>
    <div class="rk-clause"><span class="rk-clause-num">§ 1º</span><p>Os serviços contratados compreendem encontros estruturados, materiais de apoio, acesso a comunidade exclusiva e acompanhamento técnico durante a vigência prevista neste instrumento.</p></div>
    <div class="rk-clause"><span class="rk-clause-num">§ 2º</span><p>A metodologia 3P1R&reg; constitui propriedade intelectual exclusiva da <strong>CONTRATADA</strong>, sendo vedada sua reprodução, comercialização ou cessão a terceiros, sob qualquer forma, conforme detalhado na Cláusula Sétima.</p></div>
  </div>

  <div class="rk-section">
    <div class="rk-section-head"><div class="rk-section-num">III</div><div class="rk-section-titles"><div class="eyebrow">Cláusula Segunda</div><h2>Do Procedimento &amp; Execução</h2></div></div>
    <p>A execução dos serviços observará o cronograma definido pela <strong>CONTRATADA</strong>, sendo de inteira responsabilidade do(a) <strong>CONTRATANTE</strong> a presença, o engajamento e a aplicação dos conteúdos transmitidos.</p>
    <div class="rk-clause"><span class="rk-clause-num">§ 1º</span><p>Os encontros poderão ser realizados em formato presencial, remoto ou híbrido, conforme planejamento divulgado previamente.</p></div>
    <div class="rk-clause"><span class="rk-clause-num">§ 2º</span><p>Eventuais ausências do(a) <strong>CONTRATANTE</strong> não ensejarão reposição obrigatória, ressalvadas as hipóteses expressamente acordadas por escrito entre as partes.</p></div>
    <div class="rk-clause"><span class="rk-clause-num">§ 3º</span><p>Os materiais disponibilizados são de uso pessoal e intransferível, vedada sua divulgação pública sem autorização formal.</p></div>
    <div class="rk-notice">
      <div class="icon">!</div>
      <div class="body"><div class="t">Obrigação de Meio</div><p>A presente prestação de serviços configura obrigação de meio, e não de resultado. A <strong>CONTRATADA</strong> compromete-se a empregar seu melhor esforço técnico e metodológico, sem garantia de retorno financeiro específico, o qual depende da aplicação efetiva pelo(a) <strong>CONTRATANTE</strong>.</p></div>
    </div>
  </div>
</div>

<div class="rk-page">
  <div class="rk-section">
    <div class="rk-section-head"><div class="rk-section-num">IV</div><div class="rk-section-titles"><div class="eyebrow">Cláusula Terceira</div><h2>Do Investimento &amp; Pagamento</h2></div></div>
    <p>Pela prestação dos serviços ora contratados, o(a) <strong>CONTRATANTE</strong> pagará à <strong>CONTRATADA</strong> o valor total descrito a seguir, na forma e nas condições aqui estabelecidas.</p>
    <div class="rk-hero">
      <div class="label">Investimento Total</div>
      <div class="total">{{TOTAL_VALUE}}</div>
      <div class="total-words">{{TOTAL_VALUE_WORDS}}</div>
      <div class="rk-hero-grid">
        <div><div class="k">Entrada</div><div class="v">{{DOWN_PAYMENT}}</div></div>
        <div><div class="k">Parcelas</div><div class="v">{{INSTALLMENTS}}</div></div>
        <div><div class="k">Vencimento</div><div class="v">{{DUE_DATE}}</div></div>
      </div>
    </div>
    <div class="rk-clause"><span class="rk-clause-num">§ 1º</span><p>Os pagamentos serão realizados por meio de <strong>{{PAYMENT_METHOD}}</strong>, observadas as datas de vencimento acordadas.</p></div>
    <div class="rk-clause"><span class="rk-clause-num">§ 2º</span><p>O atraso no pagamento de qualquer parcela acarretará multa de 2% (dois por cento) sobre o valor em atraso, juros de mora de 1% (um por cento) ao mês e correção monetária pelo IPCA/IBGE.</p></div>
    <div class="rk-clause"><span class="rk-clause-num">§ 3º</span><p>O inadimplemento por período superior a 30 (trinta) dias autoriza a <strong>CONTRATADA</strong> a suspender, imediatamente, o acesso aos serviços, sem prejuízo da cobrança integral dos valores devidos.</p></div>
  </div>

  <div class="rk-section">
    <div class="rk-section-head"><div class="rk-section-num">V</div><div class="rk-section-titles"><div class="eyebrow">Cláusula Quarta</div><h2>Das Penalidades &amp; Multas</h2></div></div>
    <p>O descumprimento das obrigações pactuadas acarretará as penalidades a seguir relacionadas, sem prejuízo de eventual reparação por perdas e danos.</p>
    <table class="rk-table">
      <thead><tr><th>Hipótese</th><th>Penalidade</th><th>Base</th></tr></thead>
      <tbody>
        <tr><td class="col-cause">Cancelamento por iniciativa do Contratante</td><td class="col-penalty">30%</td><td class="col-base">Sobre o saldo remanescente do contrato</td></tr>
        <tr><td class="col-cause">Quebra de confidencialidade</td><td class="col-penalty">100%</td><td class="col-base">Do valor total do contrato, mais perdas e danos</td></tr>
        <tr><td class="col-cause">Reprodução não autorizada de conteúdo</td><td class="col-penalty">200%</td><td class="col-base">Do valor total do contrato</td></tr>
        <tr><td class="col-cause">Atraso no pagamento</td><td class="col-penalty">2% + 1% a.m.</td><td class="col-base">Multa + juros de mora sobre valor devido</td></tr>
      </tbody>
    </table>
    <div class="rk-pullquote">A cobrança das penalidades não exclui a possibilidade de reparação integral por danos materiais, morais e emergentes, na forma da legislação civil vigente.</div>
  </div>
</div>

<div class="rk-page">
  <div class="rk-section">
    <div class="rk-section-head"><div class="rk-section-num">VI</div><div class="rk-section-titles"><div class="eyebrow">Cláusulas Quinta &amp; Sexta</div><h2>Da Vigência &amp; Rescisão</h2></div></div>
    <p>O presente contrato vigorará pelo prazo de <strong>{{CONTRACT_DURATION}}</strong>, com início em <strong>{{START_DATE}}</strong> e término em <strong>{{END_DATE}}</strong>, podendo ser renovado mediante novo instrumento firmado entre as partes.</p>
    <div class="rk-grid-2">
      <div class="rk-card"><div class="h">Rescisão Imotivada</div><p>O(A) <strong>CONTRATANTE</strong> poderá rescindir o presente contrato a qualquer momento, mediante comunicação por escrito com 15 (quinze) dias de antecedência, sujeitando-se à multa rescisória prevista na Cláusula Quarta.</p></div>
      <div class="rk-card"><div class="h">Rescisão Motivada</div><p>A <strong>CONTRATADA</strong> poderá rescindir, de pleno direito, este contrato em caso de inadimplemento, quebra de confidencialidade ou conduta incompatível com o programa, sem prejuízo da cobrança dos valores devidos.</p></div>
    </div>
    <div class="rk-notice">
      <div class="icon">§</div>
      <div class="body"><div class="t">Direito de Arrependimento — Art. 49, CDC</div><p>Em contratações realizadas fora do estabelecimento comercial, fica assegurado ao(à) <strong>CONTRATANTE</strong> o direito de arrependimento no prazo de 7 (sete) dias corridos, contados da assinatura, com restituição integral dos valores eventualmente pagos.</p></div>
    </div>
  </div>

  <div class="rk-section">
    <div class="rk-section-head"><div class="rk-section-num">VII</div><div class="rk-section-titles"><div class="eyebrow">Cláusula Sétima</div><h2>Disposições Gerais &amp; Foro</h2></div></div>
    <div class="rk-clause"><span class="rk-clause-num">§ 1º</span><p><strong>Propriedade Intelectual.</strong> Todo conteúdo, metodologia, marcas e materiais disponibilizados são de propriedade exclusiva da <strong>CONTRATADA</strong>, sendo vedada qualquer forma de reprodução, distribuição ou utilização não autorizada.</p></div>
    <div class="rk-clause"><span class="rk-clause-num">§ 2º</span><p><strong>Proteção de Dados (LGPD).</strong> As partes comprometem-se a observar a Lei Geral de Proteção de Dados (Lei 13.709/2018), tratando os dados pessoais exclusivamente para as finalidades deste contrato.</p></div>
    <div class="rk-clause"><span class="rk-clause-num">§ 3º</span><p><strong>Direito de Imagem.</strong> O(A) <strong>CONTRATANTE</strong> autoriza, a título gratuito, o uso de sua imagem, voz e depoimentos em materiais promocionais da <strong>CONTRATADA</strong>, podendo revogar tal autorização mediante comunicação formal por escrito.</p></div>
    <div class="rk-clause"><span class="rk-clause-num">§ 4º</span><p><strong>Foro.</strong> Fica eleito o foro da Comarca de <strong>{{JURISDICTION}}</strong>, com renúncia expressa a qualquer outro, para dirimir controvérsias oriundas do presente contrato.</p></div>

    <div class="rk-sign-block">
      <div class="rk-sign-intro">E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em duas vias de igual teor e forma.</div>
      <p style="text-align:center; margin-bottom:48px; font-size:10pt; color:var(--muted); letter-spacing:.18em; text-transform:uppercase;">{{SIGNATURE_CITY}} &middot; {{SIGNATURE_DATE}}</p>
      <div class="rk-sign-grid">
        <div class="rk-sign"><div class="line"></div><div class="role">Contratada</div><div class="name">Rykas Mentoring</div><div class="doc">CNPJ {{COMPANY_CNPJ}}</div></div>
        <div class="rk-sign"><div class="line"></div><div class="role">Contratante</div><div class="name">{{CLIENT_NAME}}</div><div class="doc">{{CLIENT_DOCUMENT}}</div></div>
      </div>
      <div class="rk-sign-grid" style="margin-top:24px;">
        <div class="rk-sign"><div class="line"></div><div class="role">Testemunha 01</div><div class="name">&nbsp;</div><div class="doc">Nome &middot; CPF</div></div>
        <div class="rk-sign"><div class="line"></div><div class="role">Testemunha 02</div><div class="name">&nbsp;</div><div class="doc">Nome &middot; CPF</div></div>
      </div>
    </div>

    <div class="rk-footer">
      <span class="brand">Rykas Mentoring</span>
      <span>Documento Confidencial &middot; {{CONTRACT_DATE}}</span>
    </div>
  </div>
</div>
</div>', updated_at = now() WHERE id = '23a8cada-3181-4b92-bdf2-194e04083c39';