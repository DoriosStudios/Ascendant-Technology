import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
// English, Portuguese, Spanish, French, German, Russian, Japanese, Chinese.
const rows = `
Status|Estado|Estado|État|Status|Состояние|状態|状态
Machine Information|Informações da Máquina|Información de Máquina|Informations de la machine|Maschineninformationen|Информация о машине|機械情報|机器信息
Speed|Velocidade|Velocidad|Vitesse|Geschwindigkeit|Скорость|速度|速度
Efficiency|Eficiência|Eficiencia|Efficacité|Effizienz|Эффективность|効率|效率
Recipe Batch|Lote de Receitas|Lote de Recetas|Lot de recettes|Rezeptstapel|Пакет рецептов|レシピバッチ|配方批次
Cycle Cost|Custo por Ciclo|Costo por Ciclo|Coût par cycle|Zykluskosten|Стоимость цикла|サイクル消費|循环消耗
Energy Information|Informações de Energia|Información de Energía|Informations d'énergie|Energieinformationen|Информация об энергии|エネルギー情報|能量信息
Capacity|Capacidade|Capacidad|Capacité|Kapazität|Ёмкость|容量|容量
Stored|Armazenado|Almacenado|Stocké|Gespeichert|Запас|貯蔵量|储量
Rate|Taxa|Tasa|Débit|Rate|Скорость передачи|転送速度|速率
No Energy|Sem Energia|Sin Energía|Pas d'énergie|Keine Energie|Нет энергии|エネルギー不足|能量不足
Disabled|Desativado|Desactivado|Désactivé|Deaktiviert|Отключено|無効|已禁用
Invalid Direction|Direção Inválida|Dirección Inválida|Direction invalide|Ungültige Richtung|Неверное направление|無効な方向|无效方向
Charging|Carregando|Cargando|Chargement|Lädt|Зарядка|充電中|充能中
Invalid Block|Bloco Inválido|Bloque Inválido|Bloc invalide|Ungültiger Block|Неверный блок|無効なブロック|无效方块
Insert Blocks|Insira Blocos|Inserta Bloques|Insérer des blocs|Blöcke einlegen|Вставьте блоки|ブロックを入れてください|请放入方块
No Space|Sem Espaço|Sin Espacio|Pas de place|Kein Platz|Нет места|空きなし|空间不足
Placed|Colocados|Colocados|Placés|Platziert|Размещено|設置済み|已放置
Pattern Information|Informações do Padrão|Información del Patrón|Informations du motif|Musterinformationen|Информация о шаблоне|パターン情報|图案信息
Mode|Modo|Modo|Mode|Modus|Режим|モード|模式
Block|Bloco|Bloque|Bloc|Block|Блок|ブロック|方块
Available|Disponível|Disponible|Disponible|Verfügbar|Доступно|利用可能|可用
Targets|Alvos|Objetivos|Cibles|Ziele|Цели|対象|目标
Plane|Plano|Plano|Plan|Ebene|Плоскость|平面|平面
Cube|Cubo|Cubo|Cube|Würfel|Куб|立方体|立方体
Line|Linha|Línea|Ligne|Linie|Линия|直線|直线
Invalid Tool|Ferramenta Inválida|Herramienta Inválida|Outil invalide|Ungültiges Werkzeug|Неверный инструмент|無効な道具|无效工具
Output Full|Saída Cheia|Salida Llena|Sortie pleine|Ausgabe voll|Выход заполнен|出力が満杯|输出已满
Nothing to Break|Nada para Quebrar|Nada para Romper|Rien à casser|Nichts abzubauen|Нечего ломать|破壊対象なし|无可破坏方块
Tool Too Weak|Ferramenta Insuficiente|Herramienta Insuficiente|Outil insuffisant|Werkzeug zu schwach|Слабый инструмент|道具の強度不足|工具强度不足
Broke|Quebrados|Rotos|Cassés|Abgebaut|Сломано|破壊済み|已破坏
Breaking Information|Informações de Quebra|Información de Rotura|Informations de casse|Abbauinformationen|Информация о разрушении|破壊情報|破坏信息
Tool|Ferramenta|Herramienta|Outil|Werkzeug|Инструмент|道具|工具
Breaking Result|Resultado da Quebra|Resultado de Rotura|Résultat de casse|Abbauergebnis|Результат разрушения|破壊結果|破坏结果
Overflow|Excedente|Excedente|Excédent|Überschuss|Излишек|余剰|溢出
None (bare hand)|Nenhuma (sem ferramenta)|Ninguna (sin herramienta)|Aucun (à main nue)|Keines (mit der Hand)|Нет (голой рукой)|なし（素手）|无（徒手）
None|Nenhum|Ninguno|Aucun|Keine|Нет|なし|无
Scanning Field|Examinando Campo|Examinando Campo|Analyse du champ|Feld wird geprüft|Сканирование поля|畑を走査中|正在扫描农田
Invalid Soil|Solo Incompatível|Suelo Incompatible|Sol incompatible|Ungeeigneter Boden|Неподходящая почва|不適切な土壌|土壤不适合
Field Blocked|Campo Bloqueado|Campo Bloqueado|Champ bloqué|Feld blockiert|Поле заблокировано|畑が塞がれています|农田被阻挡
Biome Surge|Surto de Bioma|Impulso del Bioma|Impulsion du biome|Biomimpuls|Всплеск биома|バイオーム活性化|生物群系激增
Unsupported Seed|Semente Incompatível|Semilla Incompatible|Graine incompatible|Nicht unterstützter Samen|Неподдерживаемые семена|未対応の種|不支持的种子
Insert Seeds|Insira Sementes|Inserta Semillas|Insérer des graines|Samen einlegen|Вставьте семена|種を入れてください|请放入种子
Cultivating|Cultivando|Cultivando|Culture en cours|Ernte läuft|Выращивание|栽培中|正在栽培
Planting|Plantando|Plantando|Plantation|Pflanzen|Посадка|植え付け中|正在种植
Accelerating|Acelerando|Acelerando|Accélération|Beschleunigen|Ускорение|加速中|正在加速
Cultivated|Colhidos|Cosechados|Récoltés|Geerntet|Собрано|収穫済み|已收获
Planted|Plantados|Plantados|Plantés|Gepflanzt|Посажено|植え付け済み|已种植
Growth Pulsed|Crescimento Acelerado|Crecimiento Acelerado|Croissance accélérée|Wachstum beschleunigt|Рост ускорен|成長を加速|已加速生长
Monitoring|Monitorando|Monitoreando|Surveillance|Überwachen|Наблюдение|監視中|监测中
Field|Campo|Campo|Champ|Feld|Поле|畑|农田
Seed Patterns|Padrões de Sementes|Patrones de Semillas|Motifs de graines|Samenmuster|Шаблоны семян|種のパターン|种子图案
Clock|Relógio|Reloj|Horloge|Uhr|Часы|時計|时钟
Off|Desligado|Apagado|Arrêt|Aus|Выкл.|オフ|关闭
Plants per Pulse|Plantas por Pulso|Plantas por Pulso|Plantes par impulsion|Pflanzen pro Impuls|Растений за импульс|パルスごとの植物|每次脉冲植物数
Buffer|Armazenamento|Almacenamiento|Stockage|Puffer|Буфер|バッファ|缓冲区
Biome Bonus|Bônus de Bioma|Bono de Bioma|Bonus de biome|Biombonus|Бонус биома|バイオームボーナス|生物群系加成
Cultivator Information|Informações do Cultivador|Información del Cultivador|Informations du cultivateur|Kultivatorinformationen|Информация о культиваторе|栽培機情報|栽培机信息
Field Operation|Operação do Campo|Operación del Campo|Opération du champ|Feldbetrieb|Работа на поле|畑の作業|农田作业
Harvest Targets|Alvos de Colheita|Objetivos de Cosecha|Cibles de récolte|Ernteziele|Цели сбора|収穫対象|收获目标
Plant Targets|Alvos de Plantio|Objetivos de Siembra|Cibles de plantation|Pflanzziele|Цели посадки|植え付け対象|种植目标
Growth Pulses|Pulsos de Crescimento|Pulsos de Crecimiento|Impulsions de croissance|Wachstumsimpulse|Импульсы роста|成長パルス|生长脉冲
Last Cycle|Último Ciclo|Último Ciclo|Dernier cycle|Letzter Zyklus|Последний цикл|前回のサイクル|上次循环
Harvested|Colhidos|Cosechados|Récoltés|Geerntet|Собрано|収穫済み|已收获
Pulsed|Acelerados|Acelerados|Accélérés|Beschleunigt|Ускорено|加速済み|已加速
Accelerator|Acelerador|Acelerador|Accélérateur|Beschleuniger|Ускоритель|加速器|加速器
Diamond|Diamante|Diamante|Diamant|Diamant|Алмаз|ダイヤモンド|钻石
Nether Star|Estrela do Nether|Estrella del Nether|Étoile du Nether|Netherstern|Звезда Незера|ネザースター|下界之星
Plains Bloom|Florescimento das Planícies|Floración de Llanuras|Floraison des plaines|Ebenenblüte|Цветение равнин|平原の開花|平原繁盛
Tidal Surge|Surto das Marés|Oleada de Mareas|Poussée des marées|Gezeitenschub|Прилив|潮流|潮汐涌动
Bog Bloom|Florescimento do Pântano|Floración del Pantano|Floraison du marais|Sumpfblüte|Цветение болот|沼地の開花|沼泽繁盛
Flower Burst|Explosão Floral|Explosión Floral|Explosion florale|Blütenexplosion|Всплеск цветения|花の開花|繁花绽放
Nether Resonance|Ressonância do Nether|Resonancia del Nether|Résonance du Nether|Netherresonanz|Резонанс Незера|ネザーの共鳴|下界共鸣
`.trim().split('\n').map(line => line.split('|'));
const locales = { en_US: 0, pt_BR: 1, pt_PT: 1, es_ES: 2, es_MX: 2, fr_FR: 3, de_DE: 4, ru_RU: 5, ja_JP: 6, zh_CN: 7 };
const key = text => 'ui.ascendant:machine_info.' + text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_$/, '');
for (const [locale, column] of Object.entries(locales)) {
    const file = new URL(`RP/texts/${locale}.lang`, root);
    const source = readFileSync(file, 'utf8').replace(/^ui\.ascendant:machine_info\.[^\r\n]*(?:\r?\n|$)/gm, '').trimEnd();
    writeFileSync(file, source + '\n' + rows.map(row => `${key(row[0])}=${row[column]}`).join('\n') + '\n');
}
writeFileSync(new URL('BP/scripts/config/machineInfoTerms.js', root), '// Generated by tools/generate-machine-info-locales.mjs\nexport const machineInfoTerms = ' + JSON.stringify(Object.fromEntries(rows.map(row => [row[0], key(row[0])])), null, 4) + ';\n');
console.log(`Generated ${rows.length} machine information terms for ${Object.keys(locales).length} locales.`);
