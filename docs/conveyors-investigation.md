# Conveyors: investigação inicial e correção de reload

Estudo do código local em 06/10/2026. O diagnóstico abaixo registra a implementação anterior à correção, incluindo as propostas que foram posteriormente dispensadas pelo usuário.

## Correção implementada

Por instrução do usuário, as esteiras passam a ser blocos simples, sem dependência de energia, upgrades ou Network Updater para funcionar.

- As 25 variantes de transporte têm tick próprio a cada 20 ticks, com registro idempotente quando o bloco está carregado. Caminhos de ponte mantêm sua função visual.
- O transporte reconhece esteiras ausentes do registro consultando o bloco sob a carga. Posições persistidas indisponíveis não são apagadas; a restauração pode ser chamada novamente e não bloqueia a descoberta posterior.
- Entidades já carregadas são descobertas na abertura/entrada e periodicamente, em lotes, cobrindo eventos de carga perdidos e inicialização tardia.
- Pontes aguardam corredores/receivers indisponíveis, preservam seus caminhos durante essa espera e recuperam a ligação automaticamente. Links existentes sobrevivem à indisponibilidade temporária do receiver.
- Foram removidos consumo e grafo de energia, notificações de pipes e tags de energia/tubos/cores dos conveyors e caminhos. Filtros das especiais e inversão de verticais permanecem disponíveis.
- O espaçamento ignora entidades removidas, evitando interromper um passe que insere vários itens em containers.

Validação: `node tools/test-conveyor-reload.mjs`, com 16 verificações de regressão usando os módulos e definições reais. O bundle completo também foi compilado em memória. A validação em um mundo Bedrock real ainda não foi executada.

## Diagnóstico anterior à correção

## Conclusão

O sistema tem persistência de posições, mas não tem recuperação contínua dos blocos que estavam indisponíveis durante a abertura do mundo. `restorePersistedConveyors()` marca a recuperação como iniciada antes de procurar as esteiras; ignora as posições cujo bloco não pode ser acessado; e nunca tenta essas posições novamente. A chegada posterior do jogador, das entidades ou dos chunks não reativa esse registro.

Isso basta para reproduzir uma esteira que funciona antes de fechar e permanece parada depois de reabrir. Não significa que toda reabertura falhará: a simulação de controle funciona quando os blocos persistidos estão disponíveis na primeira passagem e a carga é registrada por evento. Portanto, o problema é de ciclo de vida e disponibilidade, não de perda obrigatória de todas as propriedades persistentes.

As especiais acrescentam dependência de um cache de fontes de energia; as pontes acrescentam conexões e propriedade de caminhos em memória. Esses caches também podem ficar incompletos ou desatualizados após carregamento.

## Evidência e limites

O script diagnóstico inicial executou os quatro módulos reais de transportation em um runtime Bedrock simulado, além de `colors.js` e `pipeFaces.js` do UtilityCraft irmão. Resultado inicial: **25 cenários reproduzidos**, incluindo um controle positivo de recuperação. Esse script foi substituído por `tools/test-conveyor-reload.mjs` para verificar o comportamento corrigido.

As reproduções iniciais descreviam os defeitos anteriores, não a aceitação da correção. A suíte atual verifica recuperação e movimento sem energia e não depende do checkout irmão `UtilityCraft`.

Foram simulados carregamento, eventos, indisponibilidade de blocos, inserção em inventário, teleporte e falhas de operações. A física, a ordem exata dos eventos nativos, renderização, fusão de itens, carregamento de pacotes e um mundo Bedrock real não foram executados. Não foram consultados logs do mundo afetado. A falha estrutural foi reproduzida; a condição exata que a disparou nesse mundo ainda depende de observação no jogo.

## Implementação ativa

O caminho de entrada é `BP/scripts/main.js` → `features/index.js` → `features/transportation/index.js`. Este registra os componentes e chama `installTransportation()`. `data/legacy` não é importado por esse fluxo.

| Parte | Responsabilidade | Persistência atual |
| --- | --- | --- |
| `ATCore/transportation/conveyors.js` | Registro por dimensão, posição por chunk, topologia, energia, cargas, eventos e updater | Posições em propriedades do mundo; mapas de execução voláteis |
| `plainConveyors.js` | Horizontais, verticais, subidas, descidas e saída para inventários | Sem estado próprio persistente |
| `bridgeConveyors.js` | Busca de receiver, blocos do caminho, ligação virtual e teleporte | Blocos ficam no mundo; links e donos ficam em mapas voláteis |
| `specialConveyors.js` | Junction, Router, Sorters, Smart Router, Overflow e Underflow | Filtros por coordenadas em propriedades do mundo; ciclos e histórico voláteis |

