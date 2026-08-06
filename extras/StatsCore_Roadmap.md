# StatsCore — Roadmap de Design

## 1. Visão geral

O **StatsCore** é o subsistema responsável por transformar armas, ferramentas e outros equipamentos do **Ascendant Technology** em objetos com identidade própria, progressão e custo real.

A proposta não é apenas aumentar números. O sistema deve:
- criar sensação de evolução;
- dar personalidade ao equipamento;
- recompensar estilo de jogo;
- impor limites para que escolhas importem;
- alimentar exploração, combate e coleta com a mesma base.

Em termos práticos, o StatsCore será o núcleo de:
- refinamento de itens;
- atributos escaláveis;
- efeitos passivos;
- gatilhos de combate e mineração;
- progressão por uso;
- regras de equilíbrio.

---

## 2. Direção filosófica

O Ascendant Technology já nasce forte. Isso não é um problema; é uma identidade.  
O problema é quando a força não encontra ameaça proporcional.

A nova filosofia deve seguir esta lógica:

1. o jogador recebe ferramentas fortes cedo;
2. o mundo passa a oferecer respostas mais perigosas;
3. o refinamento deixa de ser só ganho bruto e vira especialização;
4. poder real vem com custo, limitação ou risco;
5. exploração precisa justificar o perigo.

O StatsCore existe para sustentar essa mudança sem destruir a sensação de poder já presente no mod.

---

## 3. Objetivos centrais do sistema

### 3.1. Tornar equipamentos “vivos”
Cada item relevante deve parecer algo que evolui com o usuário.

### 3.2. Criar escolhas reais
Um item não deve conseguir maximizar tudo ao mesmo tempo.

### 3.3. Dar valor à exploração
O jogador precisa sentir que sair da base traz algo novo, raro ou perigoso.

### 3.4. Conectar combate e mineração
O mesmo núcleo deve servir para armas, ferramentas e efeitos de suporte.

### 3.5. Evitar números vazios
Todo bônus precisa alterar comportamento, ritmo ou decisão.

---

## 4. Estrutura macro do StatsCore

O sistema pode ser dividido em cinco blocos:

- **Handlers de item**
- **Gatilhos de eventos**
- **Sistema de atributos**
- **Sistema de refinamento**
- **Sistema de efeitos e recompensas**

Esses blocos devem conversar entre si, mas sem depender de um único comportamento monolítico.

---

## 5. Entidades principais do sistema

### 5.1. Equipamentos refináveis
Itens que podem receber progressão, como:
- armas corpo a corpo;
- armas à distância;
- ferramentas;
- itens híbridos;
- itens especiais do mod.

### 5.2. Atributos base
Cada item pode carregar um conjunto de atributos ou categorias:
- dano;
- crítico;
- penetração;
- efeitos elementais;
- roubo de vida;
- economia de durabilidade;
- bônus de coleta;
- afinidade de uso;
- marcas passivas.

### 5.3. Estado interno
Cada item refinado precisa armazenar dados próprios, como:
- nível;
- progresso;
- afinidade;
- stacks acumulados;
- cooldowns;
- flags temporárias;
- custo de uso;
- histórico de reforços.

---

## 6. Roadmap funcional por módulos

## 6.1. Módulo de crítico próprio

### Situação atual
A ideia 1 será repensada e passará a usar um sistema próprio de crítico.

### Direção de design
O crítico não deve ser apenas “mais dano”.  
Ele precisa ter identidade clara e leitura visual.

### Regras sugeridas
- chance base de crítico por arma;
- bônus de chance por refinamento;
- bônus de dano crítico por refinamento;
- variações por tipo de arma;
- possibilidade de “crítico de precisão” ou “crítico de abertura”;
- partículas e feedback quando o efeito ocorrer.

### Observação de equilíbrio
Crítico não pode substituir o dano base.  
Ele deve ser um multiplicador de emoção, não um atalho universal.

### Decisão importante
O sistema não deve depender de tentar adivinhar o crítico vanilla.  
O ideal é que o StatsCore tenha sua própria lógica interna e leitura consistente.

---

## 6.2. Módulo de penetração de armadura

### Situação atual
A ideia 2 continuará, mas com mudança: em vez de ignorar totalmente armadura, será usada uma porcentagem de armadura ignorada.

### Direção de design
Isso é melhor do que dano “mágico” puro porque:
- preserva leitura de combate;
- permite escalar por tiers;
- evita um salto de poder abrupto;
- mantém valor de armaduras inimigas e do jogador.

### Possibilidades de progressão
- 5% de penetração em tiers baixos;
- 10% a 25% como faixa intermediária;
- 30%+ apenas em equipamentos de alto refinamento ou raridade muito específica.

### Regras de controle
- limite máximo por arma;
- limite adicional por categoria;
- redução opcional contra bosses;
- sinergia com crítico ou efeitos elementais.

### Resultado esperado
A arma continua respeitando o combate, mas se torna claramente melhor contra alvos resistentes.

---

