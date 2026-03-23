// Message types
export const MessageType = {
  None: 0,
  User: 1,
  Bot: 2,
} as const

export const MessageState = {
  New: 0,
  Generating: 1,
  Finish: 2,
} as const

export const ItemType = {
  None: 0,
  Text: 1,
  Image: 2,
  Voice: 3,
  File: 4,
  Video: 5,
} as const

// API Response types
export interface QRCodeResponse {
  qrcode: string
  qrcode_img_content: string
}

export interface QRStatusResponse {
  status: 'scaned' | 'confirmed' | 'expired'
  bot_token?: string
  ilink_bot_id?: string
  baseurl?: string
  ilink_user_id?: string
}

export interface Credentials {
  bot_token: string
  ilink_bot_id: string
  baseurl?: string
  ilink_user_id: string
}

export interface GetUpdatesResponse {
  ret: number
  errcode?: number
  errmsg?: string
  msgs?: WeixinMessage[]
  get_updates_buf: string
  longpolling_timeout_ms?: number
}

export interface WeixinMessage {
  from_user_id: string
  to_user_id: string
  message_type: number
  message_state: number
  item_list: MessageItem[]
  context_token: string
}

export interface MessageItem {
  type: number
  text_item?: TextItem
  image_item?: ImageItem
}

export interface TextItem {
  text: string
}

export interface ImageItem {
  url?: string
}

export interface SendMessageResponse {
  ret: number
  errmsg?: string
}

export interface BaseInfo {
  channel_version?: string
}
