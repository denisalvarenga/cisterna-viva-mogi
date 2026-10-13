/* Cisterna Viva — dados estáticos (fotografias, regiões, guias, dicas, fontes). */
window.CV = (function () {
  'use strict';

  /* ---------- Fotografias (Pexels, licença gratuita) ----------
     Os textos de descrição e autoria vieram das páginas originais no Pexels.
     Nenhuma foto é guardada no projeto: o navegador baixa da CDN do Pexels e, depois
     da primeira visita, o service worker mantém uma cópia para uso offline. */
  const px = (id, w) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;
  const photo = (id, o) => Object.assign({
    id,
    page: `https://www.pexels.com/photo/${id}/`,
    src: w => px(id, w),
    srcset: ws => ws.map(w => `${px(id, w)} ${w}w`).join(', ')
  }, o);

  const PHOTOS = {
    tanques: photo(13772681, {
      alt: 'Três reservatórios verdes de água ao lado de uma casa de fazenda, sob céu nublado',
      author: 'Magda Ehlers', ratio: '3/2',
      note: 'Local não informado na página original.'
    }),
    calha: photo(20113440, {
      alt: 'Gotas de água da chuva escorrendo de uma calha de casa',
      author: 'Zeynep Sude Emek', ratio: '2/3',
      note: 'Local não informado na página original.'
    }),
    telhado: photo(9586507, {
      alt: 'Água da chuva escorrendo de um telhado de telha ondulada',
      author: 'Nguyễn Hữu Nhã', ratio: '3/2',
      note: 'Fotografada em Long Khánh, Vietnã (informação da página original).'
    }),
    horta: photo(30619296, {
      alt: 'Plantas sendo regadas dentro de uma estufa no Brasil',
      author: 'Melquizedeque Almeida', ratio: '3/2',
      note: 'Brasil, conforme a página original.'
    }),
    alagoas: photo(36921845, {
      alt: 'Vista aérea de um vilarejo rural e do campo em Alagoas, Brasil',
      author: 'Silvio Fotografias', ratio: '9/16',
      note: 'Alagoas, Brasil, conforme a página original.'
    }),
    estrada: photo(37068279, {
      alt: 'Estrada de terra vermelha cortando uma área rural brasileira sob céu azul com nuvens',
      author: 'Michael Antonio Dias', ratio: '3/2',
      note: 'Palmital (SP), conforme a página original.'
    }),
    filtro: photo(6857798, {
      alt: 'Pessoa despejando água de uma jarra em um copo de vidro',
      author: 'cottonbro studio', ratio: '3/2',
      note: 'Foto ilustrativa de água potável; não mostra um filtro de barro.'
    }),
    garrafas: photo(2479095, {
      alt: 'Três garrafas plásticas transparentes cheias de água, lado a lado',
      author: 'Suzy Hazelwood', ratio: '3/2',
      note: 'Foto ilustrativa de garrafas PET; não mostra o processo SODIS.'
    })
  };

  /* ---------- Estados ---------- */
  const STATES = [
    ['AC', 'Acre', 'norte'], ['AL', 'Alagoas', 'nordeste'], ['AP', 'Amapá', 'norte'], ['AM', 'Amazonas', 'norte'],
    ['BA', 'Bahia', 'semiarido'], ['CE', 'Ceará', 'semiarido'], ['DF', 'Distrito Federal', 'centro-oeste'],
    ['ES', 'Espírito Santo', 'sudeste'], ['GO', 'Goiás', 'centro-oeste'], ['MA', 'Maranhão', 'nordeste'],
    ['MT', 'Mato Grosso', 'centro-oeste'], ['MS', 'Mato Grosso do Sul', 'centro-oeste'], ['MG', 'Minas Gerais', 'sudeste'],
    ['PA', 'Pará', 'norte'], ['PB', 'Paraíba', 'semiarido'], ['PR', 'Paraná', 'sul'], ['PE', 'Pernambuco', 'semiarido'],
    ['PI', 'Piauí', 'semiarido'], ['RJ', 'Rio de Janeiro', 'sudeste'], ['RN', 'Rio Grande do Norte', 'semiarido'],
    ['RS', 'Rio Grande do Sul', 'sul'], ['RO', 'Rondônia', 'norte'], ['RR', 'Roraima', 'norte'], ['SC', 'Santa Catarina', 'sul'],
    ['SP', 'São Paulo', 'sudeste'], ['SE', 'Sergipe', 'nordeste'], ['TO', 'Tocantins', 'norte']
  ].map(([id, name, perfil]) => ({ id, name, perfil }));

  /* ---------- Perfis de chuva (mm/mês, mín–máx) ----------
     São faixas de REFERÊNCIA por macrorregião, em ordem de grandeza — não são séries
     históricas de um município. Dentro de uma mesma região, a chuva varia muito.
     O usuário pode informar a própria média anual (ex.: Normais Climatológicas do INMET). */
  const semiTypical = [70, 90, 120, 100, 50, 25, 20, 10, 8, 15, 40, 60];
  const PROFILES = {
    'norte': { label: 'Norte (clima chuvoso)', mm: [[220,300],[220,300],[250,330],[250,320],[200,270],[100,160],[70,120],[50,90],[60,100],[90,140],[130,190],[180,250]] },
    'nordeste': { label: 'Nordeste litorâneo e agreste', mm: [[90,140],[90,140],[130,190],[200,280],[220,300],[180,250],[150,210],[100,150],[70,110],[70,110],[70,110],[80,130]] },
    'semiarido': { label: 'Semiárido (sertão)', mm: semiTypical.map(v => [Math.round(v * 0.7), Math.round(v * 1.3)]) },
    'centro-oeste': { label: 'Centro-Oeste', mm: [[200,280],[180,250],[160,220],[60,110],[10,30],[0,10],[0,10],[5,20],[30,70],[100,160],[180,250],[200,270]] },
    'sudeste': { label: 'Sudeste', mm: [[140,220],[130,210],[110,180],[60,100],[50,90],[30,60],[25,55],[30,60],[55,95],[90,140],[110,170],[140,210]] },
    'sul': { label: 'Sul', mm: [[130,190],[120,180],[110,160],[80,120],[80,120],[90,130],[80,120],[80,120],[100,150],[110,160],[100,150],[120,170]] }
  };

  /* ---------- Tipos de telhado → coeficiente de escoamento (valores típicos de projeto) ---------- */
  const ROOFS = {
    ceramica: { label: 'Telha cerâmica', c: 0.8 },
    fibrocimento: { label: 'Fibrocimento', c: 0.8 },
    metalica: { label: 'Telha metálica / zinco', c: 0.85 },
    laje: { label: 'Laje de concreto', c: 0.7 }
  };

  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  /* ---------- Lista de contingência (NÃO é a lista completa de municípios) ---------- */
  const FALLBACK_MUNICIPIOS = {
    AC: ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira'], AP: ['Macapá', 'Santana', 'Laranjal do Jari'],
    AM: ['Manaus', 'Parintins', 'Itacoatiara'], PA: ['Belém', 'Ananindeua', 'Santarém', 'Marabá'],
    RO: ['Porto Velho', 'Ji-Paraná', 'Ariquemes'], RR: ['Boa Vista', 'Rorainópolis'], TO: ['Palmas', 'Araguaína', 'Gurupi'],
    AL: ['Maceió', 'Arapiraca', 'Palmeira dos Índios'], BA: ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Ilhéus'],
    CE: ['Fortaleza', 'Caucaia', 'Juazeiro do Norte'], MA: ['São Luís', 'Imperatriz', 'Caxias'],
    PB: ['João Pessoa', 'Campina Grande', 'Patos'], PE: ['Recife', 'Jaboatão dos Guararapes', 'Petrolina', 'Caruaru'],
    PI: ['Teresina', 'Parnaíba', 'Picos'], RN: ['Natal', 'Mossoró', 'Parnamirim'], SE: ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto'],
    DF: ['Brasília'], GO: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis'], MT: ['Cuiabá', 'Várzea Grande', 'Rondonópolis'],
    MS: ['Campo Grande', 'Dourados', 'Três Lagoas'], ES: ['Vitória', 'Vila Velha', 'Serra', 'Cariacica'],
    MG: ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora'], RJ: ['Rio de Janeiro', 'Niterói', 'Duque de Caxias', 'Nova Iguaçu'],
    SP: ['São Paulo', 'Mogi das Cruzes', 'Campinas', 'Santos', 'Ribeirão Preto'], PR: ['Curitiba', 'Londrina', 'Maringá'],
    RS: ['Porto Alegre', 'Caxias do Sul', 'Pelotas'], SC: ['Florianópolis', 'Joinville', 'Blumenau']
  };

  /* ---------- Guias ---------- */
  const FUNASA = 'https://www.gov.br/funasa/pt-br/centrais-de-conteudo/publicacoes/engenharia-de-saude-publica/manual-de-saneamento';
  const GUIDES = [
    { id: 'fossa', photo: 'estrada', title: 'Fossa séptica simples', summary: 'Passo a passo para construção e manutenção.',
      steps: ['Escolha um local a pelo menos 15 metros de poços, cisternas ou fontes de água usada para beber.',
        'Construa uma câmara enterrada e impermeabilizada onde o esgoto decanta.',
        'Direcione o líquido para um sumidouro ou vala de infiltração no solo.',
        'Faça a limpeza do lodo periodicamente — geralmente a cada 2 a 4 anos.'],
      caution: 'Resumo simplificado — o dimensionamento correto depende do número de pessoas e do tipo de solo. Procure orientação técnica antes de construir.',
      source: 'FUNASA — Manual de Saneamento', url: FUNASA },
    { id: 'filtro', photo: 'filtro', title: 'Filtro de barro ou areia', summary: 'Como montar e manter um filtro caseiro.',
      steps: ['Use um filtro de vela de cerâmica ou monte um filtro lento com brita, areia grossa e areia fina.',
        'Despeje a água lentamente pela camada superior até sair mais limpa pela saída inferior.',
        'Lave ou troque o elemento filtrante regularmente.',
        'Guarde a água filtrada em recipiente tampado e identificado.'],
      caution: 'A filtragem melhora a aparência da água, mas não elimina todos os microrganismos. Combine com desinfecção solar (SODIS), cloração ou fervura.',
      source: 'FUNASA — Manual de Saneamento', url: FUNASA },
    { id: 'sodis', photo: 'garrafas', title: 'Desinfecção solar (SODIS)', summary: 'Tratamento da água com garrafas PET e sol.',
      steps: ['Use garrafas PET transparentes e limpas, sem riscos profundos, de até 2 litros.',
        'Encha as garrafas com água já filtrada até quase a boca.',
        'Deite as garrafas na horizontal sobre uma superfície reflexiva e exponha ao sol.',
        'Deixe pelo menos 6 horas em dia de sol forte, ou 2 dias em dias nublados.'],
      caution: 'Não use SODIS em água muito turva. Nesses casos, filtre primeiro e procure um agente de saúde.',
      source: 'FUNASA — Manual de Saneamento', url: FUNASA }
  ];

  const TIPS = [
    { cat: 'Água', text: 'Reaproveite a água do banho ou da máquina de lavar para limpar o quintal ou regar plantas não comestíveis.', source: 'ANA', url: 'https://www.gov.br/ana/pt-br' },
    { cat: 'Água', text: 'Conserte vazamentos assim que perceber — uma torneira pingando pode desperdiçar dezenas de litros por dia.', source: 'ANA', url: 'https://www.gov.br/ana/pt-br' },
    { cat: 'Água', text: "Mantenha a caixa d'água e a cisterna sempre tampadas, evitando contaminação e o mosquito da dengue.", source: 'FUNASA', url: 'https://www.gov.br/funasa/pt-br' },
    { cat: 'Água', text: 'Ao lavar louça ou roupas, feche a torneira enquanto ensaboa — reabra só para enxaguar.', source: 'ANA', url: 'https://www.gov.br/ana/pt-br' },
    { cat: 'Água', text: 'Prefira regar plantas no início da manhã ou fim da tarde, quando a evaporação é menor.', source: 'ANA', url: 'https://www.gov.br/ana/pt-br' },
    { cat: 'Água', text: 'Use uma vassoura, e não a mangueira, para limpar calçadas e quintais.', source: 'ANA', url: 'https://www.gov.br/ana/pt-br' },
    { cat: 'Energia', text: 'Aproveite a luz do dia: posicione móveis para deixar a claridade natural entrar antes de acender lâmpadas.', source: 'Procel/MME', url: 'https://www.gov.br/mme/pt-br/assuntos/ee' },
    { cat: 'Energia', text: 'Lâmpadas de LED consomem bem menos energia que as incandescentes e duram muito mais.', source: 'Procel/MME', url: 'https://www.gov.br/mme/pt-br/assuntos/ee' },
    { cat: 'Energia', text: 'Desligue carregadores da tomada quando não estiverem em uso — muitos consomem energia mesmo desligados.', source: 'Procel/MME', url: 'https://www.gov.br/mme/pt-br/assuntos/ee' },
    { cat: 'Energia', text: 'Prefira eletrodomésticos com o Selo Procel, que indica os modelos mais eficientes.', source: 'Procel/MME', url: 'https://www.gov.br/mme/pt-br/assuntos/ee' }
  ];

  const SOURCES = [
    { name: 'FUNASA — Manual de Saneamento', desc: 'Referência para fossa séptica, filtragem e desinfecção da água.', url: 'https://www.gov.br/funasa/pt-br' },
    { name: 'Programa Cisternas — MDS', desc: 'Página oficial, critérios de elegibilidade e canais institucionais.', url: 'https://www.gov.br/mds/pt-br/acoes-e-programas/acesso-a-alimentos-e-a-agua/programa-cisternas' },
    { name: 'ANA — Agência Nacional de Águas e Saneamento Básico', desc: 'Recursos hídricos, segurança hídrica e uso consciente da água.', url: 'https://www.gov.br/ana/pt-br' },
    { name: 'INMET — Instituto Nacional de Meteorologia', desc: 'Dados e normais climatológicas de precipitação. Use para conferir a chuva do seu município.', url: 'https://portal.inmet.gov.br' },
    { name: 'IBGE — API de Localidades', desc: 'Lista oficial de municípios usada na calculadora.', url: 'https://servicodados.ibge.gov.br/api/docs/localidades' },
    { name: 'Procel — MME', desc: 'Uso consciente de energia elétrica.', url: 'https://www.gov.br/mme/pt-br/assuntos/ee' }
  ];

  return { PHOTOS, STATES, PROFILES, ROOFS, MONTHS, MONTHS_SHORT, FALLBACK_MUNICIPIOS, GUIDES, TIPS, SOURCES };
})();
