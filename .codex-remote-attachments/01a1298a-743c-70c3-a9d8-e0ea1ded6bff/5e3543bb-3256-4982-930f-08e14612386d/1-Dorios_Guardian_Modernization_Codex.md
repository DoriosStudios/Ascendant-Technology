# Dorios Guardian — Plano de modernização e Dashboard

> **Instrução para o Codex no workspace existente.** Implementar uma evolução incremental do Dorios Guardian, sem reconstruí-lo do zero e sem remover funcionalidades atuais.
>
> **Idioma da interface:** inglês por padrão, com organização que permita localização futura. Este documento está em português para facilitar revisão pela equipe.

## Objetivo

Transformar o Guardian num sistema leve e confiável de administração do Dorios Studios, com **Dashboard web hospedável no Railway**, histórico persistente, auditoria de ações, moderação configurável, registros compactos de entrada/saída e manutenção dos comandos existentes do Discord (inclusive o prefixo configurável, atualmente `g!`, e o `export queue`).

**Princípios inegociáveis:** preservar dados e compatibilidade, rastrear cada decisão administrativa, não inventar histórico indisponível, não punir automaticamente ambiguidades, aplicar privilégios mínimos e evitar spam/embeds enormes nos canais de logs.

## 0. Primeiro passo: auditoria do código existente

Antes de criar arquivos, inspecione:

1. Stack, versão de runtime e biblioteca Discord; entrypoints, handlers de comandos, jobs e sistema de configuração/prefixo.
2. Implementações atuais de warns, bans, kicks, mutes/timeouts, reversões, purge, export individual, `export queue`, resolução de menções, embeds v3, permissões e logs.
3. Persistência atual, migrations, testes, deployment Railway e variáveis de ambiente.
4. Se já existem sistema OAuth, API HTTP ou painel, reaproveite-os.

Crie um resumo curto da arquitetura atual e registre lacunas antes de modificar código. **Não suponha que o bot esteja escrito em JavaScript/TypeScript, nem adote uma framework nova antes de inspecionar o projeto.** Não faça refactors não relacionados.

## 1. Arquitetura proposta e Railway

Preferência para uma topologia com três serviços no mesmo projeto/ambiente do Railway:

- **`guardian-bot`**: conexão Gateway e interações com a API Discord; worker responsável por aplicar ações administrativas. Sem domínio público, a menos que alguma integração existente realmente exija.
- **`guardian-dashboard`**: aplicação web responsiva, API segura, OAuth2 com Discord e páginas de consulta/configuração. Único serviço que necessita de domínio público HTTPS (`*.up.railway.app` ou domínio próprio).
- **`postgres`**: banco PostgreSQL persistente, acessível pela rede privada do Railway, sem exposição pública.

Compartilhe o banco através de variáveis de referência, não de credenciais hardcoded. Se o projeto já possui persistência robusta, proponha migração incremental; **não descarte dados antigos**. Evite Redis, microserviços e outras dependências adicionais até existir necessidade demonstrada. Para jobs de ações web, prefira inicialmente uma tabela de jobs no Postgres, com leasing, status, tentativas e idempotência. O dashboard cria jobs; o processo bot os valida novamente e executa. O painel não deve depender de possuir ou expor o token do bot.

Exija health endpoints, reconexão controlada, encerramento gracioso, migrations versionadas e logs operacionais sem dados sensíveis. Inclua instruções de deploy por serviço no README, com root directory/start command/PORT conforme a stack real; o web server deve ouvir em `0.0.0.0` na porta disponibilizada pelo Railway. Liste custos e recursos como fatores variáveis, sem alegar hospedagem gratuita permanente.

## 2. Acesso ao Dashboard: Discord OAuth2 e RBAC

Autenticação por **OAuth2 Authorization Code** do Discord, utilizando somente os escopos estritamente necessários (inicialmente `identify` e, se necessário para seleção, `guilds`).