## 6.3. Módulo de efeitos elementais e condicionais

### Situação atual
A ideia 3 será mantida como direção principal e aprofundada depois.

### Direção de design
Esse módulo deve ser tratado como uma família de efeitos, não como uma lista avulsa.

### Efeitos prováveis
- veneno;
- lentidão;
- fogo;
- choque;
- drenagem;
- fraqueza;
- marcação;
- dano adicional contra alvos queimando;
- execução de alvo em estado específico.

### Princípio de design
Os efeitos devem nascer de contexto, não apenas de sorte.

Exemplos:
- golpe crítico pode aplicar um efeito leve;
- golpes consecutivos podem intensificar um debuff;
- alvo queimando pode receber dano extra;
- alvo afetado por outro estado pode sofrer reação em cadeia.

### O que evitar
- excesso de efeitos simultâneos;
- efeitos sem telemetria visual;
- combos que tornem o combate ilegível.

### Regra de ouro
Um item forte pode ter dois ou três efeitos marcantes, mas não uma enciclopédia ambulante.

---

## 6.4. Módulo de roubo de vida

### Situação atual
A ideia 4 é considerada perfeita e entra como componente central.

### Direção de design
Roubo de vida deve ser direto, confiável e fácil de entender.

### Formas de implementação conceitual
- cura percentual do dano causado;
- cura fixa por acerto;
- cura maior em críticos;
- cura reduzida contra alvos fracos para impedir abuso;
- cura condicionada a targets de maior ameaça.

### Risco de equilíbrio
Roubo de vida muito alto mata a tensão.  
A função dele é sustentar, não anular dano recebido.

### Uso ideal
- armas de agressão constante;
- builds que enfrentam vários alvos;
- equipamentos de sobrevivência sem depender só de armadura.

---

## 6.5. Módulo de frenesi / stack ofensivo

### Situação atual
A ideia 5 provavelmente será descontinuada.

### Direção de design
Ela fica registrada apenas como referência histórica.

### Motivo da exclusão
O stack de força crescente por kill tende a:
- escalar rápido demais;
- reduzir o medo de combate;
- transformar sequência em dominância automática;
- invalidar parte do balanceamento do mundo.

### Possível substituto futuro
Se um dia o conceito voltar, ele deve vir com:
- limite rígido de stacks;
- tempo de decaimento;
- custo de manutenção;
- benefício menor e mais estratégico.

Por agora, o sistema não deve depender dele.

---

## 6.6. Módulo de especialização contextual

### Situação atual
A ideia 6 não será orientada por família de mob nem por tipo específico como regra forte.

### Direção de design
O foco deve ser mais universal e menos dependente de alvos concretos.

### Modelo ideal
Em vez de “forte contra X”, usar:
- bônus por ação;
- bônus por ritmo;
- bônus por comportamento;
- bônus por estado do inimigo;
- bônus por sequência de uso;
- bônus por risco assumido.

### Por que isso é melhor
- evita nichos estreitos demais;
- mantém o sistema útil em qualquer região;
- reduz dependência de bestiário específico.

---

## 6.7. Módulo de alcance e velocidade de ataque

### Situação atual
A ideia 7 será descartada.

### Motivo
Ela esbarra em uma área que não vale forçar como eixo central do sistema.

### Encaminhamento
Esse espaço de design deve ser ocupado por:
- frequência de uso;
- tempo de resposta;
- janela de recarga;
- peso do item;
- custo por sequência;
- sensação de fluidez.

Ou seja: sem mexer em alcance direto, ainda dá para alterar o ritmo da arma.

---

## 7. Sistemas auxiliares

## 7.1. Sistema de afinidade
Cada item pode tender para uma função principal:
- agressão;
- sustentação;
- mineração;
- controle;
- precisão;
- explosão;
- técnica;
- sobrevivência.

A afinidade deve orientar quais bônus o item pode absorver melhor.

## 7.2. Sistema de raridade funcional
A raridade não deve ser só estética.  
Ela pode definir:
- teto de atributos;
- quantidade de slots;
- chance de efeitos únicos;
- custo de refinamento;
- velocidade de crescimento.

## 7.3. Sistema de custo
Todo ganho relevante deve cobrar algo:
- durabilidade;
- recursos de refinamento;
- tempo;
- chance reduzida em situações fortes;
- necessidade de manutenção;
- limitação de sinergia.

## 7.4. Sistema de feedback
O jogador precisa entender quando algo acontece:
- partículas;
- som;
- brilho;
- mensagens discretas;
- animação;
- indicação de stack;
- feedback de acerto crítico.

---

## 8. Categorias de itens no StatsCore

### 8.1. Armas ofensivas
Foco em:
- dano;
- crítico;
- penetração;
- efeitos de combate;
- sustentação por kill.

### 8.2. Ferramentas de mineração
Foco em:
- bônus de minério;
- eficiência;
- chance de drop melhorado;
- afinidade por rocha/mineral;
- reações a blocos especiais.

