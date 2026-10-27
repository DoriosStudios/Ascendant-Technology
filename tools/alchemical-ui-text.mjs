import { readFile, writeFile, readdir } from "node:fs/promises";
import { ALCHEMY } from "../BP/scripts/config/alchemy.js";
import { BREWING_RECIPES } from "../BP/scripts/ATCore/alchemy/recipes.js";

const root = new URL("../RP/texts/", import.meta.url);
// Order: display, recipes, progression, brewing, upgrades, hide, show;
// then the seven potion stages and the ingredient/operation explanations.
const texts = {
    en: {
        tabs: ["Display", "Recipes", "Potion progression", "Brewing", "Potion upgrades", "Hide panel", "Show panel"],
        stages: ["Regular potion", "Splash potion", "Lingering potion", "Amplified potion (+1)", "Amplified potion (+2)", "Extended potion (+1)", "Maximum potion"],
        ingredients: ["Gunpowder", "Dragon's Breath", "Redstone", "Liquid Aetherium"],
        notes: ["General duration range.\nDepends on the effect.\nInstant effects have no duration.",
            "Regular potion + Gunpowder.\nKeeps its level and duration.",
            "Splash potion + Dragon's Breath.\nEach cloud effect lasts 1/4\nof the drinkable duration.",
            "I -> II, where supported.\nAmplify once; keeps duration.",
            "I -> II -> III, where supported.\nAmplify twice from level I.\nKeeps duration.",
            "Level I + Redstone, or\nuse Extend with Aetherium.\nKeeps the potion's level.",
            "Maximum level depends on effect.\nAmplify to its limit, then\nExtend twice from normal.\nInstant effects cannot be extended."],
        duration: "Duration", cost: "Aetherium per operation", twice: "Two operations from level I", max: "Repeat Amplify and Extend\nuntil the effect's limits.\nAmplify: {a} mB per level.\nExtend: {e} mB per step.",
    },
    pt: {
        tabs: ["Display", "Receitas", "Progressão das poções", "Preparo de poções", "Melhorias das poções", "Ocultar painel", "Mostrar painel"],
        stages: ["Poção comum", "Poção arremessável", "Poção persistente (lingering)", "Poção amplificada (+1)", "Poção amplificada (+2)", "Poção estendida (+1)", "Poção máxima"],
        ingredients: ["Pólvora", "Bafo do Dragão", "Redstone", "Aetherium líquido"],
        notes: ["Faixa geral de duração.\nDepende do efeito.\nEfeitos instantâneos não têm duração.",
            "Poção comum + Pólvora.\nMantém o nível e a duração.",
            "Arremessável + Bafo do Dragão.\nCada efeito da nuvem dura 1/4\nda duração da poção comum.",
            "I -> II, quando disponível.\nAmplifique uma vez.\nMantém a duração.",
            "I -> II -> III, quando disponível.\nAmplifique duas vezes desde I.\nMantém a duração.",
            "Nível I + Redstone, ou\nuse Estender com Aetherium.\nMantém o nível da poção.",
            "Nível máximo depende do efeito.\nAmplifique até o limite e\nestenda duas vezes desde normal.\nInstantâneas não podem ser estendidas."],
        duration: "Duração", cost: "Aetherium por operação", twice: "Duas operações desde o nível I", max: "Repita Amplificar e Estender\naté os limites do efeito.\nAmplificar: {a} mB por nível.\nEstender: {e} mB por etapa.",
    },
    es: {
        tabs: ["Estado", "Recetas", "Progresión de pociones", "Preparar pociones", "Mejorar pociones", "Ocultar panel", "Mostrar panel"],
        stages: ["Poción común", "Poción arrojadiza", "Poción persistente", "Poción amplificada (+1)", "Poción amplificada (+2)", "Poción extendida (+1)", "Poción máxima"],
        ingredients: ["Pólvora", "Aliento de dragón", "Redstone", "Aetherium líquido"],
        notes: ["Rango general de duración.\nDepende del efecto.\nLos efectos instantáneos no duran.", "Común + Pólvora.\nConserva nivel y duración.",
            "Arrojadiza + Aliento de dragón.\nCada efecto de la nube dura 1/4\nde la duración bebible.", "I -> II, si se admite.\nAmplifica una vez.\nConserva la duración.",
            "I -> II -> III, si se admite.\nAmplifica dos veces desde I.\nConserva la duración.", "Nivel I + Redstone, o\nExtender con Aetherium.\nConserva el nivel.",
            "El máximo depende del efecto.\nAmplifica hasta el límite y\nextiende dos veces desde normal.\nNo extiende efectos instantáneos."],
        duration: "Duración", cost: "Aetherium por operación", twice: "Dos operaciones desde el nivel I", max: "Repite Amplificar y Extender\nhasta el límite del efecto.\nAmplificar: {a} mB por nivel.\nExtender: {e} mB por paso.",
    },
    de: {
        tabs: ["Anzeige", "Rezepte", "Trankverbesserung", "Tränke brauen", "Tränke verbessern", "Panel ausblenden", "Panel einblenden"],
        stages: ["Normaler Trank", "Wurftrank", "Verweiltrank", "Verstärkter Trank (+1)", "Verstärkter Trank (+2)", "Verlängerter Trank (+1)", "Maximaler Trank"],
        ingredients: ["Schwarzpulver", "Drachenatem", "Redstone", "Flüssiges Aetherium"],
        notes: ["Allgemeiner Dauerbereich.\nAbhängig vom Effekt.\nSoforteffekte haben keine Dauer.", "Normaler Trank + Schwarzpulver.\nStufe und Dauer bleiben erhalten.",
            "Wurftrank + Drachenatem.\nWolkeneffekte dauern 1/4\nder trinkbaren Variante.", "I -> II, falls unterstützt.\nEinmal verstärken.\nDie Dauer bleibt erhalten.",
            "I -> II -> III, falls unterstützt.\nAb Stufe I zweimal verstärken.\nDie Dauer bleibt erhalten.", "Stufe I + Redstone, oder\nmit Aetherium verlängern.\nDie Stufe bleibt erhalten.",
            "Maximalstufe hängt vom Effekt ab.\nBis zum Limit verstärken und\nab normal zweimal verlängern.\nSoforteffekte sind nicht verlängerbar."],
        duration: "Dauer", cost: "Aetherium pro Vorgang", twice: "Zwei Vorgänge ab Stufe I", max: "Verstärken und Verlängern\nbis zum Effektlimit wiederholen.\nVerstärken: {a} mB pro Stufe.\nVerlängern: {e} mB pro Schritt.",
    },
    fr: {
        tabs: ["État", "Recettes", "Progression des potions", "Préparer les potions", "Améliorer les potions", "Masquer le panneau", "Afficher le panneau"],
        stages: ["Potion normale", "Potion jetable", "Potion persistante", "Potion amplifiée (+1)", "Potion amplifiée (+2)", "Potion prolongée (+1)", "Potion maximale"],
        ingredients: ["Poudre à canon", "Souffle de dragon", "Redstone", "Aetherium liquide"],
        notes: ["Plage générale de durée.\nDépend de l'effet.\nLes effets instantanés n'ont pas de durée.", "Normale + Poudre à canon.\nConserve le niveau et la durée.",
            "Jetable + Souffle de dragon.\nChaque effet du nuage dure 1/4\nde la durée buvable.", "I -> II, si disponible.\nAmplifier une fois.\nConserve la durée.",
            "I -> II -> III, si disponible.\nAmplifier deux fois depuis I.\nConserve la durée.", "Niveau I + Redstone, ou\nProlonger avec de l'Aetherium.\nConserve le niveau.",
            "Le maximum dépend de l'effet.\nAmplifier jusqu'à la limite et\nprolonger deux fois depuis normal.\nPas de prolongation des effets instantanés."],
        duration: "Durée", cost: "Aetherium par opération", twice: "Deux opérations depuis le niveau I", max: "Répéter Amplifier et Prolonger\njusqu'aux limites de l'effet.\nAmplifier : {a} mB par niveau.\nProlonger : {e} mB par étape.",
    },
    ja: {
        tabs: ["状態", "レシピ", "ポーションの強化手順", "ポーション醸造", "ポーション強化", "パネルを隠す", "パネルを表示"],
        stages: ["通常のポーション", "スプラッシュポーション", "残留ポーション", "強化ポーション (+1)", "強化ポーション (+2)", "延長ポーション (+1)", "最大ポーション"],
        ingredients: ["火薬", "ドラゴンの息", "レッドストーン", "液体エーテリウム"],
        notes: ["一般的な持続時間の範囲。\n効果によって異なります。\n即時効果に持続時間はありません。", "通常のポーション + 火薬。\nレベルと持続時間を維持します。",
            "スプラッシュ + ドラゴンの息。\n雲の各効果の持続時間は\n飲用ポーションの1/4です。", "対応する効果では I -> II。\n強化を1回実行。\n持続時間は変わりません。",
            "対応する効果では I -> II -> III。\nI から強化を2回実行。\n持続時間は変わりません。", "I + レッドストーン、または\nエーテリウムで延長。\nレベルは変わりません。",
            "最大レベルは効果によります。\n上限まで強化し、通常から\n延長を2回実行します。\n即時効果は延長できません。"],
        duration: "持続時間", cost: "操作ごとのエーテリウム", twice: "レベル I から2回実行", max: "効果の上限まで強化と延長を反復。\n強化：レベルごとに {a} mB。\n延長：段階ごとに {e} mB。",
    },
    ru: {
        tabs: ["Состояние", "Рецепты", "Улучшение зелий", "Варка зелий", "Улучшения зелий", "Скрыть панель", "Показать панель"],
        stages: ["Обычное зелье", "Взрывное зелье", "Туманное зелье", "Усиленное зелье (+1)", "Усиленное зелье (+2)", "Продлённое зелье (+1)", "Максимальное зелье"],
        ingredients: ["Порох", "Дыхание дракона", "Редстоун", "Жидкий Этериум"],
        notes: ["Общий диапазон длительности.\nЗависит от эффекта.\nМгновенные эффекты не имеют длительности.", "Обычное зелье + Порох.\nСохраняет уровень и длительность.",
            "Взрывное + Дыхание дракона.\nЭффект облака длится 1/4\nот питьевого зелья.", "I -> II, если поддерживается.\nУсильте один раз.\nСохраняет длительность.",
            "I -> II -> III, если поддерживается.\nУсильте дважды с уровня I.\nСохраняет длительность.", "Уровень I + Редстоун или\nпродление с Этериумом.\nУровень сохраняется.",
            "Максимум зависит от эффекта.\nУсильте до предела и\nпродлите дважды с обычного.\nМгновенные эффекты не продлеваются."],
        duration: "Длительность", cost: "Этериум за операцию", twice: "Две операции с уровня I", max: "Повторяйте усиление и продление\nдо предела эффекта.\nУсиление: {a} мБ за уровень.\nПродление: {e} мБ за шаг.",
    },
    zh: {
        tabs: ["状态", "配方", "药水升级指南", "酿造药水", "升级药水", "隐藏面板", "显示面板"],
        stages: ["普通药水", "喷溅药水", "滞留药水", "强化药水 (+1)", "强化药水 (+2)", "延长药水 (+1)", "最高药水"],
        ingredients: ["火药", "龙息", "红石", "液态以太"],
        notes: ["一般持续时间范围。\n取决于效果类型。\n瞬间效果没有持续时间。", "普通药水 + 火药。\n保持等级和持续时间。",
            "喷溅药水 + 龙息。\n药水云的每次效果持续时间\n为饮用药水的四分之一。", "支持该效果时 I -> II。\n执行一次强化。\n保持持续时间。",
            "支持该效果时 I -> II -> III。\n从 I 执行两次强化。\n保持持续时间。", "I 级 + 红石，或\n使用以太进行延长。\n保持药水等级。",
            "最高等级取决于效果。\n强化至上限，再从普通状态\n执行两次延长。\n瞬间效果无法延长。"],
        duration: "持续时间", cost: "每次操作的以太", twice: "从 I 级执行两次操作", max: "重复强化和延长，直到效果上限。\n强化：每级 {a} mB。\n延长：每阶段 {e} mB。",
    },
};
const stages = ["common", "splash", "lingering", "amplified_1", "amplified_2", "extended", "maximum"];
const tabs = ["display", "recipes", "progression", "brewing", "upgrades"];

