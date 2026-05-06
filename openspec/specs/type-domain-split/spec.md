# type-domain-split Specification

## ADDED Requirements

### Requirement: 按领域拆分类型定义文件
`types/index.ts` 中的类型定义 SHALL 按业务领域拆分为多个模块文件：`message.ts`、`trace.ts`、`settings.ts`、`provider.ts`、`events.ts`、`store.ts`。

#### Scenario: 消息相关类型在独立文件中
- **WHEN** 开发者查找 Message、ContentBlock、MessageRole、MessageStatus 等消息相关类型
- **THEN** 这些类型定义在 `types/message.ts` 中

#### Scenario: 追踪相关类型在独立文件中
- **WHEN** 开发者查找 TurnTrace、ToolTrace、TraceState、TraceDockingState 等追踪相关类型
- **THEN** 这些类型定义在 `types/trace.ts` 中

#### Scenario: 设置相关类型在独立文件中
- **WHEN** 开发者查找 Settings、ProviderSettings、WorkDir 等设置相关类型
- **THEN** 这些类型定义在 `types/settings.ts` 中

#### Scenario: Provider 相关类型在独立文件中
- **WHEN** 开发者查找 ProviderId、ProviderDefinition 等 Provider 相关类型
- **THEN** 这些类型定义在 `types/provider.ts` 中

#### Scenario: 事件相关类型在独立文件中
- **WHEN** 开发者查找 StreamEvent、ToolTraceEvent、AgentCompleteEvent 等 IPC 事件类型
- **THEN** 这些类型定义在 `types/events.ts` 中

#### Scenario: Store 相关类型在独立文件中
- **WHEN** 开发者查找 ChatState、TraceState 等 store 接口类型
- **THEN** 这些类型定义在 `types/store.ts` 中

### Requirement: types/index.ts 保持统一导出
`types/index.ts` SHALL 保留作为统一导出桶，从各子模块 re-export 所有类型，确保现有导入路径不受影响。

#### Scenario: 从 @/types 导入类型
- **WHEN** 代码使用 `import { Message, TurnTrace } from '@/types'` 导入类型
- **THEN** 导入成功，类型定义来源透明，（Message 实际定义在 message.ts 中）

#### Scenario: TypeScript 编译通过
- **WHEN** 运行 `tsc --noEmit`
- **THEN** 无类型错误，所有类型引用解析正确
