chrome.runtime.onInstalled.addListener(() => {
  console.log("saikyo-cw installed");
});

// 拡張アイコンクリックでオプションページを開く
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