O transporte roda a cada **2 ticks**. Horizontais usam incrementos de **0,1 / 0,2 / 0,5 bloco** para Copper/Titanium/Aetherium: 1/2/5 blocos por segundo a 20 TPS. As pontes têm alcance de 8/16/32 blocos. As especiais consomem **10 unidades de energia por entidade de item despachada**, sem multiplicar pelo tamanho da pilha. A movimentação comum e o salto da ponte não consultam energia.

Não existe um caminho completo pré-calculado por item. A topologia agrupa blocos; cada bloco decide localmente o movimento. Nas pontes há uma aresta virtual transmitter → receiver. Isso é suficiente para uma fábrica com decisões locais, desde que exista controle de ocupação e de aceitação no próximo trecho.

## Por que a retomada falha

### 1. Recuperação única ignora chunks indisponíveis

Evidência: `conveyors.js:504–527`, particularmente `restoreStarted = true`, `safeGetBlock()` e `if (!block) continue`. Os eventos em `conveyors.js:1001–1004` voltam à mesma função, bloqueada pelo flag. `safeGetBlock()` converte ausência ou erro em `null`.

A documentação oficial confirma que [`Dimension.getBlock()`](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/dimension?view=minecraft-bedrock-stable) pode retornar ausência ou lançar erro em chunks descarregados. `worldLoad` não fornece garantia de disponibilidade de cada posição persistida.

Sequência reproduzida:

1. Colocar uma esteira; sua posição entra na persistência e no registro em memória.
2. Abrir uma sessão nova com as mesmas propriedades, mas sem o chunk disponível na primeira restauração.
3. A posição continua persistida, mas não entra no registro.
4. Disponibilizar o chunk, emitir `initialSpawn` e gerar um novo item: a esteira permanece parada.
5. Interagir com um updater conectado ao trecho: o registro é reconstruído e o item volta a andar.

O movimento procura a esteira somente no registro (`findConveyorUnder()`, linha 742), sem consultar o bloco real como recuperação alternativa. Assim, até itens novos ficam parados sobre uma esteira esquecida.

### 2. Updater depende de ação do jogador

O componente atual tem colocação e interação, sem `onTick` (`conveyors.js:910`). O bloco atual também não define `minecraft:tick`. Um updater já colocado não se executa automaticamente ao reabrir o mundo.

O legado tinha `onTick` e uma restauração inicialmente adiada (`data/legacy/.../conveyors.js:920` e `:1468`). Adiar pode ajudar os chunks próximos; não resolve áreas distantes que só carregam depois.

O scan atual percorre apenas seis vizinhos ortogonais e pontes no sentido do transmitter. Não atravessa diagonal de rampa nem descobre um transmitter distante partindo apenas do receiver através dos blocos de caminho. Por isso a interação manual é uma recuperação limitada ao trecho descoberto.

### 3. Fontes de energia disponíveis depois ficam fora do cache

`rebuildTopology()` coleta posições de fontes encontradas naquele instante (`conveyors.js:624` e `:632`). Uma entidade de fonte que chega depois não é acrescentada automaticamente. `entityLoad` registra cargas, não invalida a topologia energética (`:973`). Isso foi reproduzido: o bloco da fonte já existia, sua entidade carregou depois e o cache só passou a reconhecê-la após reconstrução explícita.

Uma fonte que **já estava** na lista pode voltar a ser resolvida quando recarrega. A falha demonstrada afeta fontes ausentes do snapshot inicial ou de uma reconstrução posterior. Outro evento de atualização pode reparar esse estado; a esteira não garante esse reparo sozinha.

### 4. Há caminhos adicionais para perder a recuperação

- `writeJson()` ignora falhas de gravação (`conveyors.js:417`). Simulação: a esteira anda na sessão atual, mas não há posição persistida para a próxima sessão. Isso é um risco comprovado sob falha de escrita, não evidência de que essa falha ocorreu no mundo do usuário.
- A lista de posições de um chunk não é paginada por tamanho; apenas o índice de chunks é paginado. Convém controlar bytes e informar falhas, sem limpar dados válidos por ausência temporária de blocos.
- Cargas são descobertas somente por `entitySpawn`/`entityLoad`. Não há bootstrap das entidades já disponíveis. O cenário sem esses eventos fica parado e começa a funcionar quando o evento é emitido. Isso demonstra a dependência; não prova que o Bedrock omitiu o evento nesse mundo. A documentação de [`EntityLoadAfterEvent`](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityloadafterevent?view=minecraft-bedrock-stable) descreve carregamento de entidades ao recarregar chunks e mudar dimensão.
- Colocação por comando/estrutura não tem um mecanismo periódico de descoberta equivalente à colocação pelo jogador.

