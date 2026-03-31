/**
 * ОфферДоктор — Mini App для MAX
 * Первая статическая версия без фреймворков
 */

(function () {
    'use strict';

    // ===== MAX Bridge: безопасные обёртки =====

    /**
     * Проверяет, доступен ли MAX WebApp
     */
    function isMaxAvailable() {
        return typeof window !== 'undefined' && window.WebApp;
    }

    /**
     * Инициализация MAX App
     */
    function initMaxApp() {
        if (!isMaxAvailable()) {
            console.log('MAX WebApp недоступен, работаем в обычном режиме');
            return;
        }

        try {
            window.WebApp.ready();
            console.log('MAX WebApp готов');
        } catch (e) {
            console.log('WebApp.ready() не вызван:', e.message);
        }
    }

    /**
     * Настройка кнопки "Назад" в MAX
     */
    function setupMaxBackButton() {
        if (!isMaxAvailable()) return;

        try {
            var backBtn = window.WebApp.BackButton;
            if (backBtn) {
                backBtn.onClick(function () {
                    // Обработка нажатия кнопки "Назад"
                    console.log('Нажата кнопка "Назад"');
                });
            }
        } catch (e) {
            console.log('Ошибка настройки BackButton:', e.message);
        }
    }

    /**
     * Включает защиту от закрытия (close guard)
     */
    function enableCloseGuard() {
        if (!isMaxAvailable()) return;

        try {
            if (typeof window.WebApp.enableClosingConfirmation === 'function') {
                window.WebApp.enableClosingConfirmation();
            }
        } catch (e) {
            console.log('Ошибка включения close guard:', e.message);
        }
    }

    /**
     * Выключает защиту от закрытия (close guard)
     */
    function disableCloseGuard() {
        if (!isMaxAvailable()) return;

        try {
            if (typeof window.WebApp.disableClosingConfirmation === 'function') {
                window.WebApp.disableClosingConfirmation();
            }
        } catch (e) {
            console.log('Ошибка выключения close guard:', e.message);
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

        // Выключаем close guard после успешной "оплаты"
        disableCloseGuard();
    }

    // ===== Обработчик нажатия кнопки =====
    function handlePayClick() {
        // В демо-режиме просто показываем результат
        showResult();
    }

    // ===== Инициализация =====
    function init() {
        // Инициализация MAX
        initMaxApp();
        setupMaxBackButton();

        // Заполнение демо-данных
        fillDemoData();

        // Обработчик кнопки
        elements.payBtn.addEventListener('click', handlePayClick);

        // ===== Close Guard для полей формы =====
        // В текущей версии поля только для просмотра, но добавим заготовку
        // Если поля станут редактируемыми, close guard будет работать
        var formFields = document.querySelectorAll('.data-item__value');
        formFields.forEach(function (field) {
            field.addEventListener('input', function () {
                enableCloseGuard();
            });
            field.addEventListener('change', function () {
                enableCloseGuard();
            });
        });
    }

    // Запускаем после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();