# store-responsibility-split Specification

## ADDED Requirements

### Requirement: 拆分 chatStore 为子 store
`chatStore.ts` SHALL 按职责拆分为 `conversationStore.ts`（会话 CRUD）和 `messageStore.ts`（消息与 Turn 管理），原 `chatStore.ts` 变为组合导出以保持 API 兼容。

#### Scenario: conversationStore 管理会话生命周期
- **WHEN** 调用 `useConversationStore.getState().createConversation()`
- **THEN** 新会话被加入 conversations 数组，自动设为 active

#### Scenario: messageStore 管理消息与 Turn
- **WHEN** 调用 `useMessageStore.getState().appendStreamDelta(conversationId, messageId, delta)`
- **THEN** 目标消息的 content 字段追加 delta 内容

#### Scenario: 原 chatStore 导出保持兼容
- **WHEN** 代码使用 `import { useChatStore } from '@/stores/chatStore'` 
- **THEN** 所有原有方法可用，行为与拆分前一致

#### Scenario: persist 中间件继续工作
- **WHEN** conversationStore 和 messageStore 写入新数据
- **THEN** 数据持久化到 localStorage，使用相同的 persist key

### Requirement: 拆分后测试保持通过
拆分后的 store 模块 SHALL 通过所有现有测试。

#### Scenario: chatStore 测试通过
- **WHEN** 运行 `chatStore.test.ts` 测试套件
- **THEN** 所有测试用例通过，断言的 store 行为与拆分前一致