O UUID do header do BP permanece igual no diff local do manifesto. Esse diff não sustenta atribuir o problema a uma troca de identidade do pacote.

## Topologia e energia

### Rampas e conexão de carga

`rebuildTopology()` e `scanFromUpdater()` usam os seis deslocamentos ortogonais. Já `plain.resolveOutput()` produz deslocamentos diagonais para subida/descida. A sequência `(0,0,0)` → `(1,1,0)` torna-se duas redes na simulação.

O movimento comum pode acontecer mesmo assim, pois não depende da rede energética. Uma especial no trecho elevado pode perder alimentação transmitida pela linha inferior. Blocos adjacentes com orientações incompatíveis também são agrupados, porque a topologia não representa entradas e saídas de transporte.

Recomendação: definir portas de carga por forma e orientação. Validar saída e entrada correspondente, inclusive rampas, verticais e bridges. Manter um grafo de energia separado, com suas próprias regras. Adjacência física não deve ser a única definição de uma conexão de carga.

### Divergência com UtilityCraft atual

No UtilityCraft, `UtilityCore/networks/energy.js:33` usa `createNetworkConnectionChecker("energy")`. Em `pipeFaces.js:560`, um tubo comum só permite a face quando o estado `utilitycraft:<direção>` é `true`; também são aplicadas restrições persistidas de faces e cores.

Os conveyors consultados têm `dorios:isTube`, mas não esses estados de faces. O checker real do UtilityCraft rejeitou o conveyor simulado sem estado, e aceitou depois de adicionar o estado. Em seguida, desabilitar a face pelo helper real voltou a fechar a conexão.

O Ascendant usa outro percurso, baseado somente em `dorios:energy`/`dorios:isTube` (`conveyors.js:632–657`). Mesmo com a face fechada, sua coleta continuou encontrando a fonte. Isso implica duas interpretações da mesma conexão. O débito direto na fonte também não consulta o orçamento de transferência do gerador.

Recomendação: colocar um contrato de conexão comum na fundação compartilhada, ou oferecer um protocolo explícito de integração entre os pacotes. Evitar importar `UtilityCore` de outro BP como se fosse módulo local. Duas opções de produto:

- As esteiras conduzem energia: o contrato deve reconhecer esse tipo de condutor, sua orientação e restrições, sem depender de estados visuais de tubos que elas não possuem.
- Cada especial recebe energia como consumidor: usa um pequeno buffer alimentado por conexões canônicas. A linha de transporte fica independente do circuito elétrico. Esta opção simplifica isolamento, limites de transferência e diagnóstico, mas exige armazenamento e alimentação do consumidor.

No UtilityCraft atual, a wrench trata `dorios:isTube` antes de chamar rotação (`machinery/wrench.js:43`). Essa tag também interfere na interação. O handler do Ascendant para a wrench cobre a inversão de verticais, sem reconstrução genérica de links de pontes após mudança externa de orientação.

## Pontes: construção, propriedade e teleporte

Os blocos intermediários são representação visual e condutores de energia; não têm o componente de movimento dos conveyors. `bridge.process()` teleporta a carga diretamente ao centro do receiver (`bridgeConveyors.js:232`). Não há deslocamento ao longo da ponte, reserva do destino, fila por capacidade ou limitação do salto pela velocidade do tier.

Falhas reproduzidas:

| Caso | Resultado atual | Correção proposta |
| --- | --- | --- |
| Receiver indisponível na reconstrução inicial | Link ausente; não reaparece só com o carregamento posterior | Estado pendente e revalidação ao ativar endpoints |
| Chunk intermediário indisponível, endpoints disponíveis | `evaluate()` ignora o trecho desconhecido e aceita o link | Distinguir caminho válido, obstruído e ainda desconhecido |
| Duas pontes cruzam um bloco do mesmo tier | A segunda sobrescreve o dono; sua remoção apaga o cruzamento da primeira | Proibir cruzamento no mesmo voxel inicialmente, ou modelar donos múltiplos e regras de energia |
| Donos em memória ausentes | Limpeza por toda a distância máxima apaga caminho alheio, inclusive depois do receiver e de outro tier | Persistir/reconstruir propriedade verificável; remover somente o próprio caminho |
| Receiver substituído por outro tier sem refresh | Cache ainda aceita qualquer `bridge_receiver` | Revalidar identidade, tier, direção e geração da conexão |

Evidência: `evaluate():61`, `clearOwnedPath():89`, `createPath():117`, `refreshTransmitter():153` e `getLinkedReceiver():207`.

A construção atual apaga o caminho antigo antes de validar/criar o novo; permite remoção de plantas e outros blocos considerados substituíveis; e aceita criação parcial quando um bloco intermediário está indisponível. Uma exceção em `setType` também pode interromper a sequência, que não é transacional.

Proposta de construção:

1. Calcular o segmento candidato sem alterar blocos.
2. Validar todos os trechos carregados, colisões e política de cruzamento. Trecho desconhecido fica pendente.
3. Reservar as posições e revalidar endpoints após qualquer yield.
4. Aplicar apenas a diferença entre caminho antigo e novo; registrar proprietário e versão.
5. Publicar o link somente com caminho completo. Em falha, manter uma conexão anterior ainda válida ou desfazer somente a alteração própria.

Não apagar um bloco de caminho apenas porque os endpoints estão temporariamente indisponíveis. Na migração de caminhos antigos sem dono verificável, preservar os casos ambíguos até reconstruir a relação.

Para o transporte, recomendo preservar a identidade de ponte com **teleporte instantâneo**, mas acrescentar fila, capacidade por tier, ocupação/reserva no receiver e resultado explícito de sucesso. Animar a trajetória é outra opção, com custo maior e necessidade de manter o corredor disponível; não é necessário para consertar a confiabilidade.

Os alvos das pontes e especiais usam `y + 0.1`, e o wrapper desliga a checagem de blocos. A superfície horizontal consultada tem 3/16 de bloco. Ajustar a altura de saída conforme superfície e tipo de carga e testar colisão no jogo. A documentação de [`Entity.tryTeleport()`](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable) permite verificar sucesso e cita falhas por chunk indisponível ou interseção com blocos.

## Esteiras especiais: o que funciona e o que precisa mudar

Todas as sete têm dispatch e lógica executável. Isso não equivale a funcionamento correto em todos os cenários nem a aceitação em Bedrock. Precisam de rede com energia; mobs não são processados por nenhuma delas, inclusive entre segmentos Aetherium.

| Especial | Regra atual demonstrada | Limitação principal | Regra recomendada |
| --- | --- | --- | --- |
| Router | Mantém uma saída e gira em janelas de 10 ticks | Distribui por janela de tempo, não por item; ar e baú cheio são candidatos | Manter modo por janela se desejado; oferecer round-robin por transferência aceita |
| Sorter | Item correspondente prefere frente; outros preferem lados alternados | Usa outra direção se a preferida está bloqueada; mistura categorias | Filtro estrito por padrão; overflow configurável |
| Inverted Sorter | Item correspondente prefere lados; outros preferem frente | Mesmo fallback para uma saída de outra categoria | Mesma política de filtro estrito |
| Smart Router | Prioriza atribuição esquerda/frente/direita, depois tenta outras | Atribuição vira preferência; item sem atribuição também sai por qualquer alternativa | Rotas obrigatórias configuráveis e fallback explícito para itens não atribuídos |
| Overflow | Frente se o bloco parece transitável, lados quando não | Baú cheio continua elegível; carga pode ser teleportada para dentro dele | Frente somente quando aceita a carga; usar lados em falta real de capacidade |
| Underflow | Tenta inserir em containers laterais; depois usa frente | Não prioriza conveyors laterais, apesar da descrição genérica de saídas laterais | Priorizar qualquer destino lateral compatível, ou declarar expressamente que serve para containers |
| Junction | Tenta manter direção pelo último bloco; usa posição local sem histórico | Inverte quando saída reta está bloqueada; histórico desaparece ao reabrir | Manter canal/direção de entrada e esperar a saída reta liberar |

Evidência: `specialConveyors.js:283–421`. Filtros e atribuições são propriedades do mundo (`:93–133`), portanto já têm mecanismo de persistência. Os ciclos de alternância e o histórico de movimento são voláteis.

O problema comum está em `isPassable()` e `send()` (`:48–66`): existência de container é tratada como aceitação. Se a inserção falha, `send()` tenta teleportar para o mesmo destino e retorna sucesso mesmo se o teleporte falhar. A energia já foi consumida. A simulação demonstrou os dois casos.

Além disso, o `blocksPerSecond: 5` registrado para especiais não é usado por esse dispatch. A cada chamada a carga vai ao centro do bloco adjacente. Uma sequência disponível pode avançar um bloco a cada dois ticks, em vez de usar interpolação de 5 blocos/s. A taxa exata no jogo depende de ocupação e física.

Recomendação: substituir o booleano transitável por avaliação de destino com resultado `aceita / cheio / proibido / indisponível`, respeitando item, face, filtro e ocupação. Inserção recusada deve manter a carga na origem, salvo saída de ejeção explicitamente configurada. Cobrar energia, avançar o ciclo e registrar o movimento somente para transferência concluída, com reserva/reembolso para operações que possam falhar.

## Movimento e integridade dos itens

- `plain.process()` tenta inserir em inventário vizinho assim que o item pertence ao bloco, antes de chegar ao fim da esteira (`plainConveyors.js:116`). Isso encurta visualmente o caminho. Inserir somente na zona de saída.
- O espaçamento compara posições atuais, somente dentro do mesmo bucket (`:84`). Com Aetherium, o passo de 0,5 supera a folga de 0,35; um item pode ultrapassar outro. A simulação reproduziu ultrapassagem e bloqueio dependentes da ordem. Ordenar por progresso e reservar posição futura, incluindo o próximo bloco.
- O array do bucket continua contendo entidades removidas pela inserção. O item seguinte lê `other.location` sem validar a entidade e pode interromper o passe inteiro. A simulação reproduziu essa exceção, compatível com o contrato oficial de [`Entity.location`](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable), que pode lançar `InvalidEntityError`.
- `tryInsert()` modifica o inventário antes de remover a entidade (`conveyors.js:233–263`). Se a remoção falha, a carga original permanece e o inventário já recebeu o item. A duplicação foi reproduzida por falha injetada. Se a criação do restante falhar depois da remoção, há risco de perda. Transferir cargas controladas por um buffer e verificar conservação; compensar explicitamente falhas de entidade.
- Todos os itens e criaturas elegíveis recebidos por eventos ficam nos mapas globais, mesmo longe de qualquer esteira. O loop os revisita a cada dois ticks. Limitar o conjunto ativo às áreas com transporte e ter descoberta local com orçamento.

## Alternativas inspiradas em Mechanic Hopper/Dropper/Upper

No UtilityCraft, `machinery/hoppers/mechHoppers.js:331` recebe `onTick`; o Hopper consultado define intervalo de 8 ticks. O inventário é uma entidade `utilitycraft:hopper` com cinco slots. Filtros são whitelist/blacklist; velocidade limita 1–5 tentativas de slots/cargas por passe, não necessariamente 1–5 itens individuais. Hopper/Upper também podem puxar de minecarts.

O Hopper busca acima e entrega abaixo ou lateralmente; Upper busca abaixo e entrega acima ou lateralmente. Dropper busca de um lado vertical e ejeta do lado oposto, utilizando buffer. O estado de face do Dropper deve ser interpretado junto da implementação e do modelo; o código usa `y+1.2` quando `dir === down` e `y-0.8` no outro caso (`:212`). Não assumir a direção pelo nome do estado ao copiar essa solução.

Esse desenho evita depender de um registro de rede global para cada transferência local: o tick do próprio bloco encontra o buffer. Ainda requer tratar entidades ausentes, carregamento e conservação de itens; copiar o arquivo inteiro não seria garantia de confiabilidade.

| Bloco proposto | Papel no Ascendant | Base aproveitável | Vantagem e custo |
| --- | --- | --- | --- |
| **Conveyor Feeder** | Container → esteira; lote controlado e reserva do início da linha | Extração por slots/face e filtros do Hopper, via DoriosLib.container | Resolve alimentação automática sem jogar uma pilha inteira; exige pequena fila/buffer |
| **Conveyor Collector** | Esteira → container, aguardando capacidade | Inserção e slots de entrada dos hoppers | Evita teleporte para inventário cheio e concentra backpressure na ponta |
| **Item Elevator** | Entrada abaixo → saída acima/lateral com buffer | Upper | Mais previsível para itens que vertical por teleporte; acrescenta entidade de armazenamento |
| **Conveyor Ejector** | Buffer → item físico no mundo ou em esteira | Dropper | Ejeção direcionada e limitada; precisa recriar apenas a quantidade confirmada |
| **Conveyor Loader/Unloader** | Um bloco configurável para Feeder e Collector | Transferência comum e modos persistidos | Menos blocos e manutenção; configuração mais elaborada |

