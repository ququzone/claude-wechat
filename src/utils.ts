import type { WeixinMessage, MessageItem, ItemType, TextItem } from './types.js'

export function extractText(msg: WeixinMessage): string {
  for (const item of msg.item_list || []) {
    if (item.type === ItemType.Text && item.text_item?.text) {
      return item.text_item.text
    }
  }
  return ''
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.substring(0, maxLen) + '...'
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function generateClientID(): string {
  return `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function generateWechatUIN(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]
  return btoa(String(n))
}
