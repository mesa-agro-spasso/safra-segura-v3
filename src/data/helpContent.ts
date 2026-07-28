export type HelpBlock =
  | { type: 'p'; text: string }
  | { type: 'callout'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'list'; items: string[] }
  | { type: 'h3'; text: string };

export interface HelpSection {
  id: string;
  title: string;
  route: string | null;
  blocks: HelpBlock[];
}

export const helpSections: HelpSection[] = [
  {
    id: 'acesso',
    title: '1. Acesso',
    route: null,
    blocks: [
      { type: 'p', text: 'Informe seu e-mail e senha e clique em Entrar.' },
      { type: 'h3', text: 'Cadastrar conta' },
      { type: 'p', text: 'Clique na aba Cadastrar, preencha nome, e-mail e senha. Após o cadastro, seu acesso ficará pendente de aprovação por um administrador.' },
      { type: 'h3', text: 'Recuperar senha' },
      { type: 'p', text: 'Clique em Esqueci minha senha e siga as instruções enviadas por e-mail.' },
    ],
  },
  {
    id: 'tabela-de-precos',
    title: '2. Tabela de Preços',
    route: '/',
    blocks: [
      { type: 'p', text: 'A Tabela de Preços exibe o preço de originação calculado para cada combinação de praça, commodity e vencimento, com base nos dados de mercado atuais.' },
      { type: 'callout', text: '→ Os preços exibidos aqui são gerados pelas combinações ativas. Para alterar praças, tickers ou datas de referência, acesse Configurações > Combinações.' },
      { type: 'p', text: 'Alertas de desatualização: se os dados de mercado estiverem desatualizados, o sistema exibe um aviso no topo. Clique em Atualizar Mercado antes de gerar a tabela. Os dados de mercado são gerenciados em Mercado > Bolsa.' },
      { type: 'p', text: 'Gerar Tabela: recalcula os preços com os dados de mercado atuais. O timestamp da última geração é exibido abaixo do título.' },
      { type: 'p', text: 'Filtros: filtre por praça e commodity. Exportar: exporta a tabela em Excel, PDF ou PNG.' },
      { type: 'table', headers: ['Coluna', 'Descrição'], rows: [
        ['Praça', 'Armazém de referência'],
        ['Commodity', 'Soja ou Milho'],
        ['Ticker', 'Contrato futuro de referência (ex: ZSK27, CCMF27)'],
        ['Recepção', 'Data estimada de recepção do grão'],
        ['Pagamento', 'Data de pagamento ao produtor'],
        ['Venda', 'Data de venda prevista'],
        ['Basis Alvo', 'Diferencial entre preço físico local e futuro de referência (R$/sc)'],
        ['Futuros (BRL)', 'Cotação do contrato futuro convertida para BRL/sc'],
        ['Câmbio', 'Taxa de câmbio USD/BRL utilizada no cálculo'],
        ['Preço Originação', 'Preço calculado para originação — o valor que pode ser ofertado ao produtor'],
      ]},
    ],
  },
  {
    id: 'mercado',
    title: '3. Mercado',
    route: '/mercado',
    blocks: [
      { type: 'p', text: 'Gestão dos dados de mercado utilizados nos cálculos do sistema.' },
      { type: 'h3', text: 'Aba Bolsa' },
      { type: 'p', text: 'Exibe câmbio USD/BRL e contratos futuros de Soja CBOT, Milho CBOT e Milho B3.' },
      { type: 'callout', text: '→ Os dados desta tela são usados diretamente na geração da Tabela de Preços. Mantenha-os atualizados antes de gerar a tabela.' },
      { type: 'table', headers: ['Coluna', 'Descrição'], rows: [
        ['Ticker', 'Código do contrato'],
        ['Vencimento', 'Data de vencimento do contrato'],
        ['Preço', 'Cotação do futuro (USD/bushel na CBOT · R$/sc na B3)'],
        ['NDF Estimado', 'Taxa de câmbio a termo estimada para o vencimento'],
        ['Spread', 'Diferencial entre NDF estimado e spot'],
        ['Atualizado', 'Tempo desde a última atualização e fonte (api = automático · manual = inserido manualmente)'],
      ]},
      { type: 'callout', text: '→ A quantidade de vencimentos exibidos por mercado é configurável em Configurações > Parâmetros.' },
      { type: 'list', items: [
        'Atualizar Mercados: atualiza futuros e câmbio via API',
        'Atualizar Tudo: atualiza todos os dados de mercado do sistema',
        '↺ (individual): atualiza apenas aquele contrato ou o câmbio',
        '✎ (edição manual): insere um valor manualmente quando a API não está disponível',
      ]},
      { type: 'h3', text: 'Aba Físico' },
      { type: 'p', text: 'A visualização de preços do mercado físico está temporariamente indisponível e será liberada em uma próxima etapa.' },
    ],
  },
  {
    id: 'configuracoes',
    title: '4. Configurações',
    route: '/configuracoes',
    blocks: [
      { type: 'p', text: 'Parâmetros estruturais do sistema.' },
      { type: 'h3', text: 'Armazéns' },
      { type: 'p', text: 'Cadastro dos armazéns operacionais com nome, abreviação, cidade, estado, tipo e status.' },
      { type: 'callout', text: '→ Os armazéns cadastrados aqui ficam disponíveis nas combinações e nos filtros de toda a plataforma.' },
      { type: 'p', text: 'Novo Armazém: cria um novo registro. ✎: edita os dados de um armazém existente.' },
      { type: 'h3', text: 'Combinações' },
      { type: 'p', text: 'Uma combinação define os parâmetros de precificação para uma praça: commodity, contrato futuro de referência (ticker), benchmark (CBOT ou B3), datas de venda e pagamento, método e o preço-alvo (input).' },
      { type: 'callout', text: '→ A Tabela de Preços é gerada com base nas combinações ativas. Para alterar um preço exibido na tabela, edite a combinação correspondente aqui.' },
      { type: 'p', text: 'Nova Combinação: cria uma nova combinação. Toggle ativo/inativo: inclui ou exclui da geração da tabela. ✎: edita os parâmetros. 🗑: remove a combinação.' },
      { type: 'h3', text: 'Parâmetros' },
      { type: 'table', headers: ['Parâmetro', 'Descrição'], rows: [
        ['Volatilidade Implícita (sigma)', 'Utilizada no modelo Black-76 para precificação teórica de opções. Valor decimal — ex: 0.25 = 25%. Configurável separadamente para Milho B3 e Soja CBOT.'],
        ['Lucro Alvo por Saca', 'Lucro desejado por saca (R$/sc), usado como referência nos cálculos de resultado.'],
        ['Spread de Execução', 'Folga aplicada para compensar o deslizamento na execução das ordens. Valor decimal — ex: 0.05 = 5%.'],
        ['Quantidade de contratos por mercado', 'Define quantos vencimentos (tickers) são buscados e exibidos nas tabelas de Soja CBOT, Milho CBOT e Milho B3 em Mercado > Bolsa.'],
      ]},
    ],
  },

  {
    id: 'aprovacoes',
    title: '5. Aprovações',
    route: '/aprovacoes',
    blocks: [
      { type: 'p', text: 'Fluxo de governança para itens que requerem múltiplas assinaturas antes de entrarem em vigor.' },
      { type: 'callout', text: '→ As funções que precisam assinar são definidas em Administração.' },
      { type: 'h3', text: 'Aba Pendentes' },
      { type: 'p', text: 'Itens que aguardam sua assinatura. Clique em uma linha para abrir o detalhe e assinar.' },
      { type: 'h3', text: 'Aba Histórico' },
      { type: 'p', text: 'Itens que você já assinou, com o registro completo das assinaturas coletadas.' },
      { type: 'p', text: 'Assinaturas: dependendo do item e do volume, diferentes funções precisam assinar — Mesa, Comercial N1, Presidência, Financeiro N1 e/ou Financeiro N2. As assinaturas coletadas são exibidas como badges coloridos.' },
      { type: 'p', text: 'Filtros: por praça, commodity e período de pagamento.' },
    ],
  },
  {
    id: 'administracao',
    title: '6. Administração',
    route: '/admin/usuarios',
    blocks: [
      { type: 'p', text: 'Gestão de usuários do sistema. Visível apenas para administradores.' },
      { type: 'table', headers: ['Nível de acesso', 'Descrição'], rows: [
        ['Full', 'Acesso completo ao sistema'],
        ['Limited', 'Acesso restrito conforme a função atribuída'],
      ]},
      { type: 'p', text: 'Funções: Mesa, Comercial N1, Financeiro N1, Financeiro N2, Presidência. A função determina quais telas e ações estão disponíveis e quais aprovações o usuário pode assinar.' },
      { type: 'callout', text: '→ As funções definidas aqui determinam quem aparece como signatário em Aprovações.' },
      { type: 'p', text: 'Registros: aba com o log de atividades do sistema, disponível para administradores.' },
      { type: 'p', text: 'Desativar: revoga o acesso do usuário sem excluí-lo do sistema.' },
      { type: 'p', text: 'Excluir: remove o usuário (ou armazém) permanentemente da interface. Por questão de integridade do log de auditoria, o registro é preservado internamente e não pode ser restaurado pela interface — recuperação apenas via backend, em caráter excepcional.' },
    ],
  },
  {
    id: 'perfil',
    title: '7. Meu Perfil',
    route: '/perfil',
    blocks: [
      { type: 'p', text: 'Acesse clicando no seu nome no menu lateral esquerdo.' },
      { type: 'p', text: 'Informações pessoais: nome completo e e-mail. O nome aparece em aprovações e logs.' },
      { type: 'p', text: 'Preferências: alterne entre tema claro e escuro.' },
    ],
  },

  {
    id: 'glossario',
    title: 'Glossário',
    route: null,
    blocks: [
      { type: 'table', headers: ['Termo', 'Definição'], rows: [
        ['Basis', 'Diferencial entre o preço físico local e o contrato futuro de referência (R$/sc). Reflete custos logísticos, prêmios regionais e condições locais de oferta e demanda.'],
        ['Benchmark', 'Bolsa de referência para precificação — CBOT para soja, B3 para milho.'],
        ['Combinação', 'Conjunto de parâmetros que define como uma praça é precificada: commodity, ticker, benchmark, datas e método.'],

        ['NDF (Non-Deliverable Forward)', 'Contrato de câmbio a termo sem entrega física. Usado para travar a taxa de câmbio em operações de soja precificadas em dólar.'],
        ['NDF Estimado', 'Taxa de câmbio a termo calculada pelo sistema para o vencimento do contrato, com base no diferencial de juros entre Brasil e EUA.'],
        ['Opção', 'Contrato que dá o direito (sem obrigação) de comprar ou vender um futuro a um preço determinado. Usado como instrumento de hedge com proteção assimétrica.'],
        ['Preço Originação', 'Preço calculado pelo sistema que pode ser ofertado ao produtor, considerando futuros, câmbio, basis e custos.'],
        ['Praça', 'Armazém ou região geográfica de referência da operação.'],
        ['Sigma (σ)', 'Volatilidade implícita utilizada no modelo Black-76 para precificação teórica de opções.'],
        ['Spread de Execução', 'Folga aplicada para compensar o deslizamento esperado na execução das ordens no mercado.'],
        ['Spread (Mercado)', 'Diferencial entre a taxa NDF estimada e a taxa spot atual.'],
        ['Ticker', 'Código do contrato futuro de referência. Ex: ZSK27 = Soja CBOT maio/2027; CCMF27 = Milho B3 janeiro/2027.'],
      ]},
    ],
  },
];
