# Tório — quatro ícones de inventário

Direção fornecida pelo criador: **metal rosa chiclete**. “Cantos adiados” foi interpretado como quinas afiadas/chanfros discretos, mantendo a aparência normal de armadura. Foram pedidos somente os quatro ícones; cada um é PNG RGBA nativo 16×16.

![Set](../../../extras/generated_textures/thorium_set_preview.png)

Os quatro arquivos estão em `RP/textures/items/armor/thorium_{helmet,chestplate,leggings,boots}.png` e também na [pasta unificada de imagens](../../../extras/generated_textures/). Ela contém **59 PNGs e nenhum outro tipo de arquivo**: 54 artes nativas anteriores distintas, quatro ícones de Tório e uma imagem de apresentação. Texturas de blocos, animações e estudos antigos mantêm a resolução original; a preferência 16×16/24×24 aplica-se aos próximos ícones, não a uma redução destrutiva do histórico.

A coletânea preserva versões artísticas distintas e remove somente duplicatas de pixels. Referências externas, checkerboards, máscaras e a falha de QA artificial não são tratadas como novas texturas. A [proveniência](collection-provenance.json) fica aqui, fora da pasta de imagens.

## Construção e verificação

A composição combina `dorios-material-texturing` (paleta e regiões de equipamento) e `dorios-pixel-art-skill` (pixels, revisão e refinamento). O método de máscaras segue o gerador nativo de ferramentas de Forging Package: materiais são separados de forro/cavidades; pixels protegidos não são repintados. O gerador de ferramentas em si não foi executado para armaduras, uma família que ele não implementa.

Os modelos de inventário de Titânio do AT fornecem apenas forma e hierarquia de iluminação. Uma única transferência de papéis tonais é compartilhada entre as quatro peças. A paleta rosa e os pequenos detalhes são novos; não há alegação de uma paleta de Tório anterior no projeto.

- Silhueta e canal alfa idênticos aos respectivos modelos, sem redimensionamento.
- Forro e pixels fora das máscaras de metal preservados exatamente.
- Detalhes locais: testa/têmporas, junções do peitoral e cintura, joelhos, punhos e biqueiras. Sem novos chifres, asas ou ornamentos grandes.
- Quatro PNGs reabertos e validados; zero ERROR técnico. Três WARNING de agrupamentos de cor isolados foram mantidos.
- Segunda geração produziu os quatro arquivos idênticos por bytes. Tentativa de sobrescrever uma saída existente foi rejeitada sem alterar os PNGs.
- Uma chamada inicial ao perfil usou um dicionário onde a API esperava arquivo JSON. A chamada foi corrigida para um arquivo de requisitos; as duas gerações seguintes passaram.

[Verificação](verification.json), [paleta/decisões](design.json) e relatórios `final-review/*-evaluated.md` separam fatos técnicos e observações visuais. A aparência final continua sujeita à avaliação do criador.

## Reproduzir

Com Pillow e a skill instalada, na raiz do AT, use diretórios novos:

```powershell
python tools/generate-thorium-icons.py --output work/thorium-icons --report work/thorium-review
```

O comando mantém a saída PNG separada dos relatórios e rejeita substituição de arte existente. Não registra itens, receitas, atlas nem texturas vestidas, pois foram pedidos somente ícones.
