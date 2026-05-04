## Why

当前 DeepSeek 提供商使用 OpenAI 兼容格式（`/v1/chat/completions`）发送请求，但 DeepSeek 已推出 `https://api.deepseek.com/anthropic` 端点，兼容 Anthropic Messages API 格式。迁移后可以复用 Anthropic 的流式解析逻辑，并为后续思考过程（thinking）展示提供统一的数据通道。

同时存在四个 UI/UX 缺陷需要一次性修复：OpenAI 提供商无法使用但仍显示在选择列表中、助手思考过程不可见、底部状态栏切换提供商后模型名称不更新、以及新建/删除会话时的两个逻辑问题。

## What Changes

- **DeepSeek 端点迁移**：将 DeepSeek 从 OpenAI 兼容格式切换为 Anthropic 兼容格式，默认端点为 `https://api.deepseek.com/anthropic`，chat path 改为 `/v1/messages`，认证方式改为 `x-api-key`
- **隐藏 OpenAI 提供商**：从 `PROVIDER_IDS` 列表中移除 OpenAI，使其不在设置界面和任何选择器中显示。后端代码和类型定义保留不删
- **思考过程展示**：在 Rust 后端新增 `thinking` 内容块的流式解析，通过新增的 `thinking-delta` Tauri 事件推送到前端；前端在消息列表中渲染可折叠的思考过程面板（默认展开，带脉冲动画）
- **修复底部模型显示 Bug**：修复 `activeProviderSettings` 从 Zustand persist 恢复时指向过期引用的问题，让 StatusBar 直接从 `providers[activeProviderId]` 派生模型名称
- **修复空白会话重复创建**：在 `createConversation` 调用前检查当前活动会话是否为空（无消息），若为空则直接切换到该会话，避免侧边栏堆积多个"新会话"
- **修复跨模式会话错位**：`deleteConversation` 选择下一个活动会话时，使用当前模式的过滤列表而非全局列表，确保删除后不会跳到另一模式的会话

## Capabilities

### New Capabilities

- `deepseek-anthropic-compat`: DeepSeek 提供商改用 Anthropic Messages API 兼容端点，包含请求构建、流式解析、模型列表、认证方式的完整迁移
- `thinking-process-viewer`: 助手思考过程的前后端完整数据流——Rust 端解析 `thinking_delta` 流式事件，前端渲染可折叠思考面板

### Modified Capabilities

<!-- 以下 bug 修复不涉及新 capability，属于现有功能的修正 -->

## Impact

### Rust 后端
- `src-tauri/src/providers/deepseek.rs`: 重写为 Anthropic 兼容实现（参考 anthropic.rs），修改 `chat_path`、`auth_header`、`extra_headers`、`build_chat_request`、`parse_stream_data`、`parse_models_response` 全部方法
- `src-tauri/src/providers/mod.rs`: 新增 `ThinkingDelta` 变体到 `ParseResult`；修改 `default_endpoint`（deepseek 分支）；修改 `built_in_provider_ids` 移除 openai
- `src-tauri/src/models.rs`: 新增 `StreamThinkingEvent` 结构体；可选清理不再需要的 OpenAI 数据类型（保留以备用）
- `src-tauri/src/llm.rs`: 在流式解析循环中匹配 `ThinkingDelta` 并通过 Tauri event 发射
- `src-tauri/src/commands.rs`: 在 `send_message` / `run_agent` 中注册 `thinking-delta` 事件发射

### 前端
- `src/config/providers.ts`: DeepSeek 端点/model/path/authHeader 全部改为 Anthropic 兼容格式；`PROVIDER_IDS` 移除 `'openai'`
- `src/types/index.ts`: 新增 `StreamThinkingEvent` 类型；`ProviderId` 移除 `'openai'`
- `src/i18n/zh-CN.ts`: 删除 OpenAI 提供商选项文案
- `src/components/common/SettingsModal.tsx`: 移除 OpenAI 图标映射
- `src/stores/settingsStore.ts`: `defaultApiKeyConfigured` 移除 openai 条目
- `src/stores/chatStore.ts`: 新增 `appendThinkingToMessage` action；`createConversation` 添加空会话去重逻辑；`deleteConversation` 修复跨模式选择逻辑
- `src/hooks/useIpc.ts`: 新增 `onThinkingDelta` 事件监听器
- `src/hooks/useChat.ts` / `src/hooks/useAgent.ts`: 注册 thinking-delta 事件监听
- `src/components/Chat/MessageList.tsx`: 新增 `ThinkingPanel` 可折叠组件，在助手消息内渲染思考过程
- `src/components/Layout/StatusBar.tsx`: 修改 selector 直接从 `providers[activeProviderId]` 取值
