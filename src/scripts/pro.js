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