### 8.3. Itens híbridos
Foco em:
- uso versátil;
- dano moderado;
- mineração razoável;
- bônus utilitário;
- progressão lenta, mas ampla.

### 8.4. Itens de suporte
Foco em:
- cura;
- buffs;
- proteção;
- controle de área;
- reação a eventos.

---

## 9. Eventos que devem alimentar o sistema

O StatsCore precisa ser abastecido por eventos relevantes, como:

- quebra de bloco;
- mineração bem-sucedida;
- acerto em entidade;
- morte de entidade;
- uso do item;
- início e fim de uso;
- impacto de status;
- troca de item;
- desativação/ativação temporária;
- rotação de alvo;
- evento de hit crítico interno;
- exploração de áreas de alto risco.

Cada evento deve gerar uma consequência previsível.

---

## 10. Progressão

## 10.1. Níveis
O item pode subir de nível conforme uso.

## 10.2. Marcos
Alguns níveis devem destravar efeitos maiores, e não apenas números.

Exemplo de marcos:
- desbloqueio de atributo novo;
- aumento de teto;
- abertura de slot;
- redução de custo;
- upgrade de efeito visual;
- alteração de comportamento.

## 10.3. Ramos
Depois de certo ponto, o item pode seguir em um ramo especializado:
- combate;
- mineração;
- suporte;
- híbrido;
- técnico.

## 10.4. Reforço final
No topo da progressão, o item não deve apenas ser mais forte.  
Ele deve parecer “concluído” em uma identidade específica.

---

## 11. Sistema de balanceamento

### 11.1. Limites por categoria
Armas, ferramentas e itens híbridos não devem usar a mesma escala sem ajuste.

### 11.2. Limite de atributos simultâneos
Um item não pode receber tudo.

### 11.3. Troca entre poder e estabilidade
Quanto mais forte, mais:
- caro;
- instável;
- restrito;
- lento de manter;
- dependente de contexto.

### 11.4. Controle de snowball
O sistema não pode permitir que um item forte se torne automaticamente infinito em potência.

### 11.5. Controle de repetição
Efeitos precisam ter:
- cooldown;
- condição de ativação;
- taxa de queda;
- variação de ganho.

---

## 12. Linguagem interna de design

Para manter o sistema coeso, vale tratar alguns termos internos assim:

- **Crit:** acerto especial do sistema
- **Penetração:** parte da defesa ignorada
- **Marca:** estado aplicado ao alvo
- **Frenesi:** estado temporário de aceleração ofensiva
- **Refino:** estágio de evolução do item
- **Essência:** recurso interno de progressão
- **Afinidade:** tendência do item para certo estilo
- **Fluxo:** ritmo sustentado de uso ou combate

Essa linguagem ajuda o sistema a parecer um subsistema único, e não um amontoado de bônus.

---

## 13. Ordem de implementação sugerida

### Fase 1 — Fundação
- definir estrutura de dados;
- definir leitura e gravação de estado do item;
- definir tipos de item suportados;
- definir eventos-base.

### Fase 2 — Combate
- crítico próprio;
- penetração parcial de armadura;
- roubo de vida;
- efeitos condicionais básicos.

### Fase 3 — Mineração
- refinamento por blocos;
- bônus de coleta;
- melhorias de drop;
- estados ligados ao uso contínuo.

### Fase 4 — Progressão
- níveis;
- marcos;
- afinidades;
- ramos.

### Fase 5 — Polimento
- feedback visual;
- som;
- partículas;
- regras finais de balanceamento.

---

## 14. Riscos do sistema

### Risco 1: excesso de complexidade
Se tudo crescer ao mesmo tempo, o jogador perde a leitura.

### Risco 2: dano demais cedo demais
Isso mata a tensão da exploração.

### Risco 3: bônus sem custo
Isso banaliza o refinamento.

### Risco 4: sistema genérico demais
Se tudo fizer a mesma coisa, o StatsCore vira planilha.

### Risco 5: sistema nichado demais
Se cada bônus depender de uma criatura ou situação muito específica, o uso vira artificial.

---

## 15. Resultado desejado

No fim, o StatsCore deve fazer o jogador sentir que:

- a arma tem história;
- o equipamento evolui com o uso;
- o combate reage ao estilo dele;
- a mineração também pode ser expressão de progressão;
- explorar lugares perigosos vale a pena;
- poder existe, mas não sem custo.

---

## 16. Estado atual das ideias

### Mantidas
- ideia 1: crítico próprio;
- ideia 2: penetração parcial de armadura;
- ideia 3: efeitos elementais e condicionais;
- ideia 4: roubo de vida;
- ideia 6: especialização sem foco extremo em alvos específicos.

### Descontinuadas
- ideia 5: frenesi de força por kill;
- ideia 7: alteração de alcance de ataque.

---

## 17. Próximo passo natural

O próximo documento pode ser um destes:
- tabela de atributos com valores por tier;
- árvore de progressão do StatsCore;
- lista de efeitos elementais com regras;
- estrutura de dados para itens refináveis;
- plano de implementação por handlers.

