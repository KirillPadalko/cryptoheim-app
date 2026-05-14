import { API } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
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
    
    let currentNickname = "";

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

        if (res && res.verification_code) {
            currentNickname = nickname;
            codeDisplay.innerText = res.verification_code;
            step1.style.display = 'none';
            step2.style.display = 'block';
        } else {
            showError("Failed to start verification. Try again.");
        }
    });

    // Step 2 -> Step 3 (Verification)
    verifyBtn.addEventListener('click', async () => {
        const code = codeDisplay.innerText.trim();
        
        toggleLoading(true);
        const res = await API.authVerify(currentNickname, code);
        toggleLoading(false);

        if (res && res.access_token) {
            // Success!
            localStorage.setItem('cryptoheim_token', res.access_token);
            localStorage.setItem('cryptoheim_user', JSON.stringify(res.user));
            
            step2.style.display = 'none';
            step3.style.display = 'block';
        } else {
            showError("Code not found or invalid. Please ensure you sent the message on Boosty.");
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
