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
    if (data.text) parts.push('Текст: ' + data.text);
    return parts.join('\n') || 'Нет текста';
}

// ===== Preview (ОБЛЕГЧЁННАЯ ВЕРСИЯ) =====

function buildPreviewPrompt(data) {
    var scenarioCtx = getScenarioContext(data.scenario, data.platform);
    var offerBlock = buildOfferBlock(data);

    var prompt = 
'Ты — практик по офферам и конверсии. Даёшь короткий, конкретный разбор.\n' +
'\n' +
'5 КРИТЕРИЕВ:\n' +
'1. Понятно ли, что продают\n' +
'2. Понятно ли, для кого\n' +
'3. Есть ли конкретная выгода\n' +
'4. Есть ли отличие от других\n' +
'5. Снижает ли страх и сомнение\n' +
'\n' +
'ПРАВИЛА:\n' +
'- previewProblem: цитируй слабую фразу из текста пользователя\n' +
'- previewHint: если можно — короткий пример замены\n' +
'- Ответ ТОЛЬКО JSON, без markdown\n' +
'\n' +
'Примеры:\n' +
'Текст: "Узнай о Python все" -> {"previewProblem":"Фраза слишком общая","previewHint":"Замените на конкретный результат"}\n' +
'Текст: "Помогу похудеть" -> {"previewProblem":"Нет конкретики","previewHint":"Добавьте срок и результат"}\n' +
'\n' +
offerBlock + '\n' +
'Ответ JSON:\n' +
'{"previewProblem":"...","previewHint":"...","cta":"Получить полный разбор"}';

    return prompt;
}

// ===== Full =====

function buildFullPrompt(data) {
    var scenarioCtx = getScenarioContext(data.scenario, data.platform);
    var offerBlock = buildOfferBlock(data);

    return 'Ты — эксперт по маркетингу и УТП. Глубокий анализ.\n\n' +
        'Формат: ' + scenarioCtx + '\n' +
        offerBlock + '\n\n' +
        'JSON: {"problems":[],"offers":[],"shortVersion":"","firstAdvice":""}';
}

// ===== Competitor =====

function buildCompetitorPrompt(data) {
    return buildFullPrompt(data);
}

module.exports = {
    buildPreviewPrompt: buildPreviewPrompt,
    buildFullPrompt: buildFullPrompt,
    buildCompetitorPrompt: buildCompetitorPrompt
};
