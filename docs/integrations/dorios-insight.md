# Dorios' Insight: integração opcional

O AT continua inicializando e aplicando os efeitos do StatsCore sem o Dorios' Insight. O Insight fornece o HUD dedicado dos efeitos personalizados, incluindo ícones, níveis, duração e cargas. A detecção procura a integração de efeitos disponível, não apenas uma API de actionbar.

Não há dependência obrigatória no manifest: a [declaração de dependência do Bedrock](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/manifestreference/dependency?view=minecraft-bedrock-stable) exige que o outro pacote esteja carregado. A dependência opcional é verificada em runtime pela ponte já existente.

Após `worldLoad`, o AT solicita a descoberta imediatamente e tenta novamente aos 40 e 80 ticks. Aos 100 ticks (cinco segundos nominais), a ausência da ponte gera um aviso no content log e uma mensagem localizada para cada jogador conectado. Quem entrar depois recebe o aviso após a mesma espera. Cada jogador é avisado uma vez por sessão; respawns não repetem a mensagem. Uma resposta posterior do Insight impede novos avisos.

## Comunicação atual entre pacotes

| Origem no AT | Destino no Insight | Uso |
| --- | --- | --- |
| `BP/scripts/ATCore/StatsCore/effects/insightBridge.js` | `BP/scripts/core/effects/titleHandler.js` | Descoberta, detecção e envio dos efeitos personalizados |
| `BP/scripts/ATCore/StatsCore/shared/messages.js` | `BP/scripts/core/actionbarQueue.js` | Fila de feedback na actionbar secundária |
| `BP/scripts/ATCore/StatsCore/feedback/index.js` | `BP/scripts/core/hud/statsCoreActivity.js` | Eventos de atividade do StatsCore |

Os IDs dos protocolos ficam em `BP/scripts/ATCore/StatsCore/config/definitions.js`; os tempos de descoberta e de inicialização ficam em `config/values.js`. O namespace usado para os efeitos é `ascendant.statscore`.

Para os efeitos, `insight:effects_discover_v1` solicita descoberta e `insight:effects_ready_v1` confirma a disponibilidade. `insight:effects_send_v1` envia um snapshot com `targetId`, `playerId` quando aplicável, `namespace`, `action: "replace"` e `effects`. Os eventos antigos `insight:custom_effects_{discover,ready,send}_v1` continuam aceitos; o protocolo moderno tem prioridade.

Quando a API é acessível no mesmo contexto, o AT usa `globalThis.DoriosAPI.insight.effects.replace(target, effects, namespace)` diretamente, aceitando o alias antigo `customEffects`. Se a chamada falha ou recusa a atualização, o envio usa `system.sendScriptEvent`. A simples emissão de um evento não prova a presença do Insight: é necessária a resposta `ready` ou uma API de efeitos disponível.

`effects/state.js` mantém os estados no AT e publica os snapshots pela ponte. No Insight, `core/effects/titleHandler.js` recebe os snapshots, atualiza o armazenamento e encaminha a renderização ao HUD dedicado. O atendimento visual depende de o resource pack do Insight também estar ativo; o handshake detecta a ponte de scripts, não confirma o carregamento da UI no cliente.

Teste direcionado: `node --experimental-vm-modules tools/test-insight-optional-dependency.mjs`.
