# Auditoria de traducoes - 09/11/2026

> Atualizacao: as 68 chaves abaixo foram adicionadas em ingles, frances e espanhol, junto com mensagens dinamicas e legendas adicionais. A verificacao automatica passou com 651/651 textos ativos nos tres idiomas. O restante deste documento registra o levantamento original; textos externos de APIs e de imagens continuam dependendo de sua fonte.

Foram comparados os dicionarios combinados de i18n.jsx, i18nSupplemental.json e i18nUiSupplemental.js com os textos atuais. Nenhum dicionario foi alterado.

## Resultado

Faltam as mesmas 68 chaves em ingles, frances e espanhol: 204 entradas no total. Cobertura automatica: 583/651 textos ativos em cada idioma.

- Methodology.jsx: 21 textos.
- CitySearchDetails.jsx: 45 textos.
- Backend: duas mensagens.
- IndicatorsTable.jsx compartilha uma chave ausente com CitySearchDetails.jsx (a legenda de descricao), sem aumentar o total de chaves unicas.

O verificador utiliza heuristicas: esses numeros nao cobrem todo conteudo renderizado. Uma chave ausente pode receber traducao parcial pelos fallbacks. A mensagem de erro ao consultar projetos de lei e diagnostico de console.

## Lista completa de chaves ausentes nos tres idiomas

