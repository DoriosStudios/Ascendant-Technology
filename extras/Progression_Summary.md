# Resumo da progressão do Ascendant Technology

**Status: planejamento — não representa uma implementação concluída.**

Este resumo registra as decisões e propostas discutidas por Kauziin (Usuário) e Astra (Codex). A documentação completa será desenvolvida em [Progression.md](../docs/Progression.md). O contexto e a evolução das decisões estão em [Chat_History.md](Chat_History.md).

## Progressão anterior

Esquema simplificado do caminho principal observado e descrito na conversa, anterior à reformulação:

```text
Infraestrutura do UtilityCraft
→ Titanium e tungsten / carcaças industriais
→ Catalyst Weaver
→ Aetherium
→ Equipamentos de aetherium + Liquifier
→ Duplicador
→ Expansão entre máquinas específicas, superiores e sistemas auxiliares
→ Ausência de um próximo objetivo principal claramente encadeado
```

A receita de aetherium combinava ouro, aço, ferro energizado, pó de Ender Pearl, fragmentos de aetherium e lava. A Cryo Chamber dependia de componentes de aetherium, ficando depois da obtenção inicial desse material. Equipamentos e Duplicador concentravam as grandes recompensas; o restante ampliava as capacidades da base sem conduzi-las a um destino final definido. O Singularity Fabricator existente ainda executava duplicação especializada, embora seu novo papel já estivesse previsto no roadmap.

## Nova progressão

```text
Infraestrutura do UtilityCraft
→ Titanium
→ Tungsten como intermediário Titanium–Aetherium
→ Família criogênica disponível: Cryo Chamber e branches dedicadas
→ Produção de Cryofluid + preparação da mistura de pós metálicos
→ Catalyst Weaver
→ Aetherium
→ Equipamentos de aetherium + infraestrutura para processamento de nióbio
→ Nióbio do End, tratado obrigatoriamente no Catalyst Weaver
→ Componentes avançados de energia e operação extrema
→ Duplicador + Singularity Fabricator com Reinforced Case
→ Produção em escala de milhões de unidades equivalentes
→ Singularidades
→ Kyarium Matrix, com infraestrutura end-game e alimentação contínua de alta potência
→ Kyarium
→ Geradores 128× mais potentes que os antecessores + armaduras e ferramentas finais
```

### Decisões confirmadas na conversa

- **Aetherium:** a nova receita usará 8 pós de titanium, 8 pós de tungsten, 8 novos fragmentos de aetherium **ou** 2 cristais atuais, 8 pós de Ender Pearl e 1.600 mB de Cryofluid. Um pó misturado reunirá titanium e tungsten para facilitar a automação; o nome e o rendimento desse intermediário ainda precisam ser fechados.
- **Criogenia:** toda a família ficará antes do Catalyst Weaver. As receitas de entrada precisarão respeitar essa ordem, sem depender do aetherium que a própria cadeia produzirá.
- **Nióbio:** material técnico intermediário entre aetherium e kyarium, encontrado no End, menos abundante que o aetherium local, mas sem raridade extrema. Seu processamento passará por quatro fases, sendo elas a obteção primária (minério bruto obtido por mineração ou peneiramento), instabilização (Energizador com uma quantidade de energia considerável), condicionamento (Catalyst Weaver com aetherium líquido) e estabilização (criogenia).
- **Duplicador:** será movido para a etapa de nióbio. O Liquifier continuará necessário à sua operação.
- **Componentes:** Thermal Regulators e Energy Cores ampliarão as famílias existentes de Chips e Machine Cases. Containment Matrices são uma possibilidade para aplicações de contenção e manipulação extrema de matéria.
- **Carcaças:** o Singularity Fabricator usará Reinforced Case, cuja receita futura utilizará blocos de aetherium. A carcaça final acima dela será chamada **Resonant Casing**, substituindo o nome Absolute Machine Case.
- **Montagem final:** haverá uma crafting table 9×9 para receitas end-game. **Kyarium Matrix** substitui o nome Interdimensional Infuser.
- **Singularidades:** custarão milhões de unidades equivalentes; blocos e níveis de compressão contribuirão proporcionalmente. O conjunto de materiais elegíveis ainda será definido.
- **Extensões:** futuramente, as singularidades das extensões integradas serão obrigatórias quando essas extensões estiverem instaladas. Nenhuma extensão entra no levantamento inicial; ele se concentra em Vanilla, UtilityCraft e AT.
- **Kyarium Matrix:** terá custo-alvo de aproximadamente 1 TDE por fabricação e exigirá alimentação contínua de alta potência. Potência, duração, transferência e tolerância a interrupções ainda precisam ser dimensionadas.
- **Kyarium:** continuará sendo o material final, com geradores 128× mais potentes que os antecessores, armor-set e tool-set poderosos.
- **Geração natural:** aetherium deverá ficar mais frequente no Overworld. Os novos valores precisam ser definidos e verificados em geração de mundo.

### Propostas ainda não confirmadas

Astra sugeriu a sequência **nióbio bruto → Energizer: instável → Catalyst Weaver com aetherium líquido: condicionado → criogenia: estável**, usando máquinas existentes. Kauziin havia considerado **bruto → aquecimento: instável → estabilização: estável**, acrescentando a necessidade de passar pelo Catalyst Weaver. A escolha da ativação energética, dos intermediários e dos reagentes permanece aberta.

Também são propostas de Astra: fabricar Resonant Casing na mesa 9×9, usá-la na Kyarium Matrix, disponibilizar componentes térmicos básicos antes do nióbio e evitar exigir todas as branches criogênicas para avançar. A posição exata da mesa 9×9, as receitas finais e o tratamento de duplicação dos novos materiais ainda precisam de definição.

## Comparação

| Aspecto | Progressão anterior | Nova direção |
|---|---|---|
| Aetherium | Receita sem uma identidade material clara para Kauziin | Harmonia entre titanium, tungsten, cristais, Ender Pearl e criogenia |
| Criogenia | Posterior ao primeiro aetherium | Preparação obrigatória para sua fabricação |
| Recompensa após aetherium | Equipamentos e acesso ao Duplicador | Equipamentos e entrada na indústria de nióbio |
| Duplicador | Um dos grandes destinos imediatos | Conquista da etapa técnica de nióbio |
| Máquinas superiores | Expansão de capacidade com destino principal pouco definido | Opções para sustentar a produção em escala exigida pelo end-game |
| Objetivo final | Progressão dispersa após as principais recompensas | Singularidades → Kyarium Matrix → Kyarium |
| Exigência | Melhorar máquinas e ampliar sistemas específicos | Integrar produção, automação, energia e logística sem fragmentação excessiva |

A nova linha preserva liberdade na infraestrutura secundária, mas dá à produção um destino principal contínuo. Os detalhes aprovados devem orientar a futura documentação completa; as propostas em aberto não devem ser tratadas como decisões já tomadas.
