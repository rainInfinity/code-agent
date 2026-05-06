## 1. 基础设施准备

- [ ] 1.1 安装 class-variance-authority 依赖：`npm install class-variance-authority`
- [ ] 1.2 在 `src/utils/` 创建 `cn.ts` 工具函数（className 合并工具，供 cva 配合 styled-components 使用）

## 2. 样式 Mixins 抽象

- [ ] 2.1 创建 `src/styles/mixins.ts`，定义 `focusRing`、`interactiveBg`、`statusColor`、`textEllipsis` 四个核心 mixin
- [ ] 2.2 在 MessageList.tsx 的 CopyButton 中应用 `interactiveBg` 和 `focusRing` mixin，验证效果一致

## 3. 类型定义拆分

- [ ] 3.1 创建 `types/message.ts`，迁移 Message、ContentBlock、MessageRole、MessageStatus、ContentBlockType、ToolCall、ToolResult 类型
- [ ] 3.2 创建 `types/trace.ts`，迁移 TurnTrace、ToolTrace、TurnTraceStatus、TurnThinkingStatus、ToolTracePhase、AgentStatus、ConversationTrace、TraceDockingState、TraceState 等类型
- [ ] 3.3 创建 `types/settings.ts`，迁移 Settings、ProviderSettingsMap、ProviderApiKeyConfiguredMap、WorkDir 类型
- [ ] 3.4 创建 `types/provider.ts`，迁移 ProviderId、ProviderDefinition、ProviderSettings 类型
- [ ] 3.5 创建 `types/events.ts`，迁移所有 Stream/Trace/Agent IPC 事件接口（StreamEvent、ToolTraceEvent、AgentTurnEvent 等）
- [ ] 3.6 创建 `types/store.ts`，迁移 ChatState、TraceState 等 store 接口
- [ ] 3.7 重写 `types/index.ts` 为统一导出桶，从子模块 re-export 所有类型，处理交叉引用（如 message.ts 依赖 trace.ts 的 ToolTrace）
- [ ] 3.8 运行 `tsc --noEmit` 验证类型系统完整性

## 4. 子组件提取

- [ ] 4.1 提取 `Chat/ThinkingPanel.tsx` — 从 MessageList.tsx 中提取 ThinkingPanel 组件及 ThinkingPanelShell、ThinkingPanelHeader 等关联 styled 组件
- [ ] 4.2 提取 `Chat/ToolResultBlock.tsx` — 从 MessageList.tsx 中提取 ToolResultBlock 组件及 ToolResultShell、ToolResultContent styled 组件
- [ ] 4.3 提取 `Chat/TurnSection.tsx` — 从 MessageList.tsx 中提取 TurnSection 组件及 TurnSectionShell styled 组件
- [ ] 4.4 提取 `Chat/MessageBodyContent.tsx` — 从 MessageList.tsx 中提取 MessageBodyContent 组件及 buildFallbackToolTrace 辅助函数
- [ ] 4.5 提取 `Chat/MessageItem.tsx` — 从 MessageList.tsx 中提取 MessageItem 组件及相关 styled 组件（MessageWrapper、Avatar、MessageContent、RoleName、MessageBody、MessageActions）
- [ ] 4.6 更新 MessageList.tsx — 从新文件导入提取后的子组件，移除内联定义
- [ ] 4.7 将 keframes 动画定义（pulse、shimmer、blink）移至 `Chat/animations.ts`
- [ ] 4.8 将 formatThinkingDuration 工具函数移至 `utils/formatThinkingDuration.ts`
- [ ] 4.9 运行 `MessageList.test.tsx` 确认所有测试通过

## 5. CVA 变体管理

- [ ] 5.1 在 MessageItem.tsx 的 CopyButton 中引入 cva，定义 `copyButtonVariants`（tone: idle/success/error）
- [ ] 5.2 在 MessageItem.tsx 的 MessageWrapper 中引入 cva，定义 `messageWrapperVariants`（role: user/assistant）
- [ ] 5.3 在 MessageList.tsx 的 ScrollToBottomButton 中引入 cva，定义 `scrollButtonVariants`（visible: true/false）
- [ ] 5.4 在 ThinkingPanel.tsx 的 ThinkingPanelShell 中引入 cva，定义 `thinkingPanelVariants`（isThinking: true/false）

## 6. Store 职责拆分

- [ ] 6.1 创建 `stores/conversationStore.ts`，提取会话 CRUD 逻辑（createConversation、deleteConversation、updateConversation、activeConversationId 管理）
- [ ] 6.2 创建 `stores/messageStore.ts`，提取消息与 Turn 管理逻辑（sendMessage、appendStreamDelta、updateMessage、addTurn 等）
- [ ] 6.3 重写 `stores/chatStore.ts` 为组合 store，合并 conversationStore 和 messageStore，保持原有 `useChatStore` 导出 API 兼容
- [ ] 6.4 更新 `hooks/useAgent.ts` 中的 store 引用，确认直接访问子 store 或通过兼容层
- [ ] 6.5 运行 `chatStore.test.ts` 确认所有测试通过

## 7. FoldDivider 迁移

- [ ] 7.1 将 `components/Chat/FoldDivider.tsx` 移动至 `components/common/FoldDivider.tsx`
- [ ] 7.2 更新 MessageList.tsx 中的 FoldDivider 导入路径为 `@/components/common/FoldDivider`
- [ ] 7.3 更新 TracePanel.tsx 中的 FoldDivider 导入路径为 `@/components/common/FoldDivider`

## 8. 集成验证

- [ ] 8.1 运行全量 TypeScript 编译检查：`tsc --noEmit`
- [ ] 8.2 运行全量测试套件：`npm test`，确认所有测试通过
- [ ] 8.3 启动开发服务器，手动验证 Chat 界面渲染、消息发送、Streaming、折叠/展开功能正常
- [ ] 8.4 手动验证 Trace 窗口的折叠功能和 UI 正常
