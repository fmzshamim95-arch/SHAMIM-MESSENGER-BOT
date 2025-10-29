const axios = require("axios");

module.exports = {
  config: {
    name: "ai",
    version: "1.0.4",
    credits: "CYBER-BOT-TEAM",
    description: "google ai debug-ready",
    cooldowns: 0,
    hasPermission: 0,
    commandCategory: "google"
  },

  run: async ({ api, args, event }) => {
    const input = args.join(" ").trim();
    const encodedApi = "aHR0cHM6Ly9hcGlzLWtlaXRoLnZlcmNlbC5hcHAvYWkvZGVlcHNlZWtWMz9xPQ==";
    let apiUrl = Buffer.from(encodedApi, "base64").toString("utf-8");
    apiUrl = apiUrl.replace(/q=*$/i, "");

    const send = (msg) => api.sendMessage(msg, event.threadID, event.messageID);

    // Log the incoming event for debugging
    console.log("=== Incoming messenger event ===");
    try { console.log(JSON.stringify(event, null, 2)); } catch (e) { console.log(event); }

    try {
      if (event.type === "message_reply") {
        const attachments = event.messageReply && event.messageReply.attachments;
        console.log("attachments:", attachments);

        if (!attachments || !attachments.length) {
          console.log("messageReply object:", event.messageReply);
          return send("রিপ্লাই করা মেসেজে কোনো অ্যাটাচমেন্ট পাওয়া যায়নি — কনসোলে দেখো।");
        }

        const imageAttachment = attachments.find(a => a.url || (a.payload && (a.payload.url || a.payload.src)));
        const imageUrl = imageAttachment && (imageAttachment.url || (imageAttachment.payload && (imageAttachment.payload.url || imageAttachment.payload.src)));

        console.log("imageAttachment:", imageAttachment);
        console.log("imageUrl:", imageUrl);

        if (!imageUrl) {
          return send("রিপ্লাইতে ইমেজ আছে মনে হচ্ছে, কিন্তু কোন URL পাওয়া যায়নি (check console).");
        }

        const payload = { q: input || "Describe this image.", image: imageUrl };
        console.log("POST ->", apiUrl, "payload:", payload);

        const res = await axios.post(apiUrl, payload, { headers: { "Content-Type": "application/json" }, timeout: 20000 });

        console.log("response status:", res.status);
        console.log("response data (full JSON):", JSON.stringify(res.data, null, 2));

        const result = res.data?.result || res.data?.response || res.data?.message || JSON.stringify(res.data, null, 2);
        return send(result);
      } else {
        if (!input) return send("Hey I'm Ai Chat Bot\nHow can I assist you today?");

        console.log("GET ->", apiUrl, "q=", input);
        const res = await axios.get(apiUrl, { params: { q: input }, timeout: 20000 });

        console.log("response status:", res.status);
        console.log("response data (full JSON):", JSON.stringify(res.data, null, 2));

        const result = res.data?.result || res.data?.response || res.data?.message || JSON.stringify(res.data, null, 2);
        return send(result);
      }
    } catch (err) {
      console.error("---------- AI command error (full) ----------");
      console.error("message:", err.message);
      if (err.code) console.error("code:", err.code);
      if (err.config) console.error("request config:", { url: err.config.url, method: err.config.method, params: err.config.params });
      if (err.response) {
        console.error("response status:", err.response.status);
        try {
          console.error("response data (full JSON):", JSON.stringify(err.response.data, null, 2));
        } catch (e) { console.error("response data (raw):", err.response.data); }
      }
      console.error("---------------------------------------------");

      const userMsg = err.response && err.response.data && (err.response.data.message || err.response.data.error)
        ? `API responded: ${JSON.stringify(err.response.data).slice(0, 300)}`
        : `সমস্যা হয়েছে: ${err.message}. (ডিটেইল কনসোলে আছে)`;

      return send(userMsg + "\nকনসোলে preview পেস্ট করলে আমি বলব কী ঠিক করতে হবে।");
    }
  }
};
