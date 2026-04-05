/**
 * Билдеры промтов для GigaChat
 * Формируют системные сообщения и запросы для разных режимов
 */

// ===== Вспомогательные =====

var scenarioContexts = {
    marketplace: 'карточка товара на маркетплейсе (Ozon, Wildberries или Яндекс Маркет)',
    avito: 'объявление на Avito',
    landing: 'лендинг (посадочная страница)'
};

function getScenarioContext(scenario, platform) {
    var ctx = scenarioContexts[scenario] || scenarioContexts.marketplace;
    if (scenario === 'marketplace' && platform) {
        var platformNames = { ozon: 'Ozon', wb: 'Wildberries', ym: 'Яндекс Маркет' };
        ctx = 'карточка товара на ' + (platformNames[platform] || platform);
    }
    return ctx;
}

function buildOfferBlock(data) {
    var parts = [];
    if (data.text) parts.push('Текст предложения: ' + data.text);
    if (data.link) parts.push('Ссылка: ' + data.link);
    return parts.join('\n') || 'Не указано';
}

// ===== Knowledge Block =====

function buildKnowledgeBlock(knowledgeContext) {
    if (!knowledgeContext) return '';
    console.log('[DEBUG prompts.js] buildKnowledgeBlock received:', knowledgeContext.substring(0, 200) + '...');
    return 'Контекст из базы знаний:\n' + knowledgeContext + '\n\n';
}

// ===== Preview =====

function buildPreviewPrompt(data, knowledgeContext) {
    var scenarioCtx = getScenarioContext(data.scenario, data.platform);
    var offerBlock = buildOfferBlock(data);
    var knowledgeBlock = buildKnowledgeBlock(knowledgeContext);

    return 'Ты — эксперт по маркетингу и УТП. Проанализируй кратко предложение клиента.\n\n' +
        knowledgeBlock +
        'Формат: ' + scenarioCtx + '\n' +
        'Что продаёт: ' + (data.product || 'Не указано') + '\n' +
        'Для кого: ' + (data.audience || 'Не указано') + '\n' +
        offerBlock + '\n' +
        'Что не устраивает: ' + (data.pain || 'Не указано') + '\n\n' +
        'Дай ОДНУ главную проблему и ОДИН конкретный совет.\n\n' +
        'Верни ответ СТРОГО в формате JSON:\n' +
        '{"previewProblem":"текст проблемы","previewHint":"текст совета","cta":"Получить полный разбор"}\n\n' +
        'Никаких пояснений, только JSON.';
}

// ===== Full =====

function buildFullPrompt(data, knowledgeContext) {
    var scenarioCtx = getScenarioContext(data.scenario, data.platform);
    var offerBlock = buildOfferBlock(data);
    var knowledgeBlock = buildKnowledgeBlock(knowledgeContext);

    var scenarioSpecific = '';
    if (data.scenario === 'marketplace') {
        scenarioSpecific = '\nАнализируй с учётом специфики маркетплейса: название карточки, описание, выгоды для покупателя, отличие от конкурентов в выдаче.';
    } else if (data.scenario === 'avito') {
        scenarioSpecific = '\nАнализируй с учётом специфики Avito: заголовок объявления, первые строки текста, доверие, логика отклика.';
    } else if (data.scenario === 'landing') {
        scenarioSpecific = '\nАнализируй с учётом специфики лендинга: первый экран, оффер, CTA, структура блоков, путь посетителя.';
    }

    return 'Ты — эксперт по маркетингу, копирайтингу и УТП. Проведи глубокий анализ предложения.\n\n' +
        knowledgeBlock +
        'Формат: ' + scenarioCtx + '\n' +
        'Что продаёт: ' + (data.product || 'Не указано') + '\n' +
        'Для кого: ' + (data.audience || 'Не указано') + '\n' +
        offerBlock + '\n' +
        'Что не устраивает: ' + (data.pain || 'Не указано') +
        scenarioSpecific + '\n\n' +
        'Верни ответ СТРОГО JSON без markdown и пояснений:\n' +
        '{\n' +
        '  "problems": ["проблема 1, 1-2 предложения", "проблема 2", "проблема 3"],\n' +
        '  "offers": ["вариант УТП 1 — конкретный, с цифрами", "вариант УТП 2", "вариант УТП 3"],\n' +
        '  "shortVersion": "короткая версия УТП для шапки, до 15 слов",\n' +
        '  "firstAdvice": "главный совет — что менять первым и почему, 2-3 предложения"\n' +
        '}\n\n' +
        'Требования:\n' +
        '- Проблемы конкретные, относятся к этому УТП\n' +
        '- Варианты УТП сильные, с цифрами или обещаниями\n' +
        '- Только JSON, без обёрток';
}

// ===== Full + Competitor (beta) =====

function buildCompetitorPrompt(data, knowledgeContext) {
    var scenarioCtx = getScenarioContext(data.scenario, data.platform);
    var offerBlock = buildOfferBlock(data);
    var knowledgeBlock = buildKnowledgeBlock(knowledgeContext);

    var platformHint = '';
    if (data.scenario === 'marketplace' && data.platform) {
        var platformNames = { ozon: 'Ozon', wb: 'Wildberries', ym: 'Яндекс Маркет' };
        platformHint = '\nПлощадка: ' + (platformNames[data.platform] || data.platform) +
            '. Сравнивай с типичными конкурентами именно на этой площадке.';
    }

    return 'Ты — эксперт по маркетингу и конкурентному анализу. Проведи полный разбор предложения с анализом конкурентов.\n\n' +
        knowledgeBlock +
        'Формат: ' + scenarioCtx + '\n' +
        'Что продаёт: ' + (data.product || 'Не указано') + '\n' +
        'Для кого: ' + (data.audience || 'Не указано') + '\n' +
        offerBlock + '\n' +
        'Что не устраивает: ' + (data.pain || 'Не указано') +
        platformHint + '\n\n' +
        'Выполни:\n' +
        '1. Глубокий анализ текущего предложения (3 проблемы, 3 варианта УТП)\n' +
        '2. Конкурентный анализ: что у конкурентов сильнее, где пользователь теряет силу, что стоит перенять\n\n' +
        'Верни ответ СТРОГО JSON без markdown:\n' +
        '{\n' +
        '  "problems": ["проблема 1", "проблема 2", "проблема 3"],\n' +
        '  "offers": ["УТП 1", "УТП 2", "УТП 3"],\n' +
        '  "shortVersion": "короткая версия, до 15 слов",\n' +
        '  "firstAdvice": "что менять первым и почему",\n' +
        '  "competitorAnalysis": [\n' +
        '    {"title":"Что у конкурентов сильнее","text":"..."},\n' +
        '    {"title":"Где вы теряете силу","text":"..."},\n' +
        '    {"title":"Что стоит перенять","text":"..."}\n' +
        '  ]\n' +
        '}\n\n' +
        'Только JSON, без обёрток.';
}

module.exports = {
    buildPreviewPrompt: buildPreviewPrompt,
    buildFullPrompt: buildFullPrompt,
    buildCompetitorPrompt: buildCompetitorPrompt,
    buildKnowledgeBlock: buildKnowledgeBlock
};
