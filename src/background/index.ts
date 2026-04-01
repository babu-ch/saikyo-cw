// Service worker - 現時点では最小限
// API連携等が必要になった場合にここに追加

chrome.runtime.onInstalled.addListener(() => {
  console.log("saikyo-cw installed");
});
