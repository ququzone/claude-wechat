# WeChat Channel for Claude Code Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Claude Code Channel plugin that connects WeChat to Claude Code via iLink Bot API, enabling bidirectional chat from WeChat mobile to Claude Code desktop session.

**Architecture:** Standalone MCP server (Channel) using stdio transport. Long-polling iLink API for incoming messages, `reply` tool for outbound. Separate auth flow for QR code login.

**Tech Stack:** Bun runtime, TypeScript, MCP SDK, Zod for validation

---

## Task 1: Type Definitions

**Files:**
- Create: `src/types.ts`

**Step 1: Write type definitions file**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add type definitions for iLink API"
```

---

## Task 2: Utility Functions

**Files:**
- Create: `src/utils.ts`

**Step 1: Write utility functions**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/utils.ts
git commit -m "feat: add utility functions"
```

---

## Task 3: Credentials Management

**Files:**
- Create: `src/credentials.ts`

**Step 1: Write credentials module**

```typescript
import type { Credentials } from './types.js'
import { mkdir, writeFile, readFile, access } from 'fs/promises'
import { dirname, homedir } from 'path'
import { existsSync } from 'fs'

const CREDENTIALS_PATH = `${homedir()}/.wechat-channel/credentials.json`

export async function loadCredentials(): Promise<Credentials> {
  const data = await readFile(CREDENTIALS_PATH, 'utf-8')
  return JSON.parse(data)
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  const dir = dirname(CREDENTIALS_PATH)
  await mkdir(dir, { recursive: true })
  await writeFile(CREDENTIALS_PATH, JSON.stringify(creds, null, 2))
  console.log(`Credentials saved to ${CREDENTIALS_PATH}`)
}

export async function credentialsExist(): Promise<boolean> {
  try {
    await access(CREDENTIALS_PATH)
    return true
  } catch {
    return false
  }
}

export function getCredentialPath(): string {
  return CREDENTIALS_PATH
}
```

**Step 2: Commit**

```bash
git add src/credentials.ts
git commit -m "feat: add credentials management"
```

---

## Task 4: iLink HTTP Client

**Files:**
- Create: `src/ilink.ts`

**Step 1: Write iLink client class**

```typescript
import type { Credentials, GetUpdatesResponse, SendMessageResponse, BaseInfo } from './types.js'
import { generateClientID, generateWechatUIN, truncate } from './utils.js'

export class ILinkClient {
  private baseURL: string
  private botToken: string
  private botID: string
  private wechatUIN: string

  constructor(creds: Credentials) {
    this.baseURL = creds.baseurl || 'https://ilinkai.weixin.qq.com'
    this.botToken = creds.bot_token
    this.botID = creds.ilink_bot_id
    this.wechatUIN = generateWechatUIN()
  }

  async getUpdates(buf: string): Promise<GetUpdatesResponse> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 40000)

    try {
      const response = await fetch(`${this.baseURL}/ilink/bot/getupdates`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          get_updates_buf: buf,
          base_info: { channel_version: '1.0.0' } as BaseInfo,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: GetUpdatesResponse = await response.json()

      if (data.ret !== 0) {
        throw new Error(`iLink API error: ${data.errmsg || 'Unknown error'} (ret=${data.ret})`)
      }

      return data

    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout after 40s')
      }
      throw error
    }
  }

  async sendMessage(userID: string, text: string): Promise<void> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot send empty message')
    }

    const response = await fetch(`${this.baseURL}/ilink/bot/sendmessage`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        msg: {
          from_user_id: this.botID,
          to_user_id: userID,
          client_id: generateClientID(),
          message_type: 2,
          message_state: 2,
          item_list: [{ type: 1, text_item: { text: text.trim() } }],
          context_token: '',
        },
        base_info: {} as BaseInfo,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to send message: HTTP ${response.status}`)
    }

    const data: SendMessageResponse = await response.json()
    if (data.ret !== 0) {
      throw new Error(`Send failed: ${data.errmsg || 'Unknown error'}`)
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'AuthorizationType': 'ilink_bot_token',
      'Authorization': `Bearer ${this.botToken}`,
      'X-WECHAT-UIN': this.wechatUIN,
    }
  }

  getBotID(): string {
    return this.botID
  }
}
```

**Step 2: Commit**

```bash
git add src/ilink.ts
git commit -m "feat: add iLink HTTP client"
```

---

## Task 5: Login/Auth Flow

**Files:**
- Create: `src/auth.ts`

**Step 1: Write login flow**

```typescript
import type { Credentials, QRCodeResponse, QRStatusResponse } from './types.js'
import { saveCredentials, credentialsExist } from './credentials.js'
import { sleep } from './utils.js'

