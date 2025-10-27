const axios = require("axios");
const fs = require('fs');
const path = require('path');

let cachedApiBase = null;

// সঠিক raw GitHub URL (আগেরটায় path ভুল ছিল)
async function getBaseApiUrl() {
  if (cachedApiBase) return cachedApiBase;
  try {
    const rawUrl = "https://raw.githubusercontent.com/cyber-ullash/cyber-ullash/main/UllashApi.json";
    const res = await axios.get(rawUrl, { timeout: 10000 });
    if (!res.data || !res.data.api) throw new Error("Invalid UllashApi.json structure");
    cachedApiBase = res.data.api;
    return cachedApiBase;
  } catch (err) {
    console.error("Failed to fetch base API URL:", err.message || err);
    throw err;
  }
}

module.exports = {
  config: {
    name: "youtube",
    version: "1.1.5",
    credits: "dipto", // fixed by Ullash
    countDown: 5,
    hasPermssion: 0,
    description: "Download video, audio, and info from YouTube",
    category: "media",
    commandCategory: "media",
    usePrefix: true,
    prefix: true,
    usages:
      " {pn} [video|-v] [<video name>|<video link>]\n" +
      " {pn} [audio|-a] [<video name>|<video link>]\n" +
      " {pn} [info|-i] [<video name>|<video link>]\n" +
      "Example:\n" +
      "{pn} -v chipi chipi chapa chapa\n" +
      "{pn} -a chipi chipi chapa chapa\n" +
      "{pn} -i chipi chipi chapa chapa"
  },

  run: async ({ api, args, event }) => {
    const { threadID, messageID, senderID } = event;

    let action = args[0] ? args[0].toLowerCase() : '-v';

    if (!['-v', 'video', 'mp4', '-a', 'audio', 'mp3', '-i', 'info'].includes(action)) {
      args.unshift('-v');
      action = '-v';
    }

    const checkurl = /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))(([\w-]{11}))(\S+)?$/;
    const urlYtb = args[1] ? checkurl.test(args[1]) : false;

    if (urlYtb) {
      const format = ['-v', 'video', 'mp4'].includes(action) ? 'mp4'
        : ['-a', 'audio', 'mp3'].includes(action) ? 'mp3' : null;

      if (!format) return api.sendMessage('❌ Invalid format. Use -v for video or -a for audio.', threadID, messageID);

      try {
        const match = args[1].match(checkurl);
        const videoID = match ? match[1] : null;
        if (!videoID) return api.sendMessage('❌ Invalid YouTube link.', threadID, messageID);

        const pathName = `ytb_${format}_${videoID}.${format}`;
        const baseApi = await getBaseApiUrl();
        const res = await axios.get(`${baseApi}/ytDl3?link=${videoID}&format=${format}&quality=3`);
        const data = res.data;
        if (!data || !data.downloadLink) return api.sendMessage('❌ Download link not returned by API.', threadID, messageID);

        await api.sendMessage({
          body: `• Title: ${data.title}\n• Quality: ${data.quality || 'unknown'}`,
          attachment: await downloadFile(data.downloadLink, pathName)
        }, threadID, () => {
          try { fs.unlinkSync(pathName); } catch (e) { /* ignore */ }
        }, messageID);

        return;
      } catch (e) {
        console.error("Download error:", e && e.response ? (e.response.data || e.response.status) : e.message || e);
        return api.sendMessage('❌ Failed to download. Please try again later.', threadID, messageID);
      }
    }

    // Search flow
    args.shift(); 
    const keyWord = args.join(" ").trim();
    if (!keyWord) return api.sendMessage('❌ Please provide a search keyword.', threadID, messageID);

    try {
      const baseApi = await getBaseApiUrl();
      const searchRes = await axios.get(`${baseApi}/ytFullSearch?songName=${encodeURIComponent(keyWord)}`, { timeout: 10000 });
      const searchResult = (Array.isArray(searchRes.data) ? searchRes.data : []).slice(0, 6);

      if (!searchResult.length) return api.sendMessage(`⭕ No results for keyword: ${keyWord}`, threadID, messageID);

      let msg = "";
      const thumbnailPromises = [];
      let i = 1;

      for (const info of searchResult) {
        msg += `${i}. ${info.title}\nTime: ${info.time || 'N/A'}\nChannel: ${info.channel ? info.channel.name : (info.channelName || 'N/A')}\n\n`;
        thumbnailPromises.push(streamImage(info.thumbnail, `thumbnail_${i}.jpg`));
        i++;
      }

      api.sendMessage({
        body: msg + "👉 Reply to this message with a number to select.",
        attachment: await Promise.all(thumbnailPromises)
      }, threadID, (err, info) => {
        if (err) {
          console.error("sendMessage with thumbnails error:", err);
          return api.sendMessage("❌ Failed to send thumbnails.", threadID, messageID);
        }
        global.client.handleReply.push({
          name: module.exports.config.name,
          messageID: info.messageID,
          author: senderID,
          result: searchResult,
          action
        });
      }, messageID);
    } catch (err) {
      console.error("Search error:", err.message || err);
      return api.sendMessage("❌ An error occurred while searching: " + (err.message || err), threadID, messageID);
    }
  },

  handleReply: async ({ event, api, handleReply }) => {
    const { threadID, messageID, senderID, body } = event;

    if (senderID !== handleReply.author) return;
    const { result, action } = handleReply;
    const choice = parseInt(body);

    if (isNaN(choice) || choice <= 0 || choice > result.length)
      return api.sendMessage("❌ Invalid number. Please reply with a valid number.", threadID, messageID);

    const selectedVideo = result[choice - 1];
    const videoID = selectedVideo.id;

    try {
      await api.unsendMessage(handleReply.messageID);
    } catch (e) {
      console.error("Unsend failed:", e);
    }

    if (['-v', 'video', 'mp4', '-a', 'audio', 'mp3', 'music'].includes(action)) {
      const format = ['-v', 'video', 'mp4'].includes(action) ? 'mp4' : 'mp3';
      try {
        const pathName = `ytb_${format}_${videoID}.${format}`;
        const baseApi = await getBaseApiUrl();
        const res = await axios.get(`${baseApi}/ytDl3?link=${videoID}&format=${format}&quality=3`);
        const data = res.data;
        if (!data || !data.downloadLink) return api.sendMessage('❌ Download link not returned by API.', threadID, messageID);

        await api.sendMessage({
          body: `• Title: ${data.title}\n• Quality: ${data.quality || 'unknown'}`,
          attachment: await downloadFile(data.downloadLink, pathName)
        }, threadID, () => {
          try { fs.unlinkSync(pathName); } catch (e) { /* ignore */ }
        }, messageID);
      } catch (e) {
        console.error("Download (handleReply) error:", e && e.response ? (e.response.data || e.response.status) : e.message || e);
        return api.sendMessage('❌ Failed to download. Please try again later.', threadID, messageID);
      }
    }

    if (action === '-i' || action === 'info') {
      try {
        const baseApi = await getBaseApiUrl();
        const infoRes = await axios.get(`${baseApi}/ytfullinfo?videoID=${videoID}`, { timeout: 10000 });
        const data = infoRes.data && infoRes.data.data ? infoRes.data.data : infoRes.data;

        if (!data) return api.sendMessage('❌ Failed to retrieve video info (no data).', threadID, messageID);

        const bodyMsg = [
          `✨ Title: ${data.title || 'N/A'}`,
          `⏳ Duration: ${data.duration ? (data.duration / 60).toFixed(2) + ' mins' : 'N/A'}`,
          `📺 Resolution: ${data.resolution || 'N/A'}`,
          `👀 Views: ${data.view_count || 'N/A'}`,
          `👍 Likes: ${data.like_count || 'N/A'}`,
          `💬 Comments: ${data.comment_count || 'N/A'}`,
          `📂 Category: ${Array.isArray(data.categories) && data.categories[0] ? data.categories[0] : (data.category || 'N/A')}`,
          `📢 Channel: ${data.channel || 'N/A'}`,
          `🧍 Uploader ID: ${data.uploader_id || 'N/A'}`,
          `👥 Subscribers: ${data.channel_follower_count || 'N/A'}`,
          `🔗 Channel URL: ${data.channel_url || 'N/A'}`,
          `🔗 Video URL: ${data.webpage_url || 'N/A'}`
        ].join("\n");

        await api.sendMessage({
          body: bodyMsg,
          attachment: data.thumbnail ? await streamImage(data.thumbnail, 'info_thumb.jpg') : null
        }, threadID, messageID);
      } catch (e) {
        console.error("Info fetch error:", e && e.response ? (e.response.data || e.response.status) : e.message || e);
        return api.sendMessage('❌ Failed to retrieve video info.', threadID, messageID);
      }
    }
  }
};


async function downloadFile(url, pathName) {
  try {
    const res = await axios.get(url, { responseType: "arraybuffer", timeout: 20000 });
    fs.writeFileSync(pathName, Buffer.from(res.data));
    return fs.createReadStream(pathName);
  } catch (err) {
    console.error("downloadFile error:", err.message || err);
    throw err;
  }
}

async function streamImage(url, pathName) {
  try {
    if (!url) throw new Error("No image URL provided");
    const res = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
    // Ensure folder exists (optional)
    const outPath = path.resolve(process.cwd(), pathName);
    fs.writeFileSync(outPath, Buffer.from(res.data));
    return fs.createReadStream(outPath);
  } catch (err) {
    console.error("streamImage error:", err.message || err);
    throw err;
  }
          }
