const axios = require("axios");

module.exports = {
  config: {
    name: "ai",
    version: "1.0.2",
    credits: "CYBER-BOT-TEAM",
    description: "google ai",
    cooldowns: 0,
    hasPermission: 0,
    commandCategory: "google",
    usages: {
      en: "{pn} message | photo reply"
    }
  },

  run: async ({ api, args, event }) => {
    const input = args.join(" ").trim();

    // base64 থেকে ডিকোড — এটি একটি base URL হওয়া উচিত যার শেষে ?q= অথবা কাস্টম param না থাকলে আমরা params ব্যবহার করবো
    const encodedApi = "aHR0cHM6Ly9hcGlzLWtlaXRoLnZlcmNlbC5hcHAvYWkvZGVlcHNlZWtWMz9xPQ==";
    let apiUrl = Buffer.from(encodedApi, "base64").toString("utf-8");
    // যদি encodedApi শেষে already ?q= থাকে, আমরা baseUrl হিসাবেই ব্যবহার করবো এবং GET/POST এ params যোগ করবো।
    // উদাহরণ: https://.../ai/deepseekV3?q=
    // safer way: remove trailing 'q=' so axios params কাজ করবে:
    apiUrl = apiUrl.replace(/q=*$/i, "");

    // helper to send reply (many messenger libs use callback as 3rd arg; keep same signature)
    const send = (msg) => api.sendMessage(msg, event.threadID, event.messageID);

    try {
      if (event.type === "message_reply") {
        // Ensure we actually have attachments
        const attachments = event.messageReply && event.messageReply.attachments;
        if (!attachments || !attachments.length) {
          return send("অনুগ্রহ করে একটি ইমেজ রিপ্লাই করো (reply to an image).");
        }

        // find first image attachment with a url
        const imageAttachment = attachments.find(a => a.url || (a.type && a.type === "image" && a.payload && a.payload.url));
        const imageUrl = imageAttachment && (imageAttachment.url || (imageAttachment.payload && imageAttachment.payload.url));

        if (!imageUrl) {
          return send("রিপ্লাই করা মেসেজে কোনো ইমেজ URL পাওয়া যায়নি।");
        }

        // POST request — many endpoints expect JSON with q and image fields.
        const payload = {
          q: input || "Describe this image.",
          image: imageUrl
        };

        const res = await axios.post(apiUrl, payload, {
          headers: { "Content-Type": "application/json" },
          timeout: 20000
        });

        const result = res.data?.result || res.data?.response || res.data?.message || JSON.stringify(res.data) || "No response from AI.";
        return send(result);
      } else {
        // Non-reply (text query)
        if (!input) {
          return send("Hey I'm Ai Chat Bot\nHow can I assist you today?");
        }

        // GET request with params (cleaner than concatenating encodedURIComponent on URL)
        const res = await axios.get(apiUrl, {
          params: { q: input },
          timeout: 20000
        });

        const result = res.data?.result || res.data?.response || res.data?.message || JSON.stringify(res.data) || "No response from AI.";
        return send(result);
      }
    } catch (err) {
      // Log full error to console to help debugging (status, body)
      console.error("AI command error:", {
        message: err.message,
        code: err.code,
        responseStatus: err.response?.status,
        responseData: err.response?.data
      });

      // user-facing friendly message
      return send("দেখে নিচ্ছি — কোনো সমস্যা হয়েছে। কনসোলে এরর দেখতে হবে (check console).");
    }
  }
};
