# Histórico do debate sobre a progressão do Ascendant Technology

**Participantes:** Kauziin (Usuário) e Astra (Codex).

**Data do registro:** 7 de setembro de 2026.

Este arquivo reúne, em ordem cronológica, as mensagens do debate até o pedido de criação destes documentos, incluindo os comentários de andamento e as perguntas de esclarecimento. As falas anteriores foram preservadas mesmo quando corrigidas depois: uma proposta de Astra não constitui uma decisão de Kauziin. Foram normalizados apenas a apresentação, os links locais e os artefatos de formatação da interface. Chamadas de ferramentas, saídas de comandos e metadados internos não fazem parte da transcrição.

Para uma leitura consolidada, consulte [Progression_Summary.md](Progression_Summary.md). A futura documentação completa está reservada em [Progression.md](../docs/Progression.md).

---

## 1. Kauziin (Usuário) — Origem do projeto e pedido de análise

Estude o Ascendat Technology como um todo e me explique algo, se conseguir.

Primeiro de tudo, devo dizer que o Ascendant Technology nasceu de um momento de indignação. Recém admitido no estúdio, eu queria adicionar algumas coisas novas no projeto principal, UtilityCraft, mas não podia, já que na época tínhamos problemas de limitação de desempenho, além de uma "imagem" e objetivo definidas.

Com isso, eu criei minha extensão, simplesmente adicionando coisas para a minha conveniência do começo até mais ou menos a versão 0.4. Depois disso, eu percebi que dava pra fazer o Ascendant Technology ser uma expansão maior e melhor, e adicionei bastante coisa se você perceber nos releases posteriores. As últimas grande adições, sendo elas as máquinas superiores, meio que foram ótima para mudar a progressão, mas também deixou o AT em cima do muro, já que não tinha um caminho linear em relação à progressão e nem uma verdadeira adição end-game.

FIquei um bom tempo planejando coisas no roadmap, até chegarmos ao atual roadmap, que traz singularidades e uma nova parte da progressão completamente. Quero que me ajude a traçar um caminho linear na progressão principal (titanium > aetherium > niobium (ainda não colocado no roadmap) > kyarium), excluindo as máquinas e componentes da progressão secundária.

## 2. Astra (Codex) — Início da análise

Vou estudar a estrutura do addon, os releases e o roadmap para entender a progressão atual e propor um caminho de titanium até kyarium, separando as máquinas e os componentes secundários.

## 3. Astra (Codex) — Diferença entre roadmap e implementação

Encontrei uma diferença importante entre o plano e o código: o roadmap já coloca as singularidades como matéria-prima do kyarium, mas o Singularity Fabricator ainda está configurado para duplicar itens raros. Também estou conferindo as receitas de entrada dos materiais, porque são elas que determinam se titanium → aetherium é uma dependência real ou apenas uma ordem sugerida.

## 4. Astra (Codex) — Primeiro encadeamento identificado

A sequência já tem um primeiro elo concreto: o Catalyst Weaver depende de uma carcaça feita com titanium. Porém, essa mesma carcaça também exige tungsten, misturando a entrada do aetherium com a indústria secundária. Minha proposta está tomando forma em torno de quatro conquistas: titanium permite processar aetherium; aetherium permite refinar niobium; niobium permite produzir singularidades; e as singularidades culminam no kyarium.

## 5. Astra (Codex) — Primeira análise completa

**Eu daria ao AT uma progressão em que cada material permite realizar um processo que o anterior não conseguia sustentar.** Isso dá uma razão para existir a sequência titanium → aetherium → niobium → kyarium e oferece um destino para a capacidade produtiva das máquinas superiores.

Li o roadmap, os changelogs históricos, o desenho das máquinas superiores e as receitas e os sistemas ativos relacionados à progressão. A sua descrição aparece nessa evolução: titanium e criogenia na 0.5; geração natural dos minérios na 0.6; equipamentos e overclock na 0.7; encantamento e logística na 0.8; especialização industrial e refinamento na 0.9.

Minha leitura é que **o AT desenvolveu muitas maneiras de aumentar a capacidade da base, enquanto o objetivo que exigiria toda essa capacidade ficou para depois**. As superiores fazem sentido dentro desse crescimento: permitem produzir, processar e organizar mais. As singularidades podem finalmente transformar essa capacidade em avanço na progressão principal.

