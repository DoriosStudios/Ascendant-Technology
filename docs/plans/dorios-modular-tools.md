# Plano: dorios-modular-tools

Data: 2026-10-10. Estado: proposta; skill e gerador ainda não implementados.

## Objetivo e escopo

Criar uma skill reutilizável para produzir peças, texturas compostas e definições de ferramentas Minecraft Bedrock a partir de materiais e combinações declarados pelo criador. O primeiro projeto de referência é Ascendant Technology; caminhos, namespace, materiais, resoluções e integração de atributos devem ser configuráveis.

A skill deve aceitar pedidos como “gere picaretas com cabeça de diamante ou cobre, cabo de madeira ou ouro e ligação de couro”. Deve também gerar apenas imagens, apenas peças ou um conjunto funcional completo quando esse for o escopo solicitado. Criar uma família estática de ferramentas combinadas não exige implementar uma bancada de montagem dentro do jogo.

Este documento planeja a implementação. Não instala uma skill nem adiciona itens ao addon.

## O que já existe

- `F:/Projects/Dorios-Skills/skills/dorios-material-texturing/SKILL.md`: referências locais, papéis de paleta, silhuetas, transparência, referências vanilla e verificação direcionada de equipamentos. Seus scripts atuais inspecionam paletas e verificam equipamentos; ainda não compõem peças nem enumeram combinações. Foi encontrada no repositório, mas não no catálogo de skills instaladas apresentado nesta sessão.
- `dorios-texture-atlas`: separação de faces de atlas Box-UV de blocos; não cobre ferramentas modulares.
- `dorios-recipe`, `dorios-localization` e `dorios-registry`: podem orientar as integrações correspondentes; o gerador deve manter sua funcionalidade principal sem depender de skills irmãs instaladas.

A recomendação é criar `dorios-modular-tools` como skill própria e aproveitar as convenções de materiais já estabelecidas. O escopo inclui combinações, atributos e saídas de pack, além de recoloração.

## Referência: Tinkers’ Construct

