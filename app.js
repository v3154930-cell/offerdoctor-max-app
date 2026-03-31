/**
 * ОфферДоктор — Mini App для MAX
 * Frontend, готовый к реальному backend-потоку
 */

(function () {
    'use strict';

    // ===== Состояния интерфейса =====
    var AppState = {
        FORM: 'form',
        PAYMENT_SUCCESS: 'payment_success',
        LOADING_ANALYSIS: 'loading_analysis',
        RESULT: 'result',
        ERROR: 'error'
    };

    var currentState = AppState.FORM;

    // ===== MAX Bridge: безопасные обёртки =====

    function isMaxAvailable() {
        return typeof window !== 'undefined' && window.WebApp;
    }

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

    function setupMaxBackButton() {
        if (!isMaxAvailable()) return;

        try {
            var backBtn = window.WebApp.BackButton;
            if (backBtn) {
                backBtn.onClick(function () {
                    console.log('Нажата кнопка "Назад"');
                });
            }
        } catch (e) {
            console.log('Ошибка настройки BackButton:', e.message);
        }
    }

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

    // ===== Демо-данные для полей =====
    var demoData = {
        product: 'Консультации по маркетплейсам',
        audience: 'Селлеры малого бизнеса',
        currentText: 'Помогаю продавцам выйти на маркетплейсы и увеличить продажи',
        problems: 'Сравнивают только по цене'
    };

    // ===== DOM элементы =====
    var elements = {
        product: document.getElementById('product'),
        audience: document.getElementById('audience'),
        currentText: document.getElementById('current-text'),
        problems: document.getElementById('problems'),
        payBtn: document.getElementById('pay-btn'),
        paymentSuccess: document.getElementById('payment-success'),
        loadingSection: document.getElementById('loading-section'),
        resultSection: document.getElementById('result-section'),
        resultProblems: document.getElementById('result-problems'),
        resultOffers: document.getElementById('result-offers'),
        resultShort: document.getElementById('result-short'),
        resultAdvice: document.getElementById('result-advice'),
        errorSection: document.getElementById('error-section'),
        errorMessage: document.getElementById('error-message'),
        retryBtn: document.getElementById('retry-btn')
    };

    // ===== Управление состояниями =====

    function hideAllSections() {
        elements.payBtn.style.display = 'none';
        elements.paymentSuccess.style.display = 'none';
        elements.loadingSection.style.display = 'none';
        elements.resultSection.style.display = 'none';
        elements.errorSection.style.display = 'none';
    }

    function setState(newState) {
        currentState = newState;
        hideAllSections();

        switch (newState) {
            case AppState.FORM:
                elements.payBtn.style.display = 'block';
                break;
            case AppState.PAYMENT_SUCCESS:
                elements.paymentSuccess.style.display = 'block';
                break;
            case AppState.LOADING_ANALYSIS:
                elements.loadingSection.style.display = 'block';
                break;
            case AppState.RESULT:
                elements.resultSection.style.display = 'block';
                break;
            case AppState.ERROR:
                elements.errorSection.style.display = 'block';
                break;
        }
    }

    // ===== Заполнение демо-данных =====

    function fillDemoData() {
        elements.product.textContent = demoData.product;
        elements.audience.textContent = demoData.audience;
        elements.currentText.textContent = demoData.currentText;
        elements.problems.textContent = demoData.problems;
    }

    // ===== Получение данных из полей =====

    function getFormData() {
        return {
            product: elements.product.textContent.trim(),
            audience: elements.audience.textContent.trim(),
            offer: elements.currentText.textContent.trim(),
            pain: elements.problems.textContent.trim()
        };
    }

    // ===== Построение payload для backend =====

    function buildAnalysisPayload() {
        var formData = getFormData();

        return {
            product: formData.product,
            audience: formData.audience,
            offer: formData.offer,
            pain: formData.pain,
            rawMaxInitData: (isMaxAvailable() && window.WebApp.initData) ? window.WebApp.initData : '',
            maxStartParam: (isMaxAvailable() && window.WebApp.initDataUnsafe && window.WebApp.initDataUnsafe.start_param)
                ? window.WebApp.initDataUnsafe.start_param
                : '',
            platform: (isMaxAvailable() && window.WebApp.platform) ? window.WebApp.platform : 'web',
            version: (isMaxAvailable() && window.WebApp.version) ? window.WebApp.version : ''
        };
    }

    // ===== Запрос к backend (заглушка) =====
    // ЗАМЕНИТЬ НА РЕАЛЬНЫЙ API: заменить содержимое этой функции на реальный fetch/XMLHttpRequest

    function requestAiAnalysis(payload) {
        // Временная заглушка — имитация запроса к серверу
        // При подключении реального backend заменить на:
        // return fetch('/api/analyze', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) })
        //     .then(response => response.json());

        return new Promise(function (resolve, reject) {
            // Имитация задержки сети 1.5-2.5 секунды
            var delay = 1500 + Math.random() * 1000;

            setTimeout(function () {
                // Имитация успешного ответа
                // Для тестирования ошибки можно раскомментировать:
                // if (Math.random() < 0.2) { reject(new Error('Сервер временно недоступен')); return; }

                resolve({
                    problems: [
                        'Отсутствие конкретики — "увеличить продажи" без цифр и сроков звучит как пустое обещание',
                        'Нет уникального механизма — неясно, ЧЕМ именно вы отличаетесь от других консультантов',
                        'Фокус на процессе, а не на результате — клиенты хотят знать, что они получат, а не что вы делаете'
                    ],
                    offers: [
                        'Вывожу селлеров на маркетплейсы с гарантией первых заказов за 14 дней — или работаю бесплатно до результата',
                        'Система запуска на Wildberries и Ozon "под ключ": от регистрации до стабильных 100+ заказов в месяц за 6 недель',
                        'Превращаю новичков в топ-селлеров маркетплейсов: 87% моих клиентов выходят на окупаемость в первый же месяц'
                    ],
                    shortVersion: 'Запуск на маркетплейсах с гарантией первых заказов за 14 дней. Для селлеров малого бизнеса.',
                    firstAdvice: 'Начните с главного: замените общее "увеличить продажи" на конкретный измеримый результат с цифрами и сроками. Добавьте уникальное обещание или гарантию, которая выделит вас на фоне конкурентов. Уберите фокус с процесса ("помогаю") и сместите его на выгоду клиента.'
                });
            }, delay);
        });
    }

    // ===== Отрисовка результата =====

    function renderResult(data) {
        // 3 главные проблемы
        elements.resultProblems.innerHTML = '';
        data.problems.forEach(function (problem) {
            var li = document.createElement('li');
            li.textContent = problem;
            elements.resultProblems.appendChild(li);
        });

        // 3 новых варианта УТП
        elements.resultOffers.innerHTML = '';
        data.offers.forEach(function (offer) {
            var li = document.createElement('li');
            li.textContent = offer;
            elements.resultOffers.appendChild(li);
        });

        // Короткая версия
        elements.resultShort.textContent = data.shortVersion;

        // Что менять первым
        elements.resultAdvice.textContent = data.firstAdvice;

        setState(AppState.RESULT);
    }

    // ===== Отрисовка ошибки =====

    function renderError(message) {
        elements.errorMessage.textContent = message || 'Произошла неизвестная ошибка. Попробуйте снова.';
        setState(AppState.ERROR);
    }

    // ===== Основной flow =====

    function startAnalysisFlow() {
        // 1. Показываем "Оплата подтверждена"
        setState(AppState.PAYMENT_SUCCESS);

        // 2. Через паузу переходим к загрузке
        setTimeout(function () {
            setState(AppState.LOADING_ANALYSIS);

            // 3. Выполняем запрос к backend
            var payload = buildAnalysisPayload();
            console.log('Отправка payload:', payload);

            requestAiAnalysis(payload)
                .then(function (data) {
                    renderResult(data);
                })
                .catch(function (error) {
                    console.error('Ошибка анализа:', error);
                    renderError(error.message || 'Не удалось выполнить анализ. Попробуйте снова.');
                });
        }, 800); // Пауза 800 мс между "оплатой" и началом анализа
    }

    function resetToForm() {
        setState(AppState.FORM);
    }

    // ===== Инициализация =====

    function init() {
        // Инициализация MAX
        initMaxApp();
        setupMaxBackButton();

        // Заполнение демо-данных
        fillDemoData();

        // Обработчик кнопки оплаты
        elements.payBtn.addEventListener('click', startAnalysisFlow);

        // Обработчик кнопки повтора при ошибке
        elements.retryBtn.addEventListener('click', resetToForm);

        // ===== Close Guard для полей формы =====
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