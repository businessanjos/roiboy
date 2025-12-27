export interface BrazilianBank {
  code: string;
  name: string;
  fullName: string;
}

export const brazilianBanks: BrazilianBank[] = [
  { code: "001", name: "Banco do Brasil", fullName: "Banco do Brasil S.A." },
  { code: "033", name: "Santander", fullName: "Banco Santander (Brasil) S.A." },
  { code: "104", name: "Caixa Econômica", fullName: "Caixa Econômica Federal" },
  { code: "237", name: "Bradesco", fullName: "Banco Bradesco S.A." },
  { code: "341", name: "Itaú", fullName: "Itaú Unibanco S.A." },
  { code: "260", name: "Nubank", fullName: "Nu Pagamentos S.A." },
  { code: "077", name: "Inter", fullName: "Banco Inter S.A." },
  { code: "756", name: "Sicoob", fullName: "Banco Cooperativo Sicoob S.A." },
  { code: "748", name: "Sicredi", fullName: "Banco Cooperativo Sicredi S.A." },
  { code: "422", name: "Safra", fullName: "Banco Safra S.A." },
  { code: "070", name: "BRB", fullName: "BRB - Banco de Brasília S.A." },
  { code: "246", name: "ABC Brasil", fullName: "Banco ABC Brasil S.A." },
  { code: "336", name: "C6 Bank", fullName: "C6 Bank" },
  { code: "290", name: "PagBank", fullName: "PagSeguro Internet S.A." },
  { code: "380", name: "PicPay", fullName: "PicPay Serviços S.A." },
  { code: "323", name: "Mercado Pago", fullName: "Mercado Pago" },
  { code: "212", name: "Original", fullName: "Banco Original S.A." },
  { code: "655", name: "Votorantim", fullName: "Banco Votorantim S.A." },
  { code: "208", name: "BTG Pactual", fullName: "Banco BTG Pactual S.A." },
  { code: "745", name: "Citibank", fullName: "Banco Citibank S.A." },
  { code: "399", name: "HSBC", fullName: "HSBC Bank Brasil S.A." },
  { code: "041", name: "Banrisul", fullName: "Banco do Estado do Rio Grande do Sul S.A." },
  { code: "004", name: "BNB", fullName: "Banco do Nordeste do Brasil S.A." },
  { code: "021", name: "Banestes", fullName: "Banco do Estado do Espírito Santo S.A." },
  { code: "047", name: "Banese", fullName: "Banco do Estado de Sergipe S.A." },
  { code: "037", name: "Banpará", fullName: "Banco do Estado do Pará S.A." },
  { code: "389", name: "Mercantil do Brasil", fullName: "Banco Mercantil do Brasil S.A." },
  { code: "633", name: "Rendimento", fullName: "Banco Rendimento S.A." },
  { code: "634", name: "Triângulo", fullName: "Banco Triângulo S.A." },
  { code: "637", name: "Sofisa", fullName: "Banco Sofisa S.A." },
  { code: "707", name: "Daycoval", fullName: "Banco Daycoval S.A." },
  { code: "739", name: "Cetelem", fullName: "Banco Cetelem S.A." },
  { code: "318", name: "BMG", fullName: "Banco BMG S.A." },
  { code: "320", name: "CCB Brasil", fullName: "China Construction Bank (Brasil)" },
  { code: "394", name: "Bradesco Financiamentos", fullName: "Banco Bradesco Financiamentos S.A." },
  { code: "136", name: "Unicred", fullName: "Unicred Central" },
  { code: "084", name: "Uniprime", fullName: "Uniprime Norte do Paraná" },
  { code: "623", name: "Pan", fullName: "Banco Pan S.A." },
  { code: "085", name: "Ailos", fullName: "Cooperativa Central de Crédito - Ailos" },
  { code: "403", name: "Cora", fullName: "Cora SCD S.A." },
  { code: "301", name: "BPP", fullName: "BPP Instituição de Pagamento S.A." },
  { code: "364", name: "Gerencianet", fullName: "Gerencianet Pagamentos do Brasil" },
  { code: "274", name: "Money Plus", fullName: "Money Plus SCMEPP" },
  { code: "383", name: "Juno", fullName: "Juno Pagamentos" },
  { code: "332", name: "Acesso", fullName: "Acesso Soluções de Pagamento S.A." },
  { code: "280", name: "Avista", fullName: "Avista S.A. Crédito, Financiamento e Investimento" },
  { code: "000", name: "Outro", fullName: "Outro banco não listado" },
];

export function findBankByCode(code: string): BrazilianBank | undefined {
  return brazilianBanks.find(b => b.code === code);
}

export function findBankByName(name: string): BrazilianBank | undefined {
  const lowerName = name.toLowerCase();
  return brazilianBanks.find(b => 
    b.name.toLowerCase().includes(lowerName) || 
    b.fullName.toLowerCase().includes(lowerName)
  );
}
