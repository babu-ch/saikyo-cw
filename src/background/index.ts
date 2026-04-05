chrome.runtime.onInstalled.addListener(() => {
  console.log("saikyo-cw installed");
});

// Chatwork API プロキシ
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { token } = message;

  if (message.type === "fetchMembers") {
    fetch(
      `https://api.chatwork.com/v2/rooms/${message.roomId}/members`,
      { headers: { "X-ChatWorkToken": token } },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((members) => sendResponse({ ok: true, members }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === "fetchMe") {
    fetch("https://api.chatwork.com/v2/me", {
      headers: { "X-ChatWorkToken": token },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((me) => sendResponse({ ok: true, me }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === "fetchRooms") {
    fetch("https://api.chatwork.com/v2/rooms", {
      headers: { "X-ChatWorkToken": token },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((rooms) => sendResponse({ ok: true, rooms }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === "fetchMessages") {
    fetch(
      `https://api.chatwork.com/v2/rooms/${message.roomId}/messages?force=1`,
      { headers: { "X-ChatWorkToken": token } },
    )
      .then((res) => {
        // 204 No Content = 未読なし → 空配列として返す
        if (res.status === 204) return [];
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((messages) => sendResponse({ ok: true, messages: Array.isArray(messages) ? messages : [] }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});
