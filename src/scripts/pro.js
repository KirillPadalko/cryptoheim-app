import { API } from './api.js';

const I18N_PRO = {
    'ru': {
        'pro_cta': 'ПОЛУЧИТЬ PRO ДОСТУП',
        'app_btn': 'ПРИЛОЖЕНИЕ В GOOGLE PLAY',
        'pro_hero_title': 'Активация PRO',
        'pro_hero_subtitle': 'Введите свой никнейм, чтобы мгновенно получить доступ к сигналам ботов, мнению экспертов и графикам.',
        'boosty_support': 'Поддержать на Boosty',
        'tab_login': 'Войти',
        'label_nickname': 'Никнейм',
        'btn_continue': 'Продолжить',
        'auth_title': 'PRO Доступ',
        'auth_subtitle': 'Введите никнейм для доступа к сигналам',
        'auth_info_note': 'Регистрация бесплатна и мгновенно дает статус PRO. Подписка Boosty является добровольной поддержкой разработчика.',
        'auth_success': 'Успешно!',
        'success_logged_in': 'Вы успешно вошли в систему, полный PRO доступ активен.',
        'btn_finish': 'Перейти на панель управления'
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

    document.querySelectorAll('[data-i18n-nav]').forEach(el => {
        const key = el.getAttribute('data-i18n-nav');
        const ruNav = {
            'Signals': 'Аналитика',
            'Battle': 'Мнение эксперта'
        };
        if (ruNav[key]) {
            el.innerText = ruNav[key];
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
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
    
    // UI Elements
    const errorMsg = document.getElementById('error-msg');
    const spinner = document.getElementById('spinner');
    
    const loginForm = document.getElementById('login-form');
    const finishBtn = document.getElementById('finish-btn');

    // Helper functions
    const showError = (msg) => {
        errorMsg.innerText = msg;
        errorMsg.style.display = 'block';
        setTimeout(() => { errorMsg.style.display = 'none'; }, 6000);
    };

    const toggleLoading = (loading) => {
        spinner.style.display = loading ? 'block' : 'none';
        const submitBtn = document.getElementById('btn-submit-login');
        if (submitBtn) submitBtn.disabled = loading;
    };

    const handleSuccess = (res) => {
        localStorage.setItem('cryptoheim_token', res.access_token);
        localStorage.setItem('cryptoheim_user', JSON.stringify(res.user));
        
        try {
            API.updateNavProfile();
        } catch(e) { console.error(e); }

        const authBox = document.getElementById('auth-box');
        if (authBox) authBox.style.display = 'none';
        document.getElementById('success-screen').style.display = 'block';
    };

    // Form Submissions
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nick = document.getElementById('login-nick').value.trim();
            const pass = document.getElementById('login-pass').value;
            if (!nick || !pass) return;

            toggleLoading(true);
            const res = await API.loginNickname(nick, pass);
            toggleLoading(false);

            if (res && res.access_token) {
                handleSuccess(res);
            } else {
                showError(res?.message || "Login failed. Invalid nickname or password.");
            }
        });
    }

    finishBtn.addEventListener('click', () => {
        window.location.href = "expert.html";
    });
});