export async function login(): Promise<Credentials> {
  // 1. Fetch QR code
  console.log('Fetching QR code...')
  const qrResp = await fetch('https://ilinkai.weixin.qq.com/ilink/bot/get_bot_qrcode')
  if (!qrResp.ok) {
    throw new Error('Failed to fetch QR code')
  }

  const qrData: QRCodeResponse = await qrResp.json()

  console.log('\nScan this QR code with WeChat:')
  console.log('────────────────────────────────────')
  console.log(qrData.qrcode_img_content)
  console.log('────────────────────────────────────')
  console.log(`\nQR URL: ${qrData.qrcode}`)
  console.log('\nWaiting for scan...')

  // 2. Poll login status
  let lastStatus = ''
  let attempts = 0
  const MAX_ATTEMPTS = 60 // 2 minutes

  while (attempts < MAX_ATTEMPTS) {
    const statusResp = await fetch(
      `https://ilinkai.weixin.qq.com/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrData.qrcode)}`
    )

    if (!statusResp.ok) {
      throw new Error('Failed to check QR status')
    }

    const status: QRStatusResponse = await statusResp.json()

    if (status.status !== lastStatus) {
      lastStatus = status.status
      if (status.status === 'scaned') {
        console.log('QR code scanned! Please confirm on your phone.')
      } else if (status.status === 'confirmed') {
        console.log('Login confirmed!')
      } else if (status.status === 'expired') {
        throw new Error('QR code expired. Please run again.')
      }
    }

    if (status.status === 'confirmed' && status.bot_token && status.ilink_bot_id) {
      const creds: Credentials = {
        bot_token: status.bot_token,
        ilink_bot_id: status.ilink_bot_id,
        baseurl: status.baseurl,
        ilink_user_id: status.ilink_user_id || '',
      }
      await saveCredentials(creds)
      console.log(`\nBot ID: ${creds.ilink_bot_id}`)
      return creds
    }

    await sleep(2000)
    attempts++
  }

  throw new Error('Login timeout. Please try again.')
}

export async function ensureCredentials(): Promise<Credentials> {
  if (await credentialsExist()) {
    const { loadCredentials } = await import('./credentials.js')
    return loadCredentials()
  }
  console.log('No credentials found. Starting login flow...')
  return login()
}
```

**Step 2: Commit**

```bash
git add src/auth.ts
git commit -m "feat: add login flow with QR code"
```

---

## Task 6: Main MCP Server

**Files:**
- Create: `src/index.ts`

**Step 1: Write MCP server**

```typescript
#!/usr/bin/env bun
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { ILinkClient } from './ilink.js'
import { ensureCredentials } from './auth.js'
import { extractText, truncate } from './utils.js'
import type { WeixinMessage, MessageType, MessageState } from './types.js'

// Create MCP Server and declare as Channel
const mcp = new Server(
  { name: 'wechat', version: '0.0.1' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
      tools: {},
    },
    instructions: `WeChat messages arrive as <channel source="wechat" chat_id="..." context_token="...">.
Reply using the reply tool with chat_id and text parameters.
Messages are from WeChat users - respond in a friendly, helpful tone.`,
  },
)

// Register reply tool
mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'reply',
    description: 'Send a message back to WeChat',
    inputSchema: {
      type: 'object',
      properties: {
        chat_id: { type: 'string', description: 'WeChat user ID to reply to' },
        text: { type: 'string', description: 'Message content to send' },
      },
      required: ['chat_id', 'text'],
    },
  }],
}))

// Global reference for reply tool
let ilinkClient: ILinkClient

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === 'reply') {
    const { chat_id, text } = req.params.arguments as { chat_id: string; text: string }
    console.log(`[wechat] Sending reply to ${chat_id}: ${truncate(text, 50)}`)
    await ilinkClient.sendMessage(chat_id, text)
    return { content: [{ type: 'text', text: 'sent' }] }
  }
  throw new Error(`unknown tool: ${req.params.name}`)
})

// Connect via stdio
await mcp.connect(new StdioServerTransport())
console.error('[wechat] MCP Server connected via stdio')

// Load credentials
const creds = await ensureCredentials()
ilinkClient = new ILinkClient(creds)
console.error(`[wechat] Connected to bot ${ilinkClient.getBotID()}`)