```text
src/components/city/IndicatorsTable.jsx (1)
  "Descrição"
src/pages/CitySearchDetails.jsx (45)
  "Nível de maturidade não disponível. Preparação: F e E. Gestão e Governança: níveis 1 a 5."
  "Posição no calendário (cosseno do mês)"
  "Temperatura média"
  "Posição no calendário (seno do mês)"
  "Casos de dengue há 12 meses"
  "Umidade relativa do ar há 2 meses"
  "Cobertura calculada da atenção primária"
  "Casos de dengue há 6 meses"
  "Incidência de dengue por 100 mil habitantes"
  "Não foi possível consultar o Sonar Municipal."
  "Erro ao consultar projetos de lei:"
  "Não foi possível carregar os projetos de lei neste momento."
  "Doença"
  "Cobertura de atenção primária"
  "População em área urbana"
  "Índice de vulnerabilidade social"
  "População com abastecimento de água"
  "População com coleta de esgoto"
  "Cobertura da coleta de resíduos"
  "Veiculação Hídrica"
  "Descrição"
  "Visão Inteligente"
  "Previsão de surto de arboviroses"
  "Previsão do modelo"
  "Mês de início do surto ainda não informado"
  "Não há previsão de surto nos próximos 6 meses"
  "É apenas uma previsão e não deve ser considerado como verdade absoluta!"
  "Quer entender essa previsão?"
  "Série histórica de casos"
  "Casos registrados por mês no município"
  "Comparação com municípios próximos"
  "em relação à mediana dos vizinhos"
  "Tópico da comparação"
  "Saúde e vigilância"
  "% dos municípios próximos"
  "O que o município pode fazer agora"
  "Diretrizes para prevenção e controle"
  "Projetos de Lei aplicáveis"
  "Diante da previsão de surto, consulte as orientações nacionais para vigilância entomológica, prevenção e controle vetorial das arboviroses urbanas."
  "Abrir diretrizes do Ministério da Saúde"
  "Consultando projetos no Sonar Municipal…"
  "Nenhum projeto aplicável foi encontrado pelo Sonar Municipal."
  "Ver projeto"
  "Sugestões obtidas por busca semântica no Sonar Municipal; avalie a adequação jurídica e o contexto local antes da adoção."
  "O que influenciou esta previsão?"
src/pages/Methodology.jsx (21)
  "A plataforma IARAinteli.gente foi desenvolvida para apoiar municípios e gestores públicos em transformação digital e sustentabilidade, com dados e conhecimento baseados em evidências e análises multicritérios para tomada de decisões."
  "Desenvolver uma plataforma digital, aberta e interativa, que funcione como um repositório integrado de dados e evidências, voltado para apoiar a governança e a gestão pública municipal."
  "Avalia a proteção do acesso aos recursos do ambiente natural e construído, no presente e no futuro. Tem foco no fomento à produção e ao consumo consciente e equilibrado entre recursos naturais, TICs e sociedade, com respeito, preservação e recuperação do ambiente natural."
  "Avalia o potencial de gerar renda e emprego para a subsistência das pessoas e o desenvolvimento inclusivo da economia urbana local. Tem foco no acesso à infraestrutura urbana e de TIC, a geração de oportunidades econômicas pelo uso das TICs nas cidades e a promoção da economia criativa e compartilhada."
  "Avalia a proteção do bem-estar das pessoas de maneira equitativa, com redução das desigualdades socioespaciais, acesso à informação, inclusão e letramento digital, bens e serviços urbanos essenciais. Tem foco no respeitar à identidade e à diversidade sociocultural local."
  "Avalia as capacidades institucionais para a transformação da cidade levando em conta ações-chave da administração pública municipal nos âmbitos de estratégia, infraestrutura de Hardware e Software, dados abertos, serviços e aplicações e monitoramento."
  "A plataforma IARAinteli.gente apresenta diagnósticos e recomendações para os níveis de maturidade, subsidiando a construção de políticas públicas em todos os municípios brasileiros. Possui duas camadas para diagnósticos. A camada 1 denominada Preparação com os níveis Fundação e Engajamento, é resultado da ampliação e revisão de pesquisadores brasileiros a partir do SSC-MM ITU-T -UN (Modelo de Maturidade para Cidades e Comunidades Inteligentes da União Internacional de Telecomunicações –  da Organização das Nações Unidas), que recomendava apenas a segunda camada Gestão e Governança com 5 níveis de maturidade (planejamento, alinhamento, desenvolvimento, integração e otimização."
  "Os níveis de maturidade oferecem diagnósticos e recomendações para as cidades direcionarem seu próprio desenvolvimento em curto, médio e longo prazos, entendendo que elas são complexas, diversas e estão em constante transformação. O conjunto de objetivos, indicadores e práticas delineiam caminhos de políticas públicas, federais, estaduais e municipais em direção às cidades tornarem-se inteligentes e sustentáveis."
  "Nível Fundação: Neste nível a cidade reconhece alguns de seus problemas-chave e entende o tipo de desafio pertinente a tornar-se uma cidade inteligente sustentável. Ainda não há plano formal ou estratégia consolidada para a transformação digital, inexistindo integração entre os setores e secretarias, e forte assimetria territorial de infraestrutura para a oferta de serviços públicos. Os processos não estão padronizados e apresenta baixo grau de digitalização dos serviços oferecidos. As cidades neste nível apresentam os menores resultados para os indicadores, o que expressa necessidade de melhoria nos aspectos econômicos, ambientais, socioculturais e de capacidade institucional."
  "Nível Engajamento: Em uma cidade neste nível, as ações de transformação começam a se articular, com definições das metas setoriais para incorporação de tecnologia, mesmo não tendo um plano formal ou estratégia consolidada para a gestão da cidade. Há identificação das áreas prioritárias de investimentos em infraestrutura básica para a diminuição de assimetrias territoriais, para a padronização dos processos e para a digitalização de serviços públicos municipais. Nos indicadores da cidade, persistem defasagens infraestruturais afetando ainda a oferta de serviços e a qualidade de vida das pessoas."
  "Nível 1 - Planejamento: A cidade apresenta planejamento e estratégia de transformação digital, incluindo planos e políticas de dados, e acompanhamento por indicadores e metas. Existe uma liderança no processo de articulação com diversos atores envolvidos. Os planos de ampliação da infraestrutura urbana e de TIC reconhecem a necessidade de oferecimento de serviços on-line. A produção e uso de dados indicam a necessidade de interoperabilidade entre os setores e secretarias. A identificação de áreas prioritárias de políticas públicas de gestão por processos de acompanhamento e monitoramento já podem estar disponíveis on-line no portal da cidade. Os resultados dos indicadores apontam que há condições infraestruturais para se avançar em direção à cidade inteligente sustentável."
  "Nível 2 - Alinhamento: Há ações implementadas para melhoria e uso de TICs em serviços e soluções. Existe participação de atores diversos nas decisões sobre a transformação digital da cidade. A captura e organização dos dados estão implementadas permitindo que os serviços atendam à maioria da população, ainda que não integrados. A cidade está preparada para ações de inclusão digital, monitoramento periódico de políticas e pesquisas de satisfação. A infraestrutura urbana e de TICs permite disponibilizar serviços urbanos e aplicações com uso de TICs para melhorar a qualidade de vida do cidadão."
  "Nível 3 - Desenvolvimento: Neste nível, a cidade busca o desenvolvimento por meio da utilização de tecnologia, entre outras ações. As tomadas de decisão em relação à cidade inteligente sustentável têm a participação dos munícipes em diversos arranjos e atores institucionais. Os serviços públicos oferecidos atendem à maioria da população de modo integrado e por multicanais digitais. As pesquisas de satisfação e sua disponibilização apontam para infraestruturas urbanas e de TIC implantadas, permitindo a ampliação da oferta de serviços públicos com uso de TIC e com interoperabilidade. Os dados são adequadamente armazenados, processados e geridos em sistemas e plataformas digitais públicas."
  "Nível 4 - Integração: As estratégias neste nível de maturidade estão consolidadas, a cidade visa integrar tecnologicamente sistemas e o território com demais municípios. Existe um portal de dados abertos com uso de ferramentas de TICs avançadas e preditivas, para o subsídio de serviços e soluções inteligentes, em tempo real. Os sistemas de gestão e governança pública estão interoperáveis, e com forte participação social. As pesquisas de satisfação com as partes interessadas contribuem para o aperfeiçoamento das políticas públicas, em um processo sistemático de avaliação contínua."
  "Nível 5 - Otimização: A cidade neste nível está integrada, sustentável, inclusiva e diversa, oferecendo acesso pleno à infraestrutura urbana e de TICs. As avaliações de satisfação e qualidade são sistemáticas, periódicas, quantitativas e qualitativas, com indicadores e dados populacionais, que subsidiam políticas públicas e direcionam à melhoria contínua do município. Há institucionalidade, governança colaborativa e participação social. A tecnologia implantada tem função de melhorar continuamente serviços, aplicações e infraestruturas. A automatização e a internalização das TICs avançadas, com grandes volumes de dados coletados e analisados, permitem previsões para a eficiência na entrega dos serviços em tempo real."
  "Os tópicos e indicadores desta dimensão avaliam a maturidade da gestão e governança municipal em relação a estratégia, infraestrutura de Hardware e Software, dados abertos, serviços e aplicações e monitoramento, de maneira que a cidade estruture melhores condições para alcançar e se sustentar como uma cidade inteligente."
  "Os Indicadores de Capacidade Institucional foram normalizados e parametrizados por serem provenientes de diferentes fontes e escalas sendo necessário converter os dados para um mesmo padrão de medição, ou seja, em faixas de valores (intervalos), com critérios de metrificação dos indicadores para auferir os níveis de maturidade tanto para a camada preparação (Fundação e Engajamento) como para gestão e governança municipal (1 a 5)."
  "Os Indicadores de Desenvolvimento Sustentável e TICs foram normalizados e parametrizados por serem provenientes de diferentes fontes e escalas sendo necessário converter os dados para um mesmo padrão de medição, ou seja, em faixas de valores (intervalos), com critérios de metrificação dos indicadores para auferir os níveis de maturidade tanto para a camada preparação (Fundação e Engajamento) como para gestão e governança municipal (1 a 5)."
  "Um conjunto de indicadores distribuídos em tópicos são utilizados para descrição dos perfis sociodemográficos, transformação digital, território e ambiente e institucional das cidades. Estes indicadores são chamados de caracterização, e não são utilizados para atribuir um nível de maturidade."
  "Para ter acesso à plataforma, aos formulários auto declaratórios e ao painel de resultados, o Prefeito da cidade realiza o cadastro em https://iarainteligente.icmc.usp.br, pelo Gov.br, inserindo as informações solicitadas. A equipe de suporte valida o cadastro e libera o primeiro acesso, a partir daí o Prefeito pode cadastrar mais cinco assessores para auxiliar no gerenciamento da área exclusiva da Prefeitura."
  "Pirâmide dos níveis de maturidade"
backend (2)
  "Código IBGE inválido"
  "Sonar Municipal temporariamente indisponível"
```

## Pendencias adicionais fora da cobertura automatica

O coletor nao analisa TemplateLiteral e seleciona literais por acentuacao ou prefixos. Assim, deixa passar frases sem acentos e mensagens interpoladas.

Em CitySearchDetails.jsx:

- Linha 2810: explicacao dos valores SHAP. Avaliacao direta com translateString confirmou texto inalterado nos tres idiomas.
- Linhas 2818-2819: legendas de aumentar e diminuir o risco.
- Linha 2835: prefixo de valor dos fatores.
- Linha 2573: legenda da mediana dos vizinhos.
- Linhas 1421 e 2388: quantidade de casos da doenca selecionada.
- Linha 2293: mensagem com o mes previsto de inicio do surto.
- Linha 475: descricao acessivel do nivel de maturidade.
- Linha 1947: descricao acessivel da pontuacao geral.
- Linha 1685: descricao acessivel de informacoes do indicador.

Esses casos exigem tratamento especifico; a lista automatica de 68 chaves nao os inclui. Os exemplos dinamicos precisam de parametrizacao e validacao por instancia.

## Causa e outras limitacoes

O texto em portugues funciona como chave. Alteracoes de redacao invalidam a correspondencia, mesmo quando a versao antiga continua traduzida. Por exemplo, os dois paragrafos de normalizacao dos indicadores em Methodology.jsx agora explicam camadas e niveis; os dicionarios ainda contem as versoes com o encerramento antigo.

O tradutor automatico do DOM ignora elementos dentro de SVG (shouldSkipElement em i18n.jsx). Textos de graficos devem receber traducao explicita ao renderizar.

CitySearchDetails.jsx fixa pt-BR em varias formatacoes numericas e usa abreviacoes de meses em portugues. Sao pendencias de localizacao adicionais.

Textos retornados pelas APIs e textos incorporados nas imagens da metodologia exigem verificacao separada.

## Recomendacoes

1. Revisar a redacao final em portugues antes de adicionar as 68 chaves aos tres idiomas.
2. Parametrizar mensagens dinamicas e traduzir explicitamente os rotulos dos graficos.
3. Ampliar o coletor para cobrir textos sem acentos e modelos de mensagens interpoladas.
4. Executar a verificacao automatica e conferir visualmente as telas nos tres idiomas.

## Reproducao

Na pasta frontend:

```sh
node scripts/check-i18n.mjs --check
node scripts/check-i18n.mjs --app-missing
```
