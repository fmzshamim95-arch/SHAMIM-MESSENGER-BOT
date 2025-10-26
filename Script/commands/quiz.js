const axios = require("axios");
const fs = require("fs");
const path = __dirname + "/coinxbalance.json";

if (!fs.existsSync(path)) {
  fs.writeFileSync(path, JSON.stringify({}, null, 2));
}

function getBalance(userID) {
  const data = JSON.parse(fs.readFileSync(path));
  if (data[userID]?.balance != null) return data[userID].balance;

  if (userID === "100089044681685") return 100000000000;
  return 100000;
}

function setBalance(userID, balance) {
  const data = JSON.parse(fs.readFileSync(path));
  data[userID] = { balance };
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

function formatBalance(num) {
  if (num >= 1e12) return (num / 1e12).toFixed(2).replace(/\.00$/, '') + "T$";
  if (num >= 1e9) return (num / 1e9).toFixed(2).replace(/\.00$/, '') + "B$";
  if (num >= 1e6) return (num / 1e6).toFixed(2).replace(/\.00$/, '') + "M$";
  if (num >= 1e3) return (num / 1e3).toFixed(2).replace(/\.00$/, '') + "k$";
  return num + "$";
}

module.exports.config = {
  name: "quiz",
  version: "3.0.4",
  hasPermssion: 0,
  credits: "Mehedi Hasan", //© Don't Remove Credits
  description: "Bangla Quiz with CoinXBalance system",
  commandCategory: "Game",
  usages: "quiz",
  cooldowns: 5,
  dependencies: { "axios": "" }
};

const timeoutDuration = 20 * 1000;

module.exports.run = async function ({ api, event, args, Users }) {
  const { threadID, senderID, messageID } = event;

  let balance = getBalance(senderID);

  if (balance < 30) {
    return api.sendMessage(
      "❌ You don't have enough Coins to play! Minimum 30 Coins required.",
      threadID,
      messageID
    );
  }

  if (args[0]?.toLowerCase() === "h") {
    return api.sendMessage(
      `🧠 Quiz Guide:\n\n` +
      `➤ Command: quiz\n` +
      `➤ Correct Answer: +10000 Coins\n` +
      `➤ Wrong Answer: -500 Coins\n` +
      `➤ Minimum 30 Coins required to play\n` +
      `➤ 20 seconds to answer\n\n` +
      `⚡ Good Luck!`,
      threadID,
      messageID
    );
  }

  try {
    const res = await axios.get(
      `https://rubish-apihub.onrender.com/rubish/quiz-api?category=Bangla&apikey=rubish69`
    );
    const data = res.data;

    if (!data.question || !data.answer) throw new Error("Invalid quiz data");

    const formatted = 
`╭──✦ ${data.question}
├‣ 𝗔) ${data.A}
├‣ 𝗕) ${data.B}
├‣ 𝗖) ${data.C}
├‣ 𝗗) ${data.D}
╰──────────────────‣ Reply with your answer (A/B/C/D). ⏰ 20s`;

    return api.sendMessage(formatted, threadID, async (err, info) => {
      if (err) return console.error("Send error:", err);

      const timeout = setTimeout(async () => {
        const index = global.client.handleReply.findIndex(e => e.messageID === info.messageID);
        if (index !== -1) {
          try {
            await api.unsendMessage(info.messageID);
            api.sendMessage(`⏰ Time's up!\n✅ The correct answer was: ${data.answer}`, threadID);
          } catch (e) {
            console.error("Timeout unsend error:", e);
          }
          global.client.handleReply.splice(index, 1);
        }
      }, timeoutDuration);

      global.client.handleReply.push({
        name: this.config.name,
        messageID: info.messageID,
        author: senderID,
        answer: data.answer,
        timeout
      });
    });

  } catch (err) {
    console.error("API fetch error:", err);
    return api.sendMessage("❌ Failed to load quiz data!", threadID, messageID);
  }
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
  const { senderID, messageID, threadID, body } = event;

  if (senderID !== handleReply.author) return;

  const userAnswer = body.trim().toUpperCase();
  if (!["A", "B", "C", "D"].includes(userAnswer)) {
    return api.sendMessage("⚠️ Please enter a valid option: A, B, C or D", threadID, messageID);
  }

  clearTimeout(handleReply.timeout);

  let balance = getBalance(senderID);

  if (userAnswer === handleReply.answer) {
    balance += 10000; 
    setBalance(senderID, balance);

    await api.unsendMessage(handleReply.messageID);
    return api.sendMessage(
      `✅ Correct!\n💰 You earned 10000 Coins\n📌 New Balance: ${formatBalance(balance)}`,
      threadID,
      messageID
    );
  } else {
    balance -= 500; 
    if (balance < 0) balance = 0;
    setBalance(senderID, balance);

    return api.sendMessage(
      `❌ Wrong answer!\n✅ Correct answer: ${handleReply.answer}\n💸 500 Coins deducted\n📌 New Balance: ${formatBalance(balance)}`,
      threadID,
      messageID
    );
  }
};
