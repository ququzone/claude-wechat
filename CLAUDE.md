# WeChat Channel for Claude Code

A Claude Code Channel plugin that connects WeChat to Claude Code via iLink Bot API.

## Project Overview

This is an **MCP (Model Context Protocol) Server** that implements a Claude Code Channel plugin, enabling bidirectional communication between WeChat mobile and Claude Code desktop.

**Important**: This is NOT a web server application. It's a long-running process that communicates via stdio with Claude Code and connects to WeChat via the iLink Bot API.

## Technology Stack

- **Runtime**: Bun (preferred over Node.js)
- **Language**: TypeScript (ESNext target)
- **Core Dependencies**:
  - `@modelcontextprotocol/sdk` - MCP protocol implementation
  - `zod` - Schema validation
- **External API**: iLink Bot API (WeChat's official Bot API)

## Bun Runtime Guidelines

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- Bun automatically loads .env files
- Use native `fetch` API instead of node-fetch
- Prefer `crypto.getRandomValues()` over node's crypto module

## Architecture

### MCP Server (src/index.ts)

The MCP server:
1. Connects to Claude Code via **stdio transport**
2. Declares itself as a **Channel** via capabilities
3. Provides a single `reply` tool for sending messages back to WeChat
4. Uses **notifications** to forward incoming WeChat messages to Claude

Key patterns:
- **Stdio communication**: Uses `StdioServerTransport` for bidirectional JSON-RPC
- **Channel protocol**: Implements `experimental: { 'claude/channel': {} }` capability
- **Message forwarding**: Sends notifications via `notifications/claude/channel` method
- **Tool invocation**: Handles `CallToolRequestSchema` for the reply tool

### iLink Client (src/ilink.ts)

Handles WeChat API communication:
- **Long-polling**: 40s timeout for `getUpdates()`
- **Message sending**: POST to `/ilink/bot/sendmessage`
- **Retry logic**: Exponential backoff on network errors (up to 5 retries)
- **Buffer management**: Maintains `get_updates_buf` for incremental updates

### Authentication (src/auth.ts)

QR code login flow:
1. Fetch QR code from WeChat API
2. Display ASCII QR code in terminal
3. Poll for scan/confirm status
4. Store credentials in `~/.wechat-channel/credentials.json`

### Type Safety (src/types.ts)

Strong TypeScript types for:
- API responses (QRCodeResponse, GetUpdatesResponse, SendMessageResponse)
- Message types (MessageType, MessageState, ItemType)
- WeChat message structures (WeixinMessage, MessageItem)

## Project Structure

```
src/
├── index.ts       # MCP server entry point & message loop
├── ilink.ts       # iLink API client
├── auth.ts        # QR code login & credential management
├── types.ts       # TypeScript type definitions
├── utils.ts       # Helper functions (text extraction, truncation)
└── credentials.ts # Credential storage operations

.claude-plugin/
├── plugin.json        # Plugin manifest (MCP server config)
└── marketplace.json   # Marketplace metadata

.mcp.json          # Local MCP server configuration
```

## Key Configuration Files

- **[.claude-plugin/plugin.json](.claude-plugin/plugin.json)**: Plugin manifest defining MCP server command
- **[.mcp.json](.mcp.json)**: Local development MCP server configuration
- **[tsconfig.json](tsconfig.json)**: TypeScript config with strict mode enabled
- **[package.json](package.json)**: Dependencies and scripts

## Development Patterns

### Error Handling
- Network errors trigger exponential backoff (3s base delay)
- Connection loss after 3 retries resets the update buffer
- Max 5 retries before giving up
- User-friendly error messages sent back to WeChat on failures

### Message Processing
- Only process user messages with `message_state === MessageState.Finish`
- Filter out non-text messages (images, voice, files)
- Use `extractText()` utility to get message content
- Truncate long messages for logging (50-80 chars)

### Concurrency
- Sequential message processing in the polling loop
- Single ILinkClient instance shared across the server
- Global reference stored for reply tool access

## Installation & Usage

See [README.md](README.md) for:
- Installation instructions
- Development mode setup
- QR code login flow
- Channel usage examples

## Testing

Currently no automated tests. Manual testing:
1. Run `bun src/auth.ts` to login
2. Start MCP server: `bun src/index.ts`
3. Send test messages from WeChat
4. Verify Claude receives and responds