O nome correto é **Tinkers’ Construct**. Na picareta da branch Java 1.20.1, a definição lista `pick_head`, `tool_handle` e `tool_binding`: cabeça, cabo e ligação. Outras ferramentas podem usar peças diferentes ou mais peças; três não deve ser um limite fixo do gerador. [Definição oficial da picareta](https://github.com/SlimeKnights/TinkersConstruct/blob/1.20.1/src/generated/resources/data/tconstruct/tinkering/tool_definitions/pickaxe.json).

Na referência moderna, a cabeça fornece atributos básicos; o cabo altera atributos; a ligação pode contribuir traits sem atributos numéricos próprios. Isso depende da versão: não misturar tabelas antigas e modernas. [Exemplo no livro oficial 1.20](https://slimeknights.github.io/docs/books/1.20/encyclopedia/page-41/).

O sistema visual associa materiais a texturas de peças e compõe camadas. Há geração de sprites por transformação de paletas. A ideia reutilizável é separar forma, material e composição; não precisamos copiar arte ou implementar os loaders Java. [Material Model](https://slimeknights.github.io/docs/json/models/material/), [Tool Model](https://slimeknights.github.io/docs/json/models/tool/).

## Arquitetura proposta

### 1. Configuração do projeto e catálogo de materiais

Entradas explícitas de BP/RP, namespace, versão alvo, famílias de ferramentas e integrações habilitadas. Usar os identificadores reais, sem deduzir namespace pelo nome do repositório.

Cada material deve declarar:

- ID estável, chave de tradução e itens de origem realmente disponíveis;
- referências visuais e paleta por papel: sombra, escuro, médio, claro e brilho, com RGB e HEX juntos;
- peças compatíveis, separando capacidade visual de uso em gameplay;
- atributos por papel de peça e traits implementados;
- custos, reparo e obtenção, quando solicitados;
- dependência de addon externo, quando houver.

A descoberta local produz candidatos. Um minério, pó ou lingote existente não determina sozinho resistência, dano, flexibilidade, rendimento de fabricação ou poderes. A skill pode sugerir valores identificados como propostas; não deve exportá-los como dados confirmados. Presença de textura também não prova registro do item.

Para o primeiro projeto, usar as ferramentas existentes de Titanium e Aetherium como referências funcionais. Há itens de Titanium, Aetherium e Tungsten em `BP/items/ore_related`, além de referências visuais de várias famílias em `RP/textures/items/tools`. O plano não considera todas essas famílias automaticamente elegíveis.

### 2. Templates semânticos de peças

Cada família define slots ordenados, máscaras de pixels e papéis de iluminação. Exemplos:

| Família | Slots iniciais possíveis |
| --- | --- |
| Picareta | cabeça, cabo, ligação |
| Machado/pá/enxada | cabeça, cabo, ligação, conforme a silhueta escolhida |
| Espada | lâmina, empunhadura, guarda |
| Martelo | cabeça, cabo reforçado, placas opcionais |
| Paxel/AIOT | slots próprios, definidos após as famílias simples |

Os exemplos são uma proposta para o addon, não uma reprodução obrigatória das peças do mod.

Preparar as primeiras máscaras com inspeção visual das referências locais. Não separar materiais apenas por RGB: dois pixels da mesma cor podem pertencer a peças diferentes. O gerador consome a segmentação explícita depois de preparada.

Separar máscara da peça, índice de iluminação e detalhes fixos. Permitir sobrescritas para materiais com padrões próprios e silhuetas especiais. Ao exportar a peça como item solto, usar um offset próprio; ao montar a ferramenta, manter o encaixe e a ordem das camadas definidos pelo template.

### 3. Motor determinístico de texturas

Implementar com Python/Pillow, coerente com os helpers atuais de materiais. Produzir PNGs RGBA na resolução do template, sem suavização. Atribuir cores por papel explícito e compor as peças na ordem declarada. Usar nearest-neighbor apenas para ampliar previews.

As milhares de variantes devem sair de operações reproduzíveis sobre templates. Uma nova direção artística pode exigir criação de uma referência antes; não requer uma chamada de geração de imagem por combinação.

Cachear cada peça por template, material e configuração. Gerar folhas de contato paginadas com ID e composição, além de imagens individuais. Não produzir uma única folha gigantesca ilegível.

### 4. Enumerador de combinações

O conjunto de uma ferramenta é o produto dos materiais permitidos em cada slot, seguido dos filtros declarados. Permitir repetir o mesmo material em slots diferentes. Compatibilidade pode depender do papel, família e combinação completa.

```text
N = soma, por família, das combinações válidas dos seus slots

Exemplo sem filtros:
8 famílias × 10 cabeças × 10 cabos × 10 ligações = 8.000 ferramentas
```

Os itens de peças crescem por pares válidos de forma/material; não se multiplicam pelo número de ferramentas completas. Isso reduz o trabalho artístico, mas não elimina o custo dos itens finais e das texturas compostas.

Oferecer seleção de famílias, materiais, combinações específicas, amostras e exportação completa. Antes da exportação, informar contagens, arquivos estimados e combinações excluídas com motivo. Um limite configurado deve causar uma mensagem clara; nunca truncar silenciosamente.

Usar chave canônica com família e slots em ordem estável, com tokens não ambíguos. Não depender de índices de listas, cuja reordenação mudaria IDs. Exemplo de leitura humana: `pickaxe__head_diamond__handle_wood__binding_copper`; a regra final deve impedir colisões entre namespaces de materiais.

### 5. Resolvedor de propriedades

Calcular um perfil canônico de ferramenta, compartilhado pelos exportadores. Manter separadas propriedades nativas, propriedades implementadas em script e descrições cosméticas.

Proposta inicial, a balancear com o criador:

```text
durabilidade = quantizar((base_cabeça + bônus_ligação) × fator_cabo × fator_família)
velocidade = quantizar(base_cabeça × fator_cabo × fator_família)
dano = quantizar((base_cabeça + bônus_família) × fator_cabo)
nível_de_coleta = regra explícita da cabeça/família
traits = resolução dos traits das peças, com política de acumulação e limites
```

O bônus de ligação pode ser zero para um comportamento próximo ao Tinkers moderno. Essas fórmulas são propostas do addon, não fórmulas oficiais do mod.

Definir quantização, limites e ordem das operações por atributo. Preservar campos nativos inteiros como tokens inteiros, incluindo velocidades de `minecraft:digger`. Um número exibido na lore não implementa mineração, dano, velocidade de ataque ou tier. Cada propriedade prometida precisa de componente ou caminho de runtime correspondente.

Explicar a procedência de cada resultado: material de origem, multiplicadores, arredondamento e traits efetivos. Isso permite comparar duas combinações sem examinar milhares de arquivos.

### 6. Backend Bedrock

Recomendação inicial: variantes estáticas geradas durante a preparação do pack, cada uma com ID, PNG e definição. Isso atende ao objetivo de criar ferramentas com todas as combinações selecionadas usando padrões locais conhecidos.

`minecraft:icon` referencia entradas do atlas de itens. `ItemStack` oferece propriedades dinâmicas em itens não empilháveis. Essas interfaces não constituem o loader de materiais do mod Java. Não basear a primeira versão na suposição de que três propriedades arbitrárias recomporão o ícone em runtime. [Icon](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_icon?view=minecraft-bedrock-stable), [ItemStack](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemstack?view=minecraft-bedrock-stable).

Como evolução, avaliar variantes visuais estáticas com composição/progressão por propriedades dinâmicas e um resolvedor em script. Só adotar essa alternativa após provar atributos nativos, comportamento e persistência no jogo. Deduplicar PNGs visualmente idênticos não autoriza fundir IDs com gameplay diferente.

Materiais de outros addons precisam entrar no catálogo antes da geração do RP/BP. Registro de gameplay em runtime, sozinho, não cria novas imagens e definições no pack já carregado. Uma integração externa deve fornecer catálogo de build ou limitar-se às variantes já preparadas.

### 7. Saídas e integração

O modo completo deve produzir:

- PNGs das peças e ferramentas;
- definições de itens BP;
- entradas necessárias de `RP/textures/item_texture.json`;
- nomes/traduções nas línguas solicitadas;
- grupos/catálogo de inventário conforme a política do projeto;
- receitas de peças e montagem somente se incluídas no pedido;
- tabela canônica de composição/propriedades para integrações;
- relatório de combinações e manifest de arquivos gerados.

Recomenda-se expor as peças no criativo e manter as milhares de ferramentas finais acessíveis por montagem/comandos, conforme a UX escolhida. Para uma coleção estática sem montagem, oferecer grupos e filtros apropriados.

Em Ascendant, os itens funcionais lidos usam `utilitycraft:`; não migrar esse namespace. `StatsCore/config/materials.js` contém dados de progressão, que não devem ser usados como equivalentes automáticos da durabilidade nativa dos itens. Planejar um adaptador explícito para composição, família, atributos e traits. Avaliar os pontos públicos de registro antes de implementar o adaptador; não inferir tudo do nome longo do item nem duplicar bônus nativos no StatsCore.

Escrever fontes em `BP`/`RP` e usar o fluxo Regolith do projeto para exportar. Preservar arquivos e alterações locais existentes. O manifest deve registrar caminhos e hashes dos outputs próprios: remover uma combinação do catálogo só autoriza limpar um arquivo comprovadamente gerado e não alterado manualmente. Preservar dados ambíguos e relatar conflitos.

## Estrutura prevista da skill

```text
dorios-modular-tools/
  SKILL.md
  agents/openai.yaml
  requirements.txt
  scripts/modular_tools.py
  references/catalog-format.md
  references/bedrock-export.md
  assets/examples/minimal-project/
```

O exemplo mínimo deve conter um template real de picareta com máscaras e um catálogo reduzido, não arquivos placeholder. O script deve resolver caminhos relativamente ao arquivo de configuração e funcionar independentemente do diretório corrente.

O `SKILL.md` explica quando usar, como escolher escopo e como executar. Formato do catálogo, regras de composição e detalhes de exportação ficam nas referências. Dependências e scripts necessários devem acompanhar a skill; outras skills são apoio opcional.

Interface proposta, ainda não disponível:

```text
modular_tools.py discover --project <projeto> --output <candidatos>
modular_tools.py plan --config <config>
modular_tools.py preview --config <config> --sample <seleção>
modular_tools.py generate --config <config> --output <staging>
modular_tools.py integrate --manifest <manifest> --project <projeto>
```

`discover` lê as fontes configuradas, sem auditoria geral. `plan` calcula combinações e caminhos sem alterar o addon. `generate` escreve artefatos em staging. `integrate` aplica o conjunto solicitado depois de verificar conflitos; esses modos não implicam uma confirmação manual adicional para trabalho já autorizado.

## Etapas de implementação

1. Definir catálogo, identidade de variantes e um template de picareta com segmentação explícita. Implementar enumeração e relatório de combinações.
2. Implementar recoloração por papéis, composição, cache e folhas de contato. Entregar primeiro imagens de uma amostra representativa.
3. Implementar resolvedor de propriedades e exportação BP/RP com regras de inteiros, ícones e nomes. Receitas são uma saída configurável.
4. Validar o piloto no Bedrock; só depois ampliar as famílias e medir custo de milhares de variantes. Incorporar o adaptador StatsCore se solicitado.
5. Tratar bancada de montagem, troca de peças, reparo e preservação de progressão como evolução própria de gameplay. Na troca, definir política de desgaste e copiar apenas estado explicitamente suportado, preservando identidade, encantamentos e progressão conforme as regras escolhidas.

Piloto sugerido: uma picareta, quatro cabeças (diamante, cobre, Titanium, Aetherium), três cabos (madeira, ouro, ferro) e duas ligações (madeira, cobre): **24 combinações**, se todas forem declaradas compatíveis. Cobre/ouro/ferro e materiais sem ferramenta equivalente precisam de atributos explícitos antes da exportação funcional. Os materiais vanilla devem ser verificados para a versão alvo, sem presumir que todos possuem uma ferramenta nativa equivalente. Depois, adicionar espada com slots próprios.

## Critérios de conclusão da futura implementação

- As combinações válidas coincidem com o produto filtrado; inválidas recebem motivo e IDs são únicos/estáveis.
- As peças encaixam, as paletas respeitam os materiais, as dimensões e o alpha são preservados; previews recebem inspeção visual.
- Alterar apenas o material do cabo muda sua região e seus atributos, sem recolorir a cabeça. Repetir a geração não produz alterações desnecessárias.
- Ícones, itens e nomes do conjunto gerado têm referências resolvidas. A verificação de equipamentos se limita aos arquivos produzidos e registros diretos, sem auditoria de JSONs do repositório.
- Testes pequenos do gerador cobrem enumeração, colisões, composição, quantização e preservação de outputs editados, não cópias da implementação.
- Uma carga nova no Bedrock confirma inventário, ícone em mão/item caído, mineração, drops por tier, dano, desgaste, encantamentos e reparo aplicáveis. Se houver montagem/troca, confirmar também persistência após salvar e reabrir.
- O relatório distingue geração, verificações estáticas, exportação e execução real. Não há medida de desempenho nem aceitação no jogo neste planejamento.

Antes de uma exportação grande, medir geração, tamanho final, quantidade de registros, carregamento do pack e comportamento no dispositivo alvo. PNGs pequenos não garantem custo pequeno de registro; não definir um limite universal de variantes sem medição.
