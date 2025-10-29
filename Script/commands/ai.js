const axios = require("axios");

module.exports = {
  config: {
    name: "ai",
    version: "1.0.3",
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

    // EXTRA: log the incoming event shape so we can see where attachments live
    console.log("=== Incoming messenger event ===");
    try { console.log(JSON.stringify(event, null, 2)); } catch (e) { console.log(event); }

    try {
      if (event.type === "message_reply") {
        const attachments = event.messageReply && event.messageReply.attachments;
        console.log("attachments:", attachments);

        if (!attachments || !attachments.length) {
          // also show messageReply object so you can inspect structure
          console.log("messageReply object:", event.messageReply);
          return send("রিপ্লাই করা মেসেজে কোনো অ্যাটাচমেন্ট পাওয়া যায়নি — reply করা মেসেজের পুরো অবজেক্ট কনসোলে দেখো।");
        }

        const imageAttachment = attachments.find(a => a.url || (a.payload && (a.payload.url || a.payload.src)));
        const imageUrl = imageAttachment && (imageAttachment.url || imageAttachment.payload && (imageAttachment.payload.url || imageAttachment.payload.src));

        console.log("imageAttachment:", imageAttachment);
        console.log("imageUrl:", imageUrl);

        if (!imageUrl) {
          return send("রিপ্লাইতে ইমেজ আছে মনে হচ্ছে, কিন্তু কোন URL পাওয়া যায়নি (check console).");
        }

        const payload = { q: input || "Describe this image.", image: imageUrl };

        console.log("POST ->", apiUrl, "payload:", payload);
        const res = await axios.post(apiUrl, payload, { headers: { "Content-Type": "application/json" }, timeout: 20000 });

        console.log("response status:", res.status);
        console.log("response data:", res.data);

        const result = res.data?.result || res.data?.response || res.data?.message || JSON.stringify(res.data);
        return send(result);
      } else {
        if (!input) return send("Hey I'm Ai Chat Bot\nHow can I assist you today?");

        console.log("GET ->", apiUrl, "q=", input);
        const res = await axios.get(apiUrl, { params: { q: input }, timeout: 20000 });

        console.log("response status:", res.status);
        console.log("response data:", res.data);

        const result = res.data?.result || res.data?.response || res.data?.message || JSON.stringify(res.data);
        return send(result);
      }
    } catch (err) {
      // FULL error logging for console
      console.error("---------- AI command error (full) ----------");
      console.error("message:", err.message);
      if (err.code) console.error("code:", err.code);
      if (err.config) {
        console.error("request config:", { url: err.config.url, method: err.config.method, params: err.config.params });
      }
      if (err.response) {
        console.error("response status:", err.response.status);
        // print a short preview of response.data (avoid extremely large dumps)
        try {
          const preview = JSON.stringify(err.response.data).slice(0, 1500);
          console.error("response data (preview):", preview);
        } catch (e) { console.error("response data (raw):", err.response.data); }
      }
      console.error("---------------------------------------------");

      // SAFE message to user (avoid leaking sensitive server response)
      const userMsg = err.response && err.response.data && (err.response.data.message || err.response.data.error)
        ? `API responded: ${String(err.response.data.message || err.response.data.error).slice(0, 300)}`
        : `সমস্যা হয়েছে: ${err.message}. (ডিটেইল কনসোলে আছে)`;

      // also tell them to paste the console preview here (but warn: don't paste API keys)
      send(`${userMsg}\nঅনুগ্রহ করে কনসোলে যা দেখাসে সেটা (err.response.data preview) এখানে পেস্ট করলে আমি বলব ঠিক কী করতে হবে। কিন্তু API কী বা সিক্রেট কখনো পেস্ট করবেন না।`);
    }
  }
};
