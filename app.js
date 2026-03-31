// --- LOGIC ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0,0);
}

function goToPayment() {
    // Валидация (упрощенная)
    const product = document.getElementById('inp-product').value;
    if(!product) { alert('Пожалуйста, заполните поле "Что вы продаете"'); return; }
    
    // Имитация задержки оплаты
    const btn = document.querySelector('#screen-input .btn-primary');
    const originalText = btn.innerText;
    btn.innerText = "Обработка...";
    
    setTimeout(() => {
        btn.innerText = originalText;
        showScreen('screen-payment');
    }, 800);
}

function goToLoading() {
    showScreen('screen-loading');
    // Имитация работы AI (3 секунды)
    setTimeout(() => {
        // 90% успех, 10% ошибка для демонстрации
        Math.random() > 0.1 ? showScreen('screen-result') : showScreen('screen-error');
    }, 3000);
}