Aqui residem as principais instruções de interface do usuário para o projeto Ascendant Technology. Use este arquivo para definir diretrizes, padrões e melhores práticas para a criação e manutenção de elementos de interface do usuário dentro do projeto. Também usado para esclarecer algumas confusões comuns relacionadas à interface do usuário.

# Arrays e UI e suas posições

Arrays em elementos dentro de `RP/ui/.*json` sempre seguem um tamanho próprio, com definições um tanto quanto controvérsas.

- `"size": [LARGURA, ALTURA]`
    - Este elemento não define o tamanho em pixels, então é difícil determinar corretamente o que cada valor representa. No entanto, eles são mostrados na simples fórmula "[x, y]", onde "x" é a largura e "y" é a altura.
- `"anchor_from"` e `"anchor_to"`
    - Estes elementos definem o ponto de ancoragem para o elemento UI. Ambos os valores devem ser idênticos e podem ser quaisquer dos seguintes:
        - Parâmetros válidos:
            - `"top_left"`
            - `"top_middle"`
            - `"top_right"`
            - `"center_left"`
            - `"center"`
            - `"center_right"`
            - `"bottom_left"`
            - `"bottom_middle"`
            - `"bottom_right"`
        - Estes parâmetros definem onde o elemento será ancorado em relação ao seu contêiner pai. Muitas das vezes, o offset e seus valores negativos e positivos se invertem. Se o elemento for ancorado em `"top_left"`, então valores positivos de offset moverão o elemento para baixo e para a direita, enquanto valores negativos o moverão para cima e para a esquerda.
- `"offset": [X, Y]`
    - Define o deslocamento do elemento em relação ao ponto de ancoragem. O primeiro valor representa o deslocamento horizontal (X), enquanto o segundo valor representa o deslocamento vertical (Y). Valores positivos movem o elemento para a direita (X) e para baixo (Y), enquanto valores negativos movem o elemento para a esquerda (X) e para cima (Y). Então, quando uma instrução conter "mova elemento x 5 pixels para a esquerda", o valor X do offset deve aplicar -5 ao valor X do offset.

# Commons

Arquivos de UI contém "commons", que são arquivos que reúnem elementos reutilizáveis para serem usados em múltiplos locais. Estes arquivos são encontrados em `RP/ui/ascendant_common.json` e devem ser referenciados usando o prefixo do common especificado, seguido do nome do elemento.
Atualmente, possuímos os seguintes commons:
- `ascendant_common.json`: Contém elementos comuns para a interface do usuário do Ascendant Technology, como botões, barras de progresso, fundos, etc.
- `common_machinery.json` e `machineryCommon.json`: Contém elementos comuns específicos para máquinas, como indicadores de status, botões de controle, etc.
- `ui_common.json`: Contém elementos comuns para a interface do usuário geral, como botões, barras de progresso, fundos, etc. É o common vanilla principal.