// Message polling loop
async function runMessageLoop() {
  let updateBuf = ''
  let retryCount = 0
  const MAX_RETRIES = 5
  const BASE_DELAY = 3000

  while (true) {
    try {
      const response = await ilinkClient.getUpdates(updateBuf)

      // Reset retry count on success
      retryCount = 0
      updateBuf = response.get_updates_buf || ''

      for (const msg of response.msgs || []) {
        await processMessage(msg)
      }

    } catch (error) {
      retryCount++

      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`[wechat] Network error (attempt ${retryCount}/${MAX_RETRIES}):`, error.message)
      } else {
        console.error('[wechat] Unexpected error:', error)
      }

      // Exponential backoff
      const delay = BASE_DELAY * Math.pow(2, Math.min(retryCount - 1, 5))
      await sleep(delay)

      // Reset buffer after connection loss
      if (retryCount >= 3) {
        console.log('[wechat] Resetting update buffer after retries')
        updateBuf = ''
      }

      // Give up after max retries
      if (retryCount >= MAX_RETRIES) {
        console.error('[wechat] Max retries exceeded. Please check network and restart.')
        throw error
      }
    }
  }
}

async function processMessage(msg: WeixinMessage) {
  // Only process user messages that are finished
  if (msg.message_type !== MessageType.User || msg.message_state !== MessageState.Finish) {
    return
  }

  const text = extractText(msg)
  if (!text) {
    console.log(`[wechat] Received non-text message from ${msg.from_user_id}, skipping`)
    return
  }

  console.log(`[wechat] Received from ${msg.from_user_id}: ${truncate(text, 80)}`)

  try {
    await mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: text,
        meta: {
          chat_id: msg.from_user_id,
          context_token: msg.context_token,
        },
      },
    })
  } catch (error) {
    console.error('[wechat] Failed to forward message to Claude:', error)

    // Send error back to user
    try {
      await ilinkClient.sendMessage(
        msg.from_user_id,
        'Sorry, there was an error processing your message. Please try again.'
      )
    } catch (sendError) {
      console.error('[wechat] Failed to send error message:', sendError)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Start polling
console.error('[wechat] Starting message polling loop...')
await runMessageLoop()
```

**Step 2: Make executable**

```bash
chmod +x src/index.ts
```

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add main MCP server with message loop"
```

---

## Task 7: MCP Configuration

**Files:**
- Create: `.mcp.json`
- Create: `README.md`

**Step 1: Create MCP config**

```json
{
  "mcpServers": {
    "wechat": {
      "command": "bun",
      "args": ["./src/index.ts"]
    }
  }
}
```

**Step 2: Write README**

```markdown
# WeChat Channel for Claude Code

A Claude Code Channel plugin that connects WeChat to Claude Code via iLink Bot API.

## Features

- Bidirectional chat between WeChat mobile and Claude Code desktop
- QR code login flow
- Automatic reconnection with exponential backoff
- Real-time message polling

## Installation

```bash
bun install
```

## First-Time Setup

Login to WeChat:

```bash
bun src/auth.ts
```

Scan the QR code with WeChat to authenticate.

## Usage

Start Claude Code with the WeChat channel:

```bash
claude --dangerously-load-development-channels server:wechat
```

Send messages from WeChat, they will appear in Claude Code as:

\`\`\`
<channel source="wechat" chat_id="..." context_token="...">your message</channel>
\`\`\`

Claude can reply using the `reply` tool.

## Configuration

Credentials are stored in `~/.wechat-channel/credentials.json`.

## Architecture

- **iLink API**: WeChat's official Bot API
- **MCP Server**: Channel plugin via stdio
- **Long-polling**: 35s timeout for new messages

## Development

```bash
# Run directly for testing
bun src/index.ts

# Format code
bun run format
```

## License

MIT
```

**Step 3: Commit**

```bash
git add .mcp.json README.md
git commit -m "docs: add MCP config and README"
```

---

## Task 8: Package Configuration

**Files:**
- Modify: `package.json`

**Step 1: Update package.json**

```json
{
  "name": "claude-wechat-channel",
  "version": "0.0.1",
  "description": "WeChat Channel for Claude Code",
  "type": "module",
  "scripts": {
    "start": "bun src/index.ts",
    "login": "bun src/auth.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.1",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.9.3"
  }
}
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "chore: update package.json with scripts"
```

---

## Testing Instructions

After implementing all tasks:

1. **Test login flow:**
   ```bash
   bun run login
   ```
   Scan QR code, verify credentials saved.

2. **Test MCP server:**
   ```bash
   bun start
   ```
   Should see "MCP Server connected via stdio" and "Starting message polling loop..."

3. **Test with Claude Code:**
   ```bash
   claude --dangerously-load-development-channels server:wechat
   ```
   Send message from WeChat, verify it appears in Claude Code.

4. **Test error handling:**
   - Disconnect network, verify retry logic works
   - Send empty message, verify error handling

5. **Test reply tool:**
   - Ask Claude to reply, verify message arrives in WeChat
