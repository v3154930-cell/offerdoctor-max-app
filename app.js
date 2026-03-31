/**
 * ОфферДоктор — Mini App для MAX
 * Первая статическая версия без фреймворков
 */

(function () {
    'use strict';

    // ===== MAX-ready логика =====
    // Проверяем существование window.WebApp и вызываем ready()
    if (typeof window !== 'undefined' && window.WebApp) {
        try {
            window.WebApp.ready();
        } catch (e) {
            // Если вызов не удался, продолжаем работу как обычная веб-страница
            console.log('WebApp.ready() не вызван:', e.message);
        }
    }

    // ===== Демо-данные =====
    const demoData = {
        product: 'Консультации по маркетплейсам',
        audience: 'Селлеры малого бизнеса',
        currentText: 'Помогаю продавцам выйти на маркетплейсы и увеличить продажи',
        problems: 'Сравнивают только по цене'
    };

    // ===== Демо-результат разбора =====
    const demoResult = {
        diagnosis: 'Ваше УТП слишком общее и не выделяет вас среди сотен конкурентов. Фраза "помогаю увеличить продажи" используется повсеместно и не вызывает доверия. Нет конкретики, цифр и уникального подхода.',

        weakPoints: [
            'Отсутствие конкретики — "увеличить продажи" без цифр и сроков звучит как пустое обещание',
            'Нет уникального механизма — неясно, ЧЕМ именно вы отличаетесь от других консультантов',
            'Фокус на процессе, а не на результате — клиенты хотят знать, что они получат, а не что вы делаете'
        ],

        newUtp: [
            'Вывожу селлеров на маркетплейсы с гарантией первых заказов за 14 дней — или работаю бесплатно до результата',
            'Система запуска на Wildberries и Ozon "под ключ": от регистрации до стабильных 100+ заказов в месяц за 6 недель',
            'Превращаю новичков в топ-селлеров маркетплейсов: 87% моих клиентов выходят на окупаемость в первый же месяц'
        ],

        shortVersion: 'Запуск на маркетплейсах с гарантией первых заказов за 14 дней. Для селлеров малого бизнеса.',

        firstSteps: 'Начните с главного: замените общее "увеличить продажи" на конкретный измеримый результат с цифрами и сроками. Добавьте уникальное обещание или гарантию, которая выделит вас на фоне конкурентов. Уберите фокус с процесса ("помогаю") и сместите его на выгоду клиента.'
    };

    // ===== DOM элементы =====
    const elements = {
        product: document.getElementById('product'),
        audience: document.getElementById('audience'),
        currentText: document.getElementById('current-text'),
        problems: document.getElementById('problems'),
        payBtn: document.getElementById('pay-btn'),
        resultSection: document.getElementById('result-section'),
        diagnosis: document.getElementById('diagnosis'),
        weakPoints: document.getElementById('weak-points'),
        newUtp: document.getElementById('new-utp'),
        shortVersion: document.getElementById('short-version'),
        firstSteps: document.getElementById('first-steps')
    };

    // ===== Заполнение демо-данных =====
    function fillDemoData() {
        elements.product.textContent = demoData.product;
        elements.audience.textContent = demoData.audience;
        elements.currentText.textContent = demoData.currentText;
        elements.problems.textContent = demoData.problems;
    }

    // ===== Показ результата =====
    function showResult() {
        // Заполняем результат
        elements.diagnosis.textContent = demoResult.diagnosis;

        // Слабые точки
        elements.weakPoints.innerHTML = '';
        demoResult.weakPoints.forEach(function (point) {
            var li = document.createElement('li');
            li.textContent = point;
            elements.weakPoints.appendChild(li);
        });

        // Новые варианты УТП
        elements.newUtp.innerHTML = '';
        demoResult.newUtp.forEach(function (utp) {
            var li = document.createElement('li');
            li.textContent = utp;
            elements.newUtp.appendChild(li);
        });

        // Короткая версия
        elements.shortVersion.textContent = demoResult.shortVersion;

        // Первые шаги
        elements.firstSteps.textContent = demoResult.firstSteps;

        // Показываем блок результата
        elements.resultSection.style.display = 'block';

        // Меняем кнопку на подтверждение
        elements.payBtn.textContent = '✓ Оплата подтверждена в демо-режиме';
        elements.payBtn.classList.remove('btn--primary');
        elements.payBtn.classList.add('btn--success');

        // Плавный скролл к результату
        setTimeout(function () {
            elements.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    // ===== Обработчик нажатия кнопки =====
    function handlePayClick() {
        // В демо-режиме просто показываем результат
        showResult();
    }

    // ===== Инициализация =====
    function init() {
        fillDemoData();
        elements.payBtn.addEventListener('click', handlePayClick);
    }

    // Запускаем после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();