import { API } from './api.js';

const I18N_PRO = {
    'ru': {
        'pro_cta': 'ПОЛУЧИТЬ PRO ДОСТУП',
        'app_btn': 'ПРИЛОЖЕНИЕ В GOOGLE PLAY',
        'pro_hero_title': 'Активация PRO',
        'pro_hero_subtitle': 'Создайте бесплатный аккаунт или войдите через Google SSO, чтобы мгновенно получить доступ к сигналам ботов, мнению экспертов и графикам.',
        'boosty_support': 'Поддержать на Boosty',
        'tab_login': 'Войти',
        'tab_register': 'Регистрация',
        'label_email_nick': 'Email или Никнейм',
        'label_password': 'Пароль',
        'btn_login': 'Войти',
        'label_nickname': 'Никнейм',
        'label_email': 'Email адрес',
        'btn_register': 'Создать аккаунт',
        'or_use_google': 'ИЛИ ВОЙТИ ЧЕРЕЗ GOOGLE',
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
    const tabs = document.querySelectorAll('.auth-tab-btn');
    const panes = document.querySelectorAll('.form-pane');
    const errorMsg = document.getElementById('error-msg');
    const spinner = document.getElementById('spinner');
    
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const finishBtn = document.getElementById('finish-btn');

    // Helper functions
    const showError = (msg) => {
        errorMsg.innerText = msg;
        errorMsg.style.display = 'block';
        setTimeout(() => { errorMsg.style.display = 'none'; }, 6000);
    };

    const toggleLoading = (loading) => {
        spinner.style.display = loading ? 'block' : 'none';
        document.getElementById('btn-submit-login').disabled = loading;
        document.getElementById('btn-submit-register').disabled = loading;
    };

    const handleSuccess = (res) => {
        localStorage.setItem('cryptoheim_token', res.access_token);
        localStorage.setItem('cryptoheim_user', JSON.stringify(res.user));
        
        try {
            API.updateNavProfile();
        } catch(e) { console.error(e); }

        document.getElementById('auth-card').style.display = 'none';
        document.getElementById('success-screen').style.display = 'block';
    };

    // Tab Switching Logic
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            const targetPane = document.getElementById(`pane-${tab.dataset.tab}`);
            if (targetPane) targetPane.classList.add('active');
        });
    });

    // Form Submissions
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameOrEmail = document.getElementById('login-nick').value.trim();
        const pass = document.getElementById('login-pass').value;
        if (!usernameOrEmail || !pass) return;

        toggleLoading(true);
        const res = await API.loginSimple(usernameOrEmail, pass);
        toggleLoading(false);

        if (res && res.access_token) {
            handleSuccess(res);
        } else {
            showError(res?.message || "Invalid credentials or login failed.");
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nick = document.getElementById('reg-nick').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const pass = document.getElementById('reg-pass').value;
        if (!nick || !email || !pass) return;

        toggleLoading(true);
        const res = await API.registerSimple(nick, email, pass);
        toggleLoading(false);

        if (res && res.access_token) {
            handleSuccess(res);
        } else {
            showError(res?.message || "Registration failed. Username or email might already be taken.");
        }
    });

    // Google SSO Response Handler
    const handleGoogleCredentialResponse = async (response) => {
        toggleLoading(true);
        const res = await API.loginGoogle(response.credential);
        toggleLoading(false);

        if (res && res.access_token) {
            handleSuccess(res);
        } else {
            showError(res?.message || "Google authentication failed.");
        }
    };

    // Initialize Google SSO dynamically
    const initGoogleSSO = async () => {
        try {
            const response = await fetch('/api/auth/google/client-id');
            if (!response.ok) throw new Error("Failed to get Google Client ID");
            const data = await response.json();
            const clientId = data.client_id;
            
            if (clientId && window.google) {
                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: handleGoogleCredentialResponse
                });
                window.google.accounts.id.renderButton(
                    document.getElementById("google-sso-btn"),
                    { theme: "outline", size: "large", width: 280 }
                );
            }
        } catch(e) {
            console.error("Error setting up Google SSO:", e);
        }
    };

    // Start Google SSO initialization
    initGoogleSSO();

    finishBtn.addEventListener('click', () => {
        window.location.href = "indicators.html";
    });
});
