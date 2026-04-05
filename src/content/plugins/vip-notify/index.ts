import type { CwPlugin } from "../types";
import { initVipNotify, destroyVipNotify } from "./vip-scanner";

export const vipNotifyPlugin: CwPlugin = {
  config: {
    id: "vip-notify",
    name: "VIP Notify",
    description:
      "VIPメンバーの未読発言があるルームのバッジ色を変更します。表示中のチャット一覧のみ検知（最大80件）。APIトークンを消費します（通常5分で10〜50リクエスト、最大80リクエスト/回）。",
    defaultEnabled: false,
  },
  init() {
    initVipNotify();
  },
  destroy() {
    destroyVipNotify();
  },
};
