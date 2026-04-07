/**
 * Билдеры промтов для GigaChat
 */

var scenarioContexts = {
    marketplace: 'карточка товара на маркетплейсе',
    avito: 'объявление на Avito',
    landing: 'лендинг'
};

function getScenarioContext(scenario, platform) {
    var ctx = scenarioContexts[scenario] || scenarioContexts.marketplace;
    return ctx;
}

function buildOfferBlock(data) {
    var parts = [];
    if (data.text) parts.push('Текст предложения: ' + data.text);
    if (data.link) parts.push('Ссылка: ' + data.link);
    return parts.join('\n') || 'Не указано';
}

// ===== Preview =====

function buildPreviewPrompt(data) {
    var scenarioCtx = getScenarioContext(data.scenario, data.platform);
    var offerBlock = buildOfferBlock(data);

    var prompt = 
'Ты — СИЛЬНЫЙ ПРАКТИК по упаковке офферов и конверсии.\n' +
'\n' +
'=== ОБЯЗАТЕЛЬНЫЕ ТРЕБОВАНИЯ ===\n' +
'\n' +
'previewProblem должен:\n' +
'- УКАЗАТЬ НА КОНКРЕТНУЮ СЛАБУЮ ФРАЗУ из текста\n' +
'- ОБЪЯСНИТЬ, ПОЧЕМУ это снижает конверсию\n' +
'- НЕ использовать: "не хватает конкретики", "нет выгоды"\n' +
'\n' +
'ПЛОХО: "Отсутствует четкая выгода", "Не хватает конкретики"\n' +
'ХОРОШО: "Фраза \'Узнай о Python все\' слишком общая — непонятно, какой результат получит новичок"\n' +
'\n' +
'previewHint должен:\n' +
'- ДАВАТЬ КОНКРЕТНУЮ ПРАВКУ\n' +
'- По возможности пример замены\n' +
'- Формат: "Замените X на Y"\n' +
'\n' +
'ПЛОХО: "Добавьте конкретику", "Сформулируйте выгоду"\n' +
'ХОРОШО: "Замените \'Узнай о Python все\' на \'Освой Python за 3 недели и создай первый проект\'"\n' +
'\n' +
'=== FEW-SHOT ПРИМЕРЫ ===\n' +
'\n' +
'Вход: Текст = "Узнай о Python все"\n' +
'Ответ: {"previewProblem":"Фраза \'Узнай о Python все\' слишком общая. Новичок не понимает: какой результат получит? Почему этот курс?","previewHint":"Замените на конкретный результат: \'Освой Python с нуля за 3 недели и создай первый рабочий скрипт\'.","cta":"Получить полный разбор"}\n' +
'\n' +
'Вход: Текст = "Помогу похудеть без диет"\n' +
'Ответ: {"previewProblem":"Обещание \'помогу похудеть без диет\' звучит размыто. За счёт чего результат? За какое время? Непонятно.","previewHint":"Добавьте конкретику: \'Мягкое снижение веса на 4–6 кг за 2 месяца через питание с поддержкой нутрициолога\'.","cta":"Получить полный разбор"}\n' +
'\n' +
'Вход: Текст = "Ремонт от 10000 руб/м2"\n' +
'Ответ: {"previewProblem":"Цена \'от 10000 руб/м2\' не объясняет отличие от конкурентов. Что входит в цену? Какой риск клиента?","previewHint":"Добавьте отличие: \'Ремонт под ключ от 10000 руб/м2 с фиксированной сметой и гарантией 2 года\'.","cta":"Получить полный разбор"}\n' +
'\n' +
'=== ВАЖНО ===\n' +
'- Отвечай ТОЛЬКО JSON без markdown\n' +
'- previewProblem — с указанием конкретной фразы\n' +
'- previewHint — направление правки или пример замены\n' +
'- Один главный блокер\n' +
'\n' +
'Формат: ' + scenarioCtx + '\n' +
'Что продаёт: ' + (data.product || 'Не указано') + '\n' +
'Для кого: ' + (data.audience || 'Не указано') + '\n' +
offerBlock + '\n' +
'Что не устраивает: ' + (data.pain || 'Не указано') + '\n\n' +
'Ответ СТРОГО JSON:\n' +
'{"previewProblem":"...","previewHint":"...","cta":"Получить полный разбор"}';

    return prompt;
}

// ===== Full =====

function buildFullPrompt(data) {
    var scenarioCtx = getScenarioContext(data.scenario, data.platform);
    var offerBlock = buildOfferBlock(data);

    return 'Ты — эксперт по маркетингу и УТП. Проведи глубокий анализ.\n\n' +
        'Формат: ' + scenarioCtx + '\n' +
        'Что продаёт: ' + (data.product || 'Не указано') + '\n' +
        'Для кого: ' + (data.audience || 'Не указано') + '\n' +
        offerBlock + '\n' +
        'Что не устраивает: ' + (data.pain || 'Не указано') + '\n\n' +
        'Верни ответ СТРОГО JSON:\n' +
        '{"problems":["проблема 1","проблема 2","проблема 3"],"offers":["УТП 1","УТП 2","УТП 3"],"shortVersion":"до 15 слов","firstAdvice":"главный совет 2-3 предложения"}';
}

// ===== Competitor =====

function buildCompetitorPrompt(data) {
    var scenarioCtx = getScenarioContext(data.scenario, data.platform);
    var offerBlock = buildOfferBlock(data);

    return 'Ты — эксперт по маркетингу и конкурентному анализу.\n\n' +
        'Формат: ' + scenarioCtx + '\n' +
        'Что продаёт: ' + (data.product || 'Не указано') + '\n' +
        'Для кого: ' + (data.audience || 'Не указано') + '\n' +
        offerBlock + '\n' +
        'Верни JSON с анализом конкурентов.';
}

module.exports = {
    buildPreviewPrompt: buildPreviewPrompt,
    buildFullPrompt: buildFullPrompt,
    buildCompetitorPrompt: buildCompetitorPrompt
};