Há três detalhes do estado atual que influenciam a proposta:

- **Titanium já antecede aetherium por uma dependência concreta:** o Catalyst Weaver exige Superior Machine Case, que utiliza titanium e tungsten. Portanto, hoje essa passagem também atravessa a indústria secundária. [Receita da carcaça](../BP/recipes/blocks/machinery/components/superior_machine_case.json).
- **Cryo Chamber já está depois do primeiro aetherium:** sua receita exige Absolute Chip, cuja produção usa aetherium. Tornar a criogenia obrigatória para obter o primeiro aetherium exigiria reorganizar essas receitas para evitar um ciclo. [Receita da Cryo Chamber](../BP/recipes/blocks/machinery/machines/cryo_chamber.json).
- **O novo papel das singularidades ainda depende de implementação:** o roadmap descreve compressão extrema, mas as receitas ativas do Singularity Fabricator ainda produzem cópias do próprio item de entrada. [Configuração atual](../BP/scripts/config/recipes/singularityFabricator.js).

A progressão que eu proporia seria esta:

~~~mermaid
flowchart TD
    T["Titanium — infraestrutura inicial"]
    A["Aetherium — processamento de matéria"]
    N["Niobium — operação sob cargas extremas"]
    S["Singularidades — produção acumulada"]
    K["Kyarium — domínio da tecnologia final"]

    T -->|"Catalyst Weaver"| A
    A -->|"Tratamento e estabilização criogênica"| N
    N -->|"Singularity Fabricator"| S
    S -->|"Interdimensional Infuser"| K
~~~

As singularidades seriam uma etapa de fabricação dentro da passagem niobium → kyarium, preservando os quatro materiais como os marcos principais.

**1. Titanium: construir a infraestrutura que permite trabalhar com aetherium.**

Eu manteria sua aquisição relativamente direta: mineração ou peneiramento, processamento e fundição. O primeiro objetivo seria obter titanium suficiente para montar o Catalyst Weaver.

Esse é um bom início porque aproveita a base industrial do UtilityCraft e apresenta uma capacidade própria do AT: combinar vários reagentes em um processo.

A receita atual de aetherium já serve como ponto de partida: ouro, aço, ferro energizado, pó de pérola do Ender, fragmentos de aetherium e lava. Ela faz a passagem entre encontrar um recurso e transformá-lo em material utilizável. [Receita ativa](../BP/scripts/config/recipes/catalystWeaver.js).

**O marco dessa etapa seria fabricar o primeiro aetherium.** Encontrar fragmentos antes disso pode continuar sendo permitido; a dependência principal fica no processamento.

Para cumprir a separação que você pediu, eu retiraria a dependência de tungsten das receitas de entrada da linha principal. O Catalyst Weaver poderia exigir titanium diretamente e componentes acessíveis do UtilityCraft, sem obrigar o jogador a percorrer a família de carcaças industriais secundárias.

**2. Aetherium: dominar os processos necessários para refinar niobium.**

Aqui eu colocaria o núcleo químico do AT: **Liquifier, Catalyst Weaver e Cryo Chamber** trabalhando juntos.

Você já tem bastante matéria-prima para essa etapa:

- Aetherium líquido.
- Dark Matter.
- Refined Aetherium Shard.
- Cryofluid produzido com titanium.

Esses recursos podem ganhar um destino comum: preparar o niobium para uso tecnológico. O titanium continua relevante como insumo da criogenia, enquanto o aetherium fornece os reagentes e a infraestrutura do novo processo.

Como proposta de receita, eu faria:

> **Niobium bruto + Refined Aetherium Shard + aetherium líquido → niobium ativado, no Catalyst Weaver.**  
> **Niobium ativado + Cryofluid → lingote de niobium, na Cryo Chamber.**

“Niobium ativado” seria apenas um intermediário de fabricação, com nome ainda a definir. Essa sequência aproveita as funções existentes das máquinas e dá uma aplicação central ao fragmento refinado, que já é produzido com ametista e Dark Matter. [Receita do fragmento refinado](../BP/scripts/config/recipes/catalystWeaver.js).