- Usar `state` anti-CSRF; aplicar PKCE quando compatível; redirect URI allowlisted; cookies de sessão `HttpOnly`, `Secure`, `SameSite` adequado; regenerar sessão após login e invalidar no logout.
- Não salvar access/refresh tokens no localStorage nem repassá-los ao navegador desnecessariamente. Criptografar ou evitar armazenar tokens em repouso.
- **Toda rota de API verifica a sessão e a autorização no servidor.** Esconder botões no frontend não é autorização.
- Permitir apenas guilds onde o Guardian esteja instalado e usuários com permissão explícita. Revalidar vínculo, papéis e permissões sensíveis periodicamente e antes de executar uma ação; cache curto com invalidação quando os cargos mudarem.
- Definir permissões separadas: `viewer` (métricas não sensíveis), `moderator` (casos da sua jurisdição), `administrator` (configuração e ações elevadas), `owner` (controle total) e `auditor` (acesso a logs confidenciais sem necessariamente poder punir). Implementar RBAC no servidor e auditar acessos aos registros sensíveis.
- **Não usar somente o nome do cargo** como prova de privilégio; conferir IDs de cargo, permissões reais e configuração da guild. Negar acesso por padrão.
- Rate limit por usuário/IP para login e APIs, validação de dados, paginação, escaping contra XSS, proteção CSRF em mutações, headers de segurança/CSP e tratamento seguro de erros. Nunca enviar tokens, secrets, mensagens apagadas ou denúncias para logs públicos.
- Para ações de alto impacto (ban, revogação em massa, alteração de política automática, exportação de logs confidenciais), exigir confirmação explícita, justificativa e registro da identidade do executor.

## 3. Dashboard — páginas e UX

Uma interface limpa, legível e rápida, agradável tanto no PC quanto no celular. Dar prioridade à utilidade, não animações pesadas. Adotar UI consistente com tema claro/escuro e componentes acessíveis.

### Páginas mínimas

1. **Overview** — estado do bot, uptime desde inicialização, latência útil, versões e módulos ativos; entradas/saídas recentes, ocorrências abertas, eventos com falha e tendências de moderação. Gráficos com intervalo selecionável (24h, 7d, 30d e customizado); não confundir falta de coleta com zero atividade.
2. **Activity / Events** — timeline unificada, busca e filtros por data, usuário/ID, canal, tipo de evento, executor, gravidade e origem (`gateway`, `audit_log`, `guardian`, `import`). Cada evento mostra link para Discord quando disponível; detalhes aparecem sob demanda, não em cards gigantes.
3. **Moderation / Cases** — tabela de casos, status, alvo, executor, motivo, evidências, recursos e histórico completo de revisões; suporte a vincular diversos eventos a um caso.
4. **Members** — pesquisa por ID/nome, primeiro registro conhecido, entradas e saídas observadas, cargos atuais, warns ativos/revogados, ações anteriores e aliases verificados. Indicar dados incompletos, nunca apresentar estimativa como fato.
5. **AutoMod / Rules** — configuração por guild/canal/idioma, regras, exceções de canal/cargo, monitor-only, simulação com texto de teste e revisão de falsos positivos.
6. **Settings / Log Routing** — selecionar destinos para join/leave/moderation/audit/system, formato compacto, situações especiais, timezone, prefixo existente e política de retenção.
7. **System** — checagem dos intents/permissões, erros recentes, fila de jobs, status das exportações, tarefas falhas e estado das integrações.

Permitir deep-links permanentes para páginas de casos e eventos. Configurações devem ser salvas pelo backend com trilha de auditoria: quem mudou, antes/depois e horário.

## 4. Logs de entrada e saída: **compactos por padrão**

Esse comportamento é um requisito de UX, não uma otimização opcional. Não gerar embed grande, miniatura, avatar, banner ou card de múltiplos campos para cada membro comum.

**Formato padrão:** uma linha, no máximo duas, sem ping real por padrão (`allowed_mentions` desativado). Exemplos ilustrativos:

```text
[JOIN] @ExampleUser · 123456789012345678 · 18:04 · primeiro registro
[JOIN] @ExampleUser · 123456789012345678 · 19:10 · retorno #3
[LEAVE] @ExampleUser · 123456789012345678 · 20:42 · motivo não identificado
[KICK] @ExampleUser · 123456789012345678 · moderador: @Moderator · caso MOD-0042
[BAN] @ExampleUser · 123456789012345678 · caso MOD-0043
```

Observações:

- Mostrar o nome de exibição e o ID imutável. Se mencionar o usuário, suprimir notificações automáticas. Fallback para texto simples se embed for desnecessário.
- Armazenar timestamps em UTC; permitir timezone para exibição (configurável, padrão `America/Bahia` no Dorios Studios).
- Não afirmar que toda remoção de membro foi voluntária: correlacionar com ban/kick e Audit Log, aguardando uma janela curta por eventual chegada tardia do evento de auditoria. Se não houver confirmação, usar **unknown**, não **left voluntarily**.
- Histórico de entradas: apenas desde o início da coleta, mais importações comprovadas. Não inventar a primeira entrada histórica; quando possível, exibir `first_seen_at`, `first_join_observed_at`, `current_joined_at` e `last_left_at` separados.
- Evitar que múltiplos bots publiquem alertas redundantes; deduplicar pelo evento real.

### Quando expandir para embed detalhado?

Somente com regra configurável para situações excepcionais verificáveis, por exemplo:

- Retorno de membro anteriormente banido, quando esse histórico for confirmado.
- Entrada repetida em período curto definida por limiar configurável, sem presumir má-fé.
- Padrão de raid detectado em agregado, em alerta específico de incidente (não um card individual enorme por novo usuário).
- Mudança de cargo ou permissão administrativa sensível relacionada ao membro.
- Saída decorrente de ban/kick relevante com justificativa, caso e decisão registrada.

Em situações especiais, publicar **resumo conciso com botão/link para o detalhe no Dashboard**; permitir embed mais completo apenas se explicitamente configurado. Não aplicar punição automaticamente só porque a conta é nova ou voltou ao servidor.

## 5. Núcleo de eventos e trilha de auditoria

Implementar um modelo de eventos durável, com schema e migrations, adaptado às estruturas atuais:

- `events`: ID interno estável, guild, tipo, UTC, alvo, executor, fonte, ID externo, correlação, payload estruturado, nível de confidencialidade, status de captura.
- `moderation_cases`: ID legível, guild, alvo, categoria, motivo, status, severidade, resolução, timestamps.
- `case_events`: vínculo entre caso e eventos (aplicação, aviso, expiração, revogação, recurso, decisão).
- `member_visits`: join/leave observado, motivo evidenciado, origem e status de correlação.
- `settings`, `log_routes`, `automod_rules`, `audit_access`, `jobs`.

**Punições nunca somem do histórico quando revogadas.** Preservar ação original, revogação, responsáveis, horário e justificativas. Exibir warns ativos e revogados separadamente. Em caso de ação sem justificativa, bloquear novos comandos de punição disciplinar até ser informado motivo, exceto ação de emergência devidamente marcada e justificada em seguida.

Correlacionar Gateway, Guardian e Audit Log com chaves de idempotência e janelas temporais; não supor que duas ocorrências semelhantes sejam automaticamente o mesmo evento. Guardar `source_event_id` quando existir. Diferenciar:

1. moderador que **solicitou** a ação;
2. identidade que a **executou** via API (por vezes o Guardian);
3. executor identificado pelo **Discord Audit Log**;
4. processo/bot que apenas **publicou o registro**.

Criar reconciliação periódica e sinalizar lacunas, atrasos e discrepâncias. Lembrar que o Audit Log nativo possui janela limitada de retenção; coletá-lo de forma incremental enquanto disponível, não prometer backfill total.

Para `message_delete` e `message_update`: só registrar conteúdo anterior quando estiver legalmente/autorizadamente disponível em cache ou coletado no momento do evento. Não afirmar que é possível recuperar qualquer mensagem apagada retroativamente. Preservar embeds/attachments existentes como metadados e links, sem download indiscriminado. Em purges, registrar contagem, canal, executor, critérios e IDs recuperáveis; não pressupor que cada mensagem purgada corresponda a uma infração.

Para ações de moderação: causas, política aplicada, contexto mínimo e recurso; para ações revertidas: quem aprovou a reversão e motivo obrigatório.

**Permissões sensíveis:** emitir alertas para mudanças em cargos com `Administrator`, `Manage Roles`, `Ban Members`, `Kick Members`, `Manage Guild` e para alterações de canais de log, configurações ou privilégios do próprio bot. Nunca tentar conceder a si mesmo permissões superiores às disponíveis.

## 6. AutoMod multilíngue, progressivo e explicável

Implementar uma camada configurável que aproveite o AutoMod nativo do Discord quando for adequado, evitando processar e punir novamente a mesma ocorrência.

**Idiomas:** inglês, português brasileiro e espanhol latino-americano; listas separadas, normalização prudente e exceções configuráveis. Detectar variantes óbvias com limites para não gerar falsos positivos. Não adotar IA externa para ler todas as mensagens por padrão.

**Níveis de ação:**

- `observe`: apenas registra uma regra acionada, sem punição;
- `review`: abre um alerta privado para moderação humana;
- `block`: bloqueia quando a capacidade de API/regra permitir; caso contrário, utiliza o mecanismo documentado de exclusão pós-envio, sinalizando que não foi bloqueio preventivo;
- `punish`: **desativado por padrão**. Liberar apenas para regras de alta confiança com política, cooldown, escalonamento, possibilidade de recurso e revisão humana para bans.

Palavrões isolados e brincadeiras não direcionadas não devem disparar punição. Priorizar spam, links maliciosos conhecidos, flooding, divulgação de dados privados e insultos discriminatórios explícitos; para expressões ambíguas, somente alerta. Permitir política distinta por canal, inclusive espaços multilíngues, e exceções funcionais, mas **não permitir que cargos de moderador escapem da trilha de auditoria**.

Colocar o módulo em `observe` no lançamento, coletar falsos positivos com métricas agregadas e exigir habilitação explícita para qualquer modo de intervenção. Toda ação deve abrir ou vincular um caso e mostrar a regra responsável.

## 7. Histórico de membros, importação e privacidade

- Coletar entradas e saídas futuras conforme eventos realmente disponibilizados pelo Discord e os intents habilitados.
- Considerar backfill opcional dos logs antigos de ProBot, Dyno e Guardian e dos exports v2/v3 **somente se os arquivos estiverem disponíveis ao processo e a permissão de importação for explícita**.
- Marcar importações como `historical_import` com origem, confiança e data de ingestão; deduplicar sem apagar evidências.
- Não inferir aliases por nome parecido. Permitir associação manual e auditada de contas de uma mesma pessoa, mantendo os IDs separados; não exibir essas associações fora da administração.
- Implementar retenção configurável por categoria (metadados de caso, evidências de mensagens apagadas, sessões, exportações), exclusão e exportação controladas. Evitar guardar mensagens completas de todos os canais indefinidamente quando não houver necessidade operacional.
- Dados de denúncias, recursos, exclusões e punições ficam fora de endpoints públicos e de logs gerais do serviço.

## 8. Comandos existentes e responsabilidades

Preservar compatibilidade dos comandos atuais, inclusive `g!export queue <amount> <channels...>`, seu prefixo configurável e o formato de exportação v3 (incluindo embeds). Não modificar silenciosamente sintaxe ou saídas existentes.

O Dashboard é a interface principal de configuração, pesquisa, histórico e revisão. O Discord mantém comandos rápidos e alertas. Se adicionar slash commands, fazê-lo como alternativa compatível, sem remover prefix commands já usados.

Sugestões de rotas/comandos para adaptar à arquitetura existente:

```text
g!case <id>
g!history <user>
g!status
g!export queue <amount> <channels...>
```

Se houver necessidade de ações de moderação, preferir formulários no Dashboard com checagem RBAC e confirmação. Qualquer job enfileirado na web deve ser **reautorizado pelo bot no momento da execução**, pois permissões podem mudar entre clique e execução. Usar chaves de idempotência para evitar ações duplicadas após retry/redeploy.

## 9. Etapas de execução — não construir tudo de uma vez

### Fase A — Fundação executável (entrega inicial)

1. Diagnosticar stack existente e listar arquivos/módulos afetados.
2. Adicionar/estender PostgreSQL, migrations, eventos idempotentes e histórico de ajustes administrativos sem perder dados anteriores.
3. Criar Dashboard mínimo **funcional e autenticado**: login Discord, Overview, Events, Members básico, Settings de roteamento, Status; RBAC real no backend.
4. Implementar logs compactos join/leave, com regra de expansão para eventos especiais e destinos configuráveis.
5. Documentar topologia Railway e variáveis; executar testes.

### Fase B — Moderação e rastreabilidade

6. Casos administrativos, reversões justificadas, auditoria de permissões e reconciliação com o Audit Log.
7. Tela de casos/recursos, filtro avançado e ações administrativas com confirmação e auditoria.