export async function writeAlchemicalUITranslations(ranges) {
    for (const name of (await readdir(root)).filter(name => name.endsWith(".lang"))) {
        const file = new URL(name, root), source = await readFile(file, "utf8");
        const newline = source.includes("\r\n") ? "\r\n" : "\n";
        const t = texts[name.slice(0, 2)] ?? texts.en;
        const existing = new Map(source.split(/\r?\n/).filter(line => line.includes("=")).map(line => {
            const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)];
        }));
        const additions = new Map();
        const put = (key, value) => additions.set(`ui.ascendant:alchemy.${key}`, value.replaceAll("\n", "\\n"));
        tabs.forEach((tab, i) => put(`tab.${tab}`, t.tabs[i]));
        put("panel.hide", t.tabs[5]); put("panel.show", t.tabs[6]);
        const times = [ranges.normal, ranges.normal, ranges.lingering, ranges.normal, ranges.normal, ranges.extended, ranges.maximum];
        stages.forEach((stage, i) => put(`guide.${stage}`, `${t.stages[i]}\n${t.duration}: ${times[i]}\n${t.notes[i]}`));
        put("guide.ingredient.gunpowder", t.ingredients[0]);
        put("guide.ingredient.dragon_breath", t.ingredients[1]);
        put("guide.ingredient.redstone", `${t.ingredients[2]}\n${t.notes[5]}\n${t.ingredients[3]}: ${ALCHEMY.extendCost} mB`);
        put("guide.ingredient.amplify", `${t.ingredients[3]}\n${t.cost}: ${ALCHEMY.amplifyCost} mB`);
        put("guide.ingredient.amplify_twice", `${t.ingredients[3]}\n${t.cost}: ${ALCHEMY.amplifyCost} mB\n${t.twice}: ${ALCHEMY.amplifyCost * 2} mB`);
        put("guide.ingredient.maximum", `${t.ingredients[3]}\n${t.max.replaceAll("{a}", ALCHEMY.amplifyCost).replaceAll("{e}", ALCHEMY.extendCost)}`);
        // Keep the recipe names already localized by the potion generator.
        // Family potion icons use the full item name and effect description directly.
        BREWING_RECIPES.forEach((recipe, i) => {
            const title = existing.get(`ui.ascendant:alchemy.recipe.${i}`);
            if (!title) throw Error(`Missing recipe translation ${name}: ${i}`);
            const [ingredients, output] = title.split("\\n→ ");
            const [input, ingredient] = ingredients.split(" + ");
            put(`recipe.${i}.input`, input); put(`recipe.${i}.ingredient`, ingredient); put(`recipe.${i}.output`, output);
        });
        const lines = source.split(/\r?\n/).map(line => {
            const key = line.slice(0, line.indexOf("="));
            if (!additions.has(key)) return line;
            const value = additions.get(key); additions.delete(key); return `${key}=${value}`;
        });
        const extra = [...additions].map(([key, value]) => `${key}=${value}`).join(newline);
        await writeFile(file, lines.join(newline).trimEnd() + newline + (extra ? extra + newline : ""));
    }
}