Eu começaria por **Loader/Unloader**, com modos de alimentar e recolher, e depois **Item Elevator**. UtilityCraft já oferece os hoppers para casos genéricos; a extensão do Ascendant deve acrescentar integração com ocupação, velocidade e filtros das esteiras. Um Dropper especializado só se justifica por ejeção horizontal, lotes controlados e integração com a linha.

Reusar as APIs de resolução, slots, faces e transferência. Preservar componentes especiais/lore das pilhas; nunca reconstruir itens apenas por typeId. Usar `onPlace` e reencontro idempotente do buffer para cobrir estruturas/comandos quando aplicável. Evitar copiar a escolha da primeira entidade da posição ou assumir que o buffer existe.

## Ordem recomendada de implementação

1. **Retomada e conservação.** Restaurar por chunk com fila de pendências e orçamento; descobrir blocos ativos por tick lento ou consulta local; reconstruir cargas disponíveis; reativar bridges e energia quando dependências chegam; registrar falhas de persistência; corrigir acesso a entidades removidas e operações que duplicam/perdem carga.
2. **Contrato de destino e energia.** Destino com capacidade real e reservas; regras estritas dos filtros; Overflow/Underflow coerentes; energia com o mesmo contrato de faces, cores e transferência do UtilityCraft; resultado de movimento explícito.
3. **Portas e pontes.** Grafo de carga orientado por forma, incluindo rampas; caminhos com propriedade verificável; criação incremental validada; fila/capacidade no receiver; atualização por região afetada.
4. **Interfaces locais.** Loader/Unloader e Elevator com buffer, filtros e estados de diagnóstico. Implementar sobre as mesmas regras de aceitação e conservação.

Arquitetura sugerida: mundo e propriedades duráveis como fonte de verdade; cache de blocos ativos separado de posições persistidas; grafo de carga separado de energia; fila de regiões sujas; scheduler com orçamento por tick; fronteiras de chunks como estado pendente. Publicar reconstruções com versão e conferir se a região mudou durante os yields. Evitar reconstruir toda a dimensão a cada alteração pequena.

Uma recuperação híbrida é apropriada: índice persistido para descobrir posições conhecidas; `onTick` lento para anunciar blocos carregados e descobrir estruturas; eventos para mudanças imediatas; fallback local quando aparece uma carga sobre bloco ainda não registrado. O anúncio precisa ser idempotente e não regravar persistência/reconstruir a rede em todo tick. [`minecraft:tick`](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_tick) é necessário para o callback `onTick` de componentes customizados.

Adicionar diagnóstico enxuto: blocos ativos/pendentes, fontes encontradas, motivo de espera, link válido/pendente/obstruído e erros de persistência. O updater pode continuar como ferramenta de reparo/diagnóstico, mas a retomada normal deve ocorrer sem interação.

## Validação futura no Bedrock

Usar mundo de teste e comparar contagens totais de itens antes/depois:

- Fechar e reabrir junto à fábrica e longe dela; visitar os trechos depois; repetir em Nether/End e atravessando chunks.
- Deixar itens no trecho, gerar itens novos após retorno e repetir unload/reload sem fechar o mundo.
- Carregar energia antes/depois das esteiras; fontes em chunks separados; face e cor bloqueadas; limite de transferência.
- Rampas, descidas, verticais para cima/baixo, mudança de orientação, pistões, estrutura/comando e explosão.
- Pontes dos três tiers, receiver removido/substituído, obstrução, cruzamento, caminho legado e receiver ocupado.
- Cada especial com destinos vazios/cheios, filtros correspondentes/não correspondentes, várias cargas simultâneas e pilhas de tamanhos diferentes.
- Aetherium com mobs e passagem por especiais: definir política de compatibilidade e testar dimensões de colisão.
- Falhas de teleporte/inserção/remoção, pressão de entidades e TPS reduzido; confirmar ausência de perda, duplicação e débito sem transferência.

Até essa validação, o resultado deste estudo é diagnóstico e proposta técnica com reproduções determinísticas, não correção instalada ou prova de funcionamento do pacote no jogo.