### Fase C — Proteção e histórico

8. AutoMod PT-BR/EN/ES inicialmente em observe/review; testes de falsos positivos, depois habilitação explícita de bloqueios.
9. Importação opcional dos dados históricos disponíveis, com proveniência, deduplicação e política de retenção.
10. Estatísticas, visualizações e melhorias de UX sem sacrificar performance.

**Nesta execução, entregue a Fase A completa antes de avançar.** Se houver tempo e contexto para B/C, avance em commits ou mudanças bem separadas e testadas. Não apresente recursos parcialmente implementados como concluídos; não crie apenas mockups desconectados do backend.

## 10. Testes e critérios de aceitação

Criar testes automatizados compatíveis com a base atual, cobrindo no mínimo:

- Join normal: **uma linha**, sem ping, com ID, horário correto e primeira observação.
- Rejoin confirmado: linha compacta com retorno; sem histórico fictício.
- Leave comum: sem afirmar voluntariedade; correlação posterior correta com kick/ban.
- Exceção configurada: resumo expandido apenas quando o gatilho documentado for atendido.
- Dois eventos de log referentes à mesma ação não geram duas punições nem duas entradas históricas.
- Warn removido continua no histórico com estado revogado, executor da reversão, horário e motivo.
- Ban via dashboard: exige login, autorização, justificativa, confirmação, revalidação no worker e gera um caso.
- Usuário comum, ex-moderador ou administrador de outra guild não consegue abrir ou executar rotas sensíveis por URL direta.
- Sessão revogada, CSRF, OAuth state inválido, tentativa de acesso entre guilds, job repetido e privilégios alterados durante a fila são tratados com segurança.
- Sem content intent, sem permissão de leitura ou sem audit entry correspondente: sistema mostra dados incompletos, nunca inventa autor/causa.
- AutoMod observa sem punir por padrão; linguagem coloquial, citações e falso positivo não criam sanção automaticamente.
- Export queue/v3 e comandos antigos continuam funcionando (testes de regressão).
- Dashboard permite filtrar eventos, paginar resultados, ver detalhes e salvar configurações reais no banco.
- Reinício/redeploy não perde casos, configurações, eventos nem jobs; worker lida com retries sem duplicar efeitos.

## 11. Documentação e entrega ao final

Entregar:

1. Resumo da arquitetura encontrada e escolhas técnicas (por que reutilizou ou acrescentou cada dependência).
2. Lista de arquivos modificados, schema e migrations.
3. Variáveis de ambiente necessárias (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_OAUTH_REDIRECT_URI`, `SESSION_SECRET`, `DATABASE_URL`, `PUBLIC_BASE_URL` e outras realmente utilizadas); fornecer `.env.example` **sem segredos**.
4. Procedimento exato de deploy para bot, dashboard e Postgres no Railway; domínio HTTPS, private network, startup/migrations, healthcheck e backup.
5. Screenshots ou descrição das páginas implementadas; exemplos reais da saída de log compacto e da exceção detalhada, sem dados privados.
6. Testes executados, resultados, pontos ainda não implementados e limitações documentadas.

**Não alterar regras de moderação nem executar punições reais durante testes.** Utilizar mocks ou guild de teste quando disponível. Não publicar o Dashboard antes de a autenticação e autorização estarem efetivamente funcionando. Não forçar migração destrutiva nem remover comandos, dados ou exports existentes.

---

## Referências de documentação oficial (consultar versões atuais antes de implementar)

- Railway — [Working with domains](https://docs.railway.com/networking/domains/working-with-domains)
- Railway — [Private networking](https://docs.railway.com/networking/private-networking)
- Railway — [PostgreSQL](https://docs.railway.com/databases/postgresql)
- Railway — [Variables](https://docs.railway.com/variables)
- Discord — [OAuth2](https://discord.com/developers/docs/topics/oauth2)
- Discord — [Privileged intents](https://support-dev.discord.com/hc/en-us/articles/6207308062871-What-are-Privileged-Intents)

**Critério global de sucesso:** um administrador autenticado abre o site Railway, pesquisa um membro e suas ações registradas, entende quem puniu e quem reverteu uma ação, configura destinos de logs e vê entradas/saídas em uma ou duas linhas; tudo isso sem reduzir a segurança, perder dados ou quebrar o Guardian atual.