Eu colocaria a fonte inicial de niobium no End. Assim, o aetherium encontrado no Overworld mantém seu valor e o niobium oferece um motivo para uma expedição posterior. Isso é uma proposta de distribuição; **a dependência indispensável seria o tratamento com tecnologia de aetherium**, mesmo que você escolha outra origem para o minério.

O marco dessa etapa seria produzir o primeiro niobium utilizável e conseguir repetir o processo.

**3. Niobium: sustentar a fabricação de singularidades.**

Esse é o lugar mais importante para estabelecer a identidade do material.

Na versão do roadmap que terminei de ler, niobium já aparece associado a estabilidade térmica, cargas elétricas elevadas, Thermal Regulators e Energy Cores. Essa direção combina muito bem com a lacuna entre aetherium e kyarium. [Definição no roadmap](../Roadmap.md).

Eu organizaria os componentes centrais assim:

| Componente | Função na progressão principal |
|---|---|
| Thermal Regulator | Permitir operação contínua sob carga térmica elevada. |
| Energy Core | Armazenar e fornecer a energia exigida pelos processos extremos. |
| Containment Matrix | Conter a matéria durante a fabricação e utilização de singularidades. |

Esses componentes dariam ao **Singularity Fabricator** uma dependência clara de niobium. A Absolute Machine Case pode completar sua construção, desde que sua cadeia de fabricação respeite a separação da progressão secundária.

O jogador passaria a ter um objetivo muito concreto: **montar um sistema capaz de produzir a primeira singularidade**.

Depois disso, a tarefa seria sustentar a produção de um conjunto de singularidades. Eu começaria com uma seleção pequena de materiais representativos, incluindo titanium, aetherium e niobium, além de recursos básicos de produção industrial. Cada material anterior continuaria participando do objetivo final.

Aqui as máquinas superiores ganham um papel especialmente bom: o jogador escolhe quais construir para resolver seus gargalos. A progressão principal exige os resultados da produção; o caminho industrial usado para alcançá-los permanece flexível.

**4. Kyarium: concluir a síntese e receber uma capacidade final utilizável.**

Eu daria ao **Interdimensional Infuser** a responsabilidade de fabricar kyarium.

O Singularity Fabricator concentra cada material individualmente. O Interdimensional Infuser combina essas singularidades em uma nova matéria, usando infraestrutura de niobium e os fluidos desenvolvidos ao longo da progressão.

A receita conceitual seria:

> **Conjunto definido de singularidades + estrutura de niobium + fluidos avançados + DE → Kyarium.**

A construção inicial do Infuser precisa ser possível com recursos anteriores ao kyarium. O mesmo vale para sua alimentação: a primeira gema deve ser alcançável com a geração disponível na etapa de niobium.

**O primeiro kyarium precisa render uma recompensa prática.** Eu ligaria explicitamente a ele os Kyarium Generators e o Ascendant Omni-Tool, que já estão planejados. O jogador poderia decidir entre reinvestir na base para facilitar as próximas produções ou obter uma ferramenta final que mude sua experiência cotidiana.

Isso também evita que o encerramento seja apenas fabricar uma gema cara e guardá-la.

Para essa estrutura funcionar, eu fixaria algumas regras de projeto:

- **Toda rota de obtenção do material utilizável deve respeitar o estágio anterior.** Isso inclui receitas alternativas, loot, peneiramento e duplicação.
- **Singularidades e kyarium precisam de regras próprias de duplicação.** Copiar esses produtos por um custo pequeno em relação à fabricação eliminaria o objetivo industrial.
- **As máquinas principais devem funcionar com a infraestrutura do estágio anterior.** A Cryo Chamber básica deve conseguir preparar niobium; suas especialistas podem melhorar a produção.
- **O custo deve incentivar produção e organização.** Quantidades e energia precisam ser balanceadas pela capacidade real das bases, evitando transformar a etapa final em espera obrigatória.
- **Expansões adicionais devem ter integração opcional bem delimitada.** A receita principal de kyarium precisa ter uma versão completa para UtilityCraft + AT.

A identidade que eu vejo para cada conquista é: **com titanium, o jogador constrói; com aetherium, transforma; com niobium, sustenta processos extremos; com kyarium, usufrui do domínio conquistado sobre esses processos.** Isso preserva o que você já criou e dá às próximas adições um lugar específico na jornada.

