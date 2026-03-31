// Navigation
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToPayment() {
    const product = document.getElementById('inp-product').value;
    const text = document.getElementById('inp-text').value;
    
    if (!product || !text) {
        alert('Пожалуйста, заполните поля "Что вы продаете" и "Как сейчас звучит предложение"');
        return;
    }

    const btn = document.querySelector('#screen-input .btn-primary');
    const originalText = btn.innerText;
    btn.innerText = 'Обработка...';
    btn.disabled = true;

    setTimeout(() => {
        btn.innerText = originalText;
        btn.disabled = false;
        showScreen('screen-payment');
    }, 800);
}

function goToLoading() {
    showScreen('screen-loading');
    
    // Simulate AI processing (3 seconds)
    setTimeout(() => {
        // 90% success, 10% error for demo
        if (Math.random() > 0.1) {
            showScreen('screen-result');
        } else {
            showScreen('screen-error');
        }
    }, 3000);
}

// Add smooth scroll behavior
document.querySelectorAll('input, textarea').forEach(input => {
    input.addEventListener('focus', function() {
        setTimeout(() => {
            this.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    });
});