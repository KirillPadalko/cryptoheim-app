import { API } from './api.js';

const I18N_PRO = {
    'ru': {
        'pro_cta': 'ПОЛУЧИТЬ PRO ДОСТУП',
        'app_btn': 'ПРИЛОЖЕНИЕ В GOOGLE PLAY',
        'pro_hero_title': 'Активация PRO',
        'pro_hero_subtitle': 'Поддержите проект и получите эксклюзивный доступ к сигналам ботов в реальном времени, ИИ-аналитике и работе без рекламы.',
        'auth_step_1': 'Шаг 1: Имя пользователя',
        'auth_step_1_desc': 'Введите ваше имя пользователя (nickname) на Boosty для начала верификации.',
        'label_nickname': 'Имя пользователя Boosty',
        'btn_start_auth': 'Далее',
        'auth_step_2': 'Шаг 2: Отправка кода',
        'auth_step_2_desc': 'Пожалуйста, отправьте этот код в личном сообщении нашей',
        'auth_step_2_hint': 'После отправки сообщения подождите несколько секунд и нажмите кнопку «Проверить и войти».',
        'btn_verify': 'Проверить и войти',
        'btn_back': 'Назад',
        'auth_success': 'Успешно!',
        'btn_finish': 'Перейти в личный кабинет',
        'why_pro_title': '👑 ПОЧЕМУ СТОИТ ВЫБРАТЬ PRO?',
        'why_pro_1': 'Торговые сигналы от нашей аналитической платформы',
        'why_pro_2': '100% чистый интерфейс без рекламы',
        'why_pro_3': 'Доступно <a href="https://play.google.com/store/apps/details?id=io.github.kirillpadalko.cryptoheim" target="_blank" style="text-decoration: underline; font-weight: 800;">Android-приложение</a> с PRO-сигналами и аналитикой',
        'how_activate_title': '🚀 КАК АКТИВИРОВАТЬ ДОСТУП',
        'how_activate_step1': '<strong>1. Оформить подписку на Boosty:</strong><br>Нажмите кнопку ниже, перейдите на страницу Boosty и выберите <strong>PRO подписку</strong>.',
        'how_activate_step2': '<strong>2. Активация на сайте:</strong><br>Вернитесь на эту страницу, введите свой никнейм в форму ниже и подтвердите его кодом.',
        'btn_subscribe': '👉 ПОДПИСАТЬСЯ НА BOOSTY'
    }
};

function applyTranslations() {
    const lang = localStorage.getItem('appLang') || 'en';
    if (lang !== 'ru') return;
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (I18N_PRO['ru'][key]) {
            el.innerHTML = I18N_PRO['ru'][key];
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    window.appLang = localStorage.getItem('appLang') || 'en';
    
    // Lang Switcher
    const langBtns = document.querySelectorAll('.lang-btn');
    if (langBtns.length > 0) {
        langBtns.forEach(btn => {
            if (btn.dataset.lang === window.appLang) btn.classList.add('active');
            else btn.classList.remove('active');
            
            btn.addEventListener('click', () => {
                if (btn.dataset.lang === window.appLang) return;
                window.appLang = btn.dataset.lang;
                localStorage.setItem('appLang', window.appLang);
                window.location.reload();
            });
        });
    }

    if (window.appLang === 'ru') applyTranslations();

    try {
        API.updateNavProfile();
    } catch(e) { console.error(e); }
    
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const step3 = document.getElementById('step-3');
    
    const startBtn = document.getElementById('start-auth-btn');
    const verifyBtn = document.getElementById('verify-auth-btn');
    const backBtn = document.getElementById('back-to-step-1');
    const finishBtn = document.getElementById('finish-btn');
    
    const nickInput = document.getElementById('boosty-nick');
    const codeDisplay = document.getElementById('code-display');
    const errorMsg = document.getElementById('error-msg');
    const spinner = document.getElementById('spinner');
    
    const vipInstructions = document.getElementById('vip-instructions');
    const normalInstructions = document.getElementById('normal-instructions');
    const vipPassword = document.getElementById('vip-password');
    
    let currentNickname = "";
    let isVip = false;

    const showError = (msg) => {
        errorMsg.innerText = msg;
        errorMsg.style.display = 'block';
        setTimeout(() => { errorMsg.style.display = 'none'; }, 5000);
    };

    const toggleLoading = (loading) => {
        spinner.style.display = loading ? 'block' : 'none';
        startBtn.disabled = loading;
        verifyBtn.disabled = loading;
    };

    // Step 1 -> Step 2
    startBtn.addEventListener('click', async () => {
        const nickname = nickInput.value.trim();
        if (!nickname) return;

        toggleLoading(true);
        const res = await API.authStart(nickname);
        toggleLoading(false);

        if (res && res.code) {
            currentNickname = nickname;
            isVip = !!res.is_vip;
            
            if (isVip) {
                vipInstructions.style.display = 'block';
                normalInstructions.style.display = 'none';
            } else {
                vipInstructions.style.display = 'none';
                normalInstructions.style.display = 'block';
                codeDisplay.innerText = res.code;
            }
            
            step1.style.display = 'none';
            step2.style.display = 'block';
        } else {
            console.error("Auth start failed. Response:", res);
            showError("Failed to start verification. Try again.");
        }
    });

    // Step 2 -> Step 3 (Verification)
    verifyBtn.addEventListener('click', async () => {
        const codeOrPassword = isVip ? vipPassword.value.trim() : codeDisplay.innerText.trim();
        if (isVip && !codeOrPassword) return showError("Please enter VIP password");
        
        toggleLoading(true);
        const res = await API.authVerify(currentNickname, codeOrPassword);
        toggleLoading(false);

        if (res && res.access_token) {
            // Success!
            localStorage.setItem('cryptoheim_token', res.access_token);
            localStorage.setItem('cryptoheim_user', JSON.stringify(res.user));
            
            try {
                API.updateNavProfile();
            } catch(e) { console.error(e); }
            
            step2.style.display = 'none';
            step3.style.display = 'block';
        } else {
            const msg = isVip ? "Invalid VIP password." : "Code not found or invalid. Please ensure you sent the message on Boosty.";
            showError(msg);
        }
    });

    backBtn.addEventListener('click', () => {
        step2.style.display = 'none';
        step1.style.display = 'block';
    });

    finishBtn.addEventListener('click', () => {
        window.location.href = "indicators.html";
    });
});