## 6. Kauziin (Usuário) — Revisão da receita e direcionamento do end-game

> A receita atual de aetherium já serve como ponto de partida: ouro, aço, ferro energizado, pó de pérola do Ender, fragmentos de aetherium e lava. Ela faz a passagem entre encontrar um recurso e transformá-lo em material utilizável.

Aqui, temos um pequeno porém: Quero mudar a receita principal do Aetherium.

Atualmente, a receita dele é simplesmente um "random bullshit, let's go!". Quero fazer ela seguir melhor a progressão natural dos minérios, o que também significa mudar a progressão de muitas máquinas.

- Por exemplo: Toda a família criogênica viria ANTES do Catalyst Weaver. (Cryo Chamber e as branches dedicadas) A receita passaria a usar 8 pós de titânio, 8 pós de tungstênio, 8 fragmentos de aetherium (o novo, ao invés do cristal) ou 2 cristais de aetherium (os atuais "fragmentos", presente em tudo), além de 1600mB de cryofluído e 8 pós de enderpearl. Nesse meio, quero fazer um "pó misturado" que une os pós de titânio e tungstênio pra facilitar a automação. Isso faria as propriedades frias do titânio se unirem com as propriedades densas e quentes do tungstênio e, por fim, se juntarem com a anomalia do pó de ender pearl, dando-nos a barra de aetherium como harmonia perfeita.

> O marco dessa etapa seria fabricar o primeiro aetherium.

Aqui é onde tudo desanda. Depois do primeiro aetherium, a prioridade imediata do jogador é conseguir fazer os equipamentos de aetherium e o duplicador, que são simplesmente OS MAIORAIS do addon inteiro. Claro, para o usar o Duplicador, você ainda precisa do Liquefator. Aqui é onde a progressão morre completamente, sendo espalhada entre diversas máquinas específicas demais.

Sobre a mudança no crafting do Catalyst Weaver, estou de acordo.

---

Só para contextualizar os planos futuros: estou repensando a progressão final do Ascendant Technology. Kyarium seria o material supremo, mas repensei e preciso de um intermediário entre Aetherium-Kyarium. (Assim como o tungstênio é o intermediário Titanium-Aetherium)

O Nióbio deve entrar como novo material técnico de alto tier, voltado principalmente para máquinas pré-Kyarium e componentes capazes de lidar com cargas energéticas e operação extrema.

Também estou planejando novas famílias de componentes além de Chips e Machine Cases: Thermal Regulators para estabilidade térmica e arrefecimento, Energy Cores para buffering e grandes picos de DE, e possivelmente Containment Matrices para máquinas que lidam com singularidades, teleporte ou manipulação extrema de matéria.

A progressão deve culminar em um Absolute Machine Case, acima do Reinforced Machine Case. Singularities terão custos na casa dos milhões de unidades equivalentes de material, com blocos e níveis de compressão contribuindo proporcionalmente. O Kyarium continuará sendo o material final e dependerá dessas Singularities.

Também haverá uma crafting table 9x9 para receitas realmente end-game. A intenção é tornar essa fase muito mais exigente em infraestrutura, automação e produção em escala, mas sem transformar o addon em algo excessivamente fragmentado no estilo GregTech.

---

Continuando com meus comentários em relação à sua análise:

> "Eu colocaria a fonte inicial de niobium no End. Assim, o aetherium encontrado no Overworld mantém seu valor e o niobium oferece um motivo para uma expedição posterior."

Concordo, mas devo mencionar uma coisa: Mesmo após das diversas mudanças que eu fiz no spawn do Aetherium no overworld, **eu nunca encontrei um minério de aetherium no mundo**. O minério vai precisar ficar mais frequente no overworld, já que é quase impossível achar ele. Nióbio não deve ser tão difícil de encontrar assim no fim, mas também deve ser longe de ser abundante lá como o aetherium é.

> "Esses componentes dariam ao **Singularity Fabricator** uma dependência clara de niobium. A Absolute Machine Case pode completar sua construção, desde que sua cadeia de fabricação respeite a separação da progressão secundária."

Concordo também, mas devo deixar um adendo: Ele usará o Reinforced Case, que será alterado para usar blocos de aetherium ao invés de barras.

Vale mencionar que iremos renomear "Aboslute Machine Case" para "Resonant Casing". Além disso, "Interdimensional Infuser" deve se chamar "Kyarium Matrix".

> "Conjunto definido de singularidades + estrutura de niobium + fluidos avançados + DE → Kyarium."

Sim e não. Primeiro de tudo, temos que coletar e definir quais recursos terão singularidades, já que quero fazer singularidades de outras extensões também. (caso as outras extensões sejam usadas junto do AT, as singularidades delas seriam necessárias para a criação de Kyarium)

> **"O primeiro kyarium precisa render uma recompensa prática.** Eu ligaria explicitamente a ele os Kyarium Generators e o Ascendant Omni-Tool, que já estão planejados. O jogador poderia decidir entre reinvestir na base para facilitar as próximas produções ou obter uma ferramenta final que mude sua experiência cotidiana."

Mais uma vez, concordo. No entanto, vale mencionar que iremos usar o máximo de energia possível para o Kyarium Matrix, algo como 1 TDE de energia por crafting, que possui uma frequência de atualização rápida o suficiente para esgotar uma bateria suprema em 1 segundo, fazendo o jogador mirar em conseguir o próximo tier de geradores o mais rápido o possível. Além disso, as estatísticas dos geradores de Kyarium devem ser 128 vezes mais potentes que as do seu antecessor.

Inclusive, Kyarium terá armor-set e tool-set bastante poderosos, então sua preocupação sobre "criar Kyarium e guardar" é desnecessária.

Agora, não sei se atribuo uma progressão mais complicada para o Nióbio do que apenas "Peneirar (bruto) > Esquentar (Instável) > Estabilizar (Estável)". Fazer ele precisar passar pelo Catalyst Weaver será necessário.

Se tiver alguma dúvida ou quiser saber mais sobre o que eu quero pro AT (e, claro, saber onde colocar os novos recursos dentro da progressão existente), me pergunte.

## 7. Astra (Codex) — Nova conferência das dependências

Vou conferir as receitas e os limites de energia atuais para encaixar essas mudanças, especialmente a passagem por nióbio e o lugar do Duplicador depois do primeiro aetherium. Também vou olhar a geração do minério no Overworld para distinguir a raridade planejada de algum problema na configuração.

## 8. Astra (Codex) — Perguntas de esclarecimento

**Pergunta 1**

Você quer manter o Duplicador acessível logo após o aetherium ou movê-lo para a etapa de nióbio? Isso define se a replicação ajuda a construir a indústria pré-Kyarium ou é uma conquista dela.

Opções apresentadas:

- Mover para nióbio.
- Manter após aetherium.

**Pergunta 2**

Na Kyarium Matrix, o custo de aproximadamente 1 TDE deve poder ser acumulado lentamente antes de uma descarga rápida, ou o processo precisa exigir alimentação contínua de alta potência?

Opções apresentadas:

- Acumular e descarregar rapidamente.
- Exigir alimentação contínua de alta potência.

**Pergunta 3**

Quais extensões entram no levantamento inicial das singularidades obrigatórias quando instaladas? O inventário local cita Heavy Machinery, Energy Amplified e Alltheaddonium; esse é o conjunto desejado?

## 9. Astra (Codex) — Observações sobre geração e energia

A configuração do aetherium no Overworld está bastante restritiva: as três regras têm `scatter_chance` de 1/64, cobrem apenas Y −61 a −54 e usam uma geração de até três blocos. Isso sustenta rever a raridade, embora ainda seja necessário medir a geração em chunks novos.

Também confirmei um ponto para a Kyarium Matrix: atualizar mais vezes não garante maior consumo por segundo, porque a infraestrutura atual compensa o intervalo de processamento. O efeito que você quer precisa ser definido pela potência de consumo e pela capacidade de transferência da rede.

## 10. Kauziin (Usuário) — Respostas às perguntas

**Sobre o Duplicador:**

> Mover para nióbio

**Sobre a alimentação da Kyarium Matrix:**

> Exigir alimentação contínua de alta potência

**Sobre quais extensões entram no levantamento inicial:**

> Nenhuma.

## 11. Astra (Codex) — Proposta revisada

**Mover o Duplicador para nióbio resolve uma parte importante do problema: o aetherium passa a abrir uma nova etapa industrial, e a replicação vira uma conquista dessa etapa.** Os equipamentos continuam sendo a recompensa imediata do aetherium; o próximo objetivo da base fica claramente definido.

Também corrijo minha interpretação anterior: tungsten participa da formação do aetherium e pertence a essa passagem principal. A exigência das singularidades de extensões instaladas fica preservada como plano futuro; pelo seu retorno, o levantamento inicial será apenas de Vanilla, UtilityCraft e AT.

**A nova receita de aetherium tem uma identidade coerente.**

Cada ingrediente participa da explicação do material: titanium e tungsten formam a base, o Cryofluid controla a reação, e a combinação dos cristais com Ender Pearl Dust introduz a propriedade anômala.

Para o pó misturado, eu começaria com algo simples:

> **1 Titanium Dust + 1 Tungsten Dust → 1 porção de mistura metálica.**

Assim, cada porção representa explicitamente os dois pós. A receita do Catalyst Weaver consumiria:

| Insumo | Quantidade |
|---|---:|
| Mistura metálica | 8 porções, equivalentes a 8 pós de cada metal |
| Novos fragmentos de aetherium **ou** cristais atuais | 8 fragmentos **ou** 2 cristais |
| Ender Pearl Dust | 8 |
| Cryofluid | 1.600 mB |

Eu faria essa mistura em crafting comum, com suporte à automação existente. Ela já cumpre sua função ao simplificar o abastecimento do Weaver.

A equivalência **1 cristal = 4 novos fragmentos** precisa valer consistentemente nas receitas pertinentes. Também manteria a distinção entre *cristal natural*, *fragmento* e *pó da barra processada*, para evitar que alguma conversão contorne a nova fabricação.

Toda a família criogênica ficaria disponível antes do Catalyst Weaver. Isso exige retirar o Absolute Chip da receita atual da Cryo Chamber e conferir as dependências dos equipamentos que produzem seus insumos. As especialistas podem estar disponíveis nesse estágio sem exigir que o jogador construa todas para avançar.

**Para nióbio, eu usaria três operações com funções distintas.**

Minha proposta seria:

~~~mermaid
flowchart TD
    A["Nióbio bruto — mineração ou peneiramento de material do End"]
    B["Nióbio instável"]
    C["Nióbio condicionado"]
    D["Nióbio estável — material utilizável"]

    A -->|"Energizer: ativação energética"| B
    B -->|"Catalyst Weaver: tratamento com aetherium líquido"| C
    C -->|"Cryo Chamber ou Cryo Stabilizer: estabilização"| D
~~~

Os nomes intermediários são provisórios. O que eu defenderia é o papel de cada operação:

- **Energizer:** introduz a carga que torna o material instável. Eu usaria essa ativação na posição que você reservou para aquecimento, pela identidade elétrica do nióbio.
- **Catalyst Weaver:** incorpora o tratamento com aetherium necessário para o material suportar essa carga.
- **Criogenia:** conclui a estabilização e entrega o metal utilizável.

Isso reúne máquinas existentes em uma linha produtiva com destino claro. O Liquifier passa a fornecer um insumo obrigatório dessa linha, e o Energizer ganha uma aplicação central depois do aetherium.

Eu começaria o Weaver apenas com **nióbio instável + aetherium líquido**, ajustando custo e quantidade. Acrescentaria outro reagente somente se ele trouxesse uma propriedade necessária ao processo. A própria sequência já fornece complexidade suficiente.

Todas as máquinas necessárias para produzir o primeiro nióbio precisam ser construídas com materiais anteriores a ele. Isso também vale para eventuais Thermal Regulators exigidos pela criogenia inicial.

**Com essas decisões, eu distribuiria as conquistas assim:**

| Etapa | Conquista principal | Próximo objetivo |
|---|---|---|
| Titanium + tungsten | Família criogênica e Catalyst Weaver | Fabricar aetherium |
| Aetherium | Equipamentos, Liquifier e Energizer | Estabilizar nióbio |
| Nióbio | Componentes avançados, Duplicador e Singularity Fabricator | Sustentar produção de singularidades |
| Indústria de nióbio em escala | Crafting 9×9, Resonant Casing e Kyarium Matrix | Produzir kyarium |
| Kyarium | Geradores 128×, armaduras e ferramentas finais | Expandir o uso da tecnologia final |

O **Duplicador** usaria nióbio em seus componentes de energia e contenção, mantendo o aetherium líquido como recurso operacional. Isso conecta sua fabricação e seu funcionamento às duas etapas anteriores.

O **Singularity Fabricator** permaneceria com **Reinforced Case**, conforme sua decisão, e dependeria de nióbio pelos componentes. A receita futura da carcaça usaria blocos de aetherium.

Eu colocaria a **Resonant Casing na crafting 9×9**, construída com a infraestrutura pré-Kyarium, e a usaria na **Kyarium Matrix**. A mesa assume a montagem das estruturas finais; a Matrix assume a transformação energética das singularidades. Essa divisão dá uma função clara às duas.

As novas famílias de componentes também podem aparecer progressivamente: Thermal Regulators básicos na criogenia e versões de nióbio na operação extrema; Energy Cores avançados na replicação e na Matrix; Containment Matrices nas máquinas que realmente manipulam matéria instável. Não precisaria criar uma versão de cada componente para cada minério.

**As singularidades precisam medir matéria equivalente com precisão.**

Para uma família cuja unidade seja a barra:

| Forma entregue | Crédito de material |
|---|---:|
| Barra | 1 |
| Bloco de 9 barras | 9 |
| Primeiro bloco comprimido | 81 |
| Segundo nível | 729 |
| Terceiro nível | 6.561 |
| Quarto nível | 59.049 |

Cada família precisa de sua própria unidade e conversões verificadas. Um bloco de cristal, por exemplo, pode representar uma quantidade diferente.

O Fabricator deveria aceitar essas formas diretamente, conservar o excedente e mostrar o progresso em unidades equivalentes. Isso permite custos de milhões sem obrigar a rede a movimentar milhões de itens individuais.

Quando chegarem as integrações, cada extensão poderá acrescentar suas singularidades ao conjunto obrigatório da Matrix. Por enquanto, a seleção fica restrita ao conjunto base que você definiu.

**Sobre a Matrix: alimentação contínua muda o desafio para potência sustentada.**

Eu especificaria separadamente:

- **Energia total:** aproximadamente 1 TDE por fabricação.
- **Potência exigida:** quanto precisa entrar por segundo.
- **Duração nominal:** consequência dos dois valores.
- **Tolerância a interrupções:** um pequeno buffer para acomodar a transferência entre atualizações.

Por exemplo, consumir 1 TDE em 100 segundos exige **10 GDE/s**. Esse exemplo serve para dimensionamento, não como valor de balanceamento fechado.

Aumentar a frequência de atualização, sozinho, não garante essa potência: o código atual ajusta a taxa ao intervalo de processamento. A geração, as saídas das baterias, os cabos e a entrada da Matrix precisam sustentar o valor escolhido. [Compensação do intervalo](../BP/scripts/DoriosCore/machinery/basicMachine.js).

O primeiro funcionamento precisa ser alcançável com uma instalação pré-Kyarium dimensionada para isso. Depois, os geradores 128× reduzem drasticamente a estrutura necessária. Para entregar esse efeito, o aumento de geração precisa vir acompanhado de capacidade de transferência compatível.

**Quanto ao aetherium no Overworld, há motivo concreto para rever a distribuição.**

As três regras atuais usam `scatter_chance` de **1/64**, concentram a distribuição entre **Y −61 e −54** e apontam para uma configuração de minério com `count: 3`. Isso é compatível com sua percepção de raridade extrema, embora a leitura estática não confirme se também existe uma falha de geração. [Uma das regras atuais](../BP/feature_rules/ae_ore_ow_low_feature_rule.json).

Eu ampliaria a faixa vertical e aumentaria a frequência, medindo o resultado em chunks novos. O alvo seria permitir que uma sessão deliberada de mineração forneça cristais suficientes para iniciar a produção. O nióbio no End seguiria a mesma ideia de aquisição previsível, com frequência inferior à do aetherium local.

Com essa organização, **o objetivo imediatamente posterior aos equipamentos de aetherium passa a ser montar a linha de nióbio para conquistar a replicação e a fabricação de singularidades**. É essa ligação que faltava entre as máquinas existentes e a progressão final.
