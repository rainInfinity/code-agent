## 1. 项目脚手架搭建

- [x] 1.1 使用 `npm create tauri-app@latest` 初始化 Tauri 2.0 项目（模板选择 React + TypeScript + Vite）
- [x] 1.2 安装前端核心依赖：styled-components@6、zustand、react-markdown、react-syntax-highlighter、react-icons 及其类型声明
- [x] 1.3 配置 TypeScript 严格模式，更新 tsconfig.json 路径别名（@ → src/）
- [x] 1.4 配置 tauri.conf.json：窗口标题 "Code Agent"、默认尺寸 1200×800、最小尺寸 800×600
- [x] 1.5 创建前端目录结构：components/、stores/、hooks/、styles/、types/

## 2. 主题系统与全局样式

- [x] 2.1 定义 Dark/Light 主题对象（colors、typography、spacing、borderRadius、shadows）
- [x] 2.2 创建 styled-components ThemeProvider 和全局 GlobalStyle 组件
- [x] 2.3 实现 useTheme hook 和主题切换逻辑（Zustand store 持久化到 localStorage）
- [x] 2.4 引入 Google Fonts（Inter + JetBrains Mono 字体族）作为默认字体

## 3. 应用布局框架

- [x] 3.1 实现 AppLayout 主布局组件：左侧边栏 + 中央对话区 + 底部状态栏
- [x] 3.2 实现 Sidebar 组件：可折叠（260px ↔ 0px），包含应用 logo、新建对话按钮、设置入口
- [x] 3.3 实现 StatusBar 组件：显示连接状态、当前模型名称、token 使用量占位
- [x] 3.4 实现侧边栏折叠/展开动画（CSS transition）

## 4. 对话 UI 组件

- [x] 4.1 实现 ChatPanel 对话面板容器组件
- [x] 4.2 实现 MessageInput 消息输入组件：多行文本框、Enter 发送、Shift+Enter 换行、自动高度调整（最大 200px）
- [x] 4.3 实现 MessageList 消息列表组件：区分用户消息/AI 消息样式、自动滚动到底部
- [x] 4.4 实现 MessageBubble 消息气泡组件：用户消息（右侧对齐）、AI 消息（左侧对齐，带头像）
- [x] 4.5 集成 react-markdown 和 react-syntax-highlighter：渲染 Markdown 内容、代码块语法高亮、代码复制按钮
- [x] 4.6 实现流式打字效果：逐 token 追加到 AI 消息、加载状态指示（thinking indicator）

## 5. 状态管理

- [x] 5.1 创建 chatStore（Zustand）：对话列表、当前对话、消息历史、发送消息 action、流式追加 action
- [x] 5.2 创建 settingsStore（Zustand + persist）：API 配置（endpoint、apiKey、model）、主题模式、侧边栏状态
- [x] 5.3 创建 TypeScript 类型定义：Message、Conversation、ChatState、Settings、ToolCall、ToolResult

## 6. Rust 后端 - LLM API 集成

- [x] 6.1 添加 Rust 依赖：reqwest（streaming feature）、serde、serde_json、tokio、async-trait、futures-util
- [x] 6.2 实现 models 模块：定义 ChatMessage、AnthropicRequest、AnthropicResponse、StreamEvent 等数据结构
- [x] 6.3 实现 llm::client 模块：Anthropic Messages API 客户端，支持流式请求
- [x] 6.4 实现 llm::stream 模块：SSE 流式响应解析，逐 token 通过 Tauri Event 推送到前端
- [x] 6.5 实现 commands::chat 模块：`send_message` Tauri Command，协调 LLM 调用和流式转发
- [x] 6.6 实现 commands::settings 模块：`save_settings` / `load_settings` Tauri Commands，API Key 安全存储

## 7. Rust 后端 - 工具系统骨架

- [x] 7.1 定义 Tool trait：name()、description()、parameters_schema()、execute()
- [x] 7.2 实现 ToolRegistry：工具注册、按名称查找、列举所有工具（格式化为 OpenAI tools 数组）
- [x] 7.3 实现 ToolResult 结构体和工具调用协议（解析 LLM tool_calls → 执行 → 结果回传）
- [x] 7.4 实现一个 EchoTool 示例工具用于测试工具系统流程

## 8. 前后端集成

- [x] 8.1 实现前端 IPC 封装层：封装 invoke 和 listen 调用为类型安全的 API 函数
- [x] 8.2 连接 MessageInput → chatStore → Rust send_message → SSE Event → MessageList 的完整对话流
- [x] 8.3 实现设置页面 UI：API endpoint、API Key（密码框）、模型选择输入
- [x] 8.4 实现 API 未配置时的引导提示

## 9. 体验优化与收尾

- [x] 9.1 实现停止生成按钮：中断流式响应
- [x] 9.2 添加消息发送/接收的微动画效果
- [x] 9.3 实现空状态页面（无对话时的欢迎界面）
- [ ] 9.4 验证完整对话流程：发送消息 → LLM 流式响应 → Markdown 渲染 → 代码高亮
- [ ] 9.5 验证 `npm run tauri dev` 和 `npm run tauri build` 正常工作
