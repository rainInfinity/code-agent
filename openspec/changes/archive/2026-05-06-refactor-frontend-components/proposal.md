## Why

当前前端代码在快速迭代中积累了技术债务：MessageList.tsx 膨胀至 1261 行并内联了 6+ 个子组件，所有类型定义挤在单个文件，FoldDivider 存在跨目录交叉引用，Store 职责混杂，styled-components 样式模板大量重复。这些问题降低了代码可维护性、可测试性和新成员上手效率。参照 web-component-design 最佳实践进行系统化重构，在不改变任何功能行为的前提下，提升代码质量和架构清晰度。

## What Changes

- **提取内联子组件** — 将 MessageList.tsx 中的 ThinkingPanel、ToolResultBlock、TurnSection、MessageBodyContent、MessageItem 提取为独立文件，使每个组件 ≤400 行
- **修复交叉引用** — 将 FoldDivider 从 `components/Chat/` 迁移至 `components/common/`，消除 Chat→Trace 跨目录引用
- **拆分类型定义** — 将 `types/index.ts`（325 行）按领域拆分为 `types/message.ts`、`types/trace.ts`、`types/settings.ts`、`types/provider.ts`，保留 `types/index.ts` 作为统一导出桶
- **引入 CVA 变体管理** — 为按钮、消息状态指示器等多态组件引入 `class-variance-authority`（cva），替代冗长的 `${({ theme, $tone }) => ...}` 模板
- **拆分 chatStore** — 将 Zustand chatStore 按职责拆分为 conversationStore、messageStore，原 chatStore 变为组合导出以保持 API 兼容
- **抽象样式辅助函数** — 提取重复的 theme 访问模式为 `styles/mixins.ts`（如 `focusRing`、`interactiveBg`、`statusColor`）
- **统一组件 API 语义** — 规范化布尔属性前缀（统一使用 `isDisabled`、`isLoading` 等语义化前缀）
- **建立复合组件模式** — 为 MessageList 相关组件建立 MessageList.Item、MessageList.ThinkingPanel 等 Compound Component 风格 API
- **安装新依赖** — 添加 `class-variance-authority` 包

## Capabilities

### New Capabilities

- `component-extraction`: 将 MessageList.tsx 中的内联子组件提取为独立、可复用、可独立测试的组件文件
- `type-domain-split`: 将单文件类型定义按业务领域拆分为多个模块
- `cva-style-variants`: 用 class-variance-authority 管理组件样式变体，减少 styled-components 模板重复
- `store-responsibility-split`: 将 chatStore 按单一职责原则拆分为 conversation、message 子 store
- `style-mixins`: 提取 theme 访问模式为共享 mixins/helper 函数

### Modified Capabilities

<!-- 纯重构，不改变任何 spec 级别的行为需求 -->

## Impact

- 受影响文件：`src/components/Chat/MessageList.tsx`（拆分）、`src/components/Chat/FoldDivider.tsx`（迁移）、`src/types/index.ts`（拆分）、`src/stores/chatStore.ts`（拆分）、`src/components/Trace/TracePanel.tsx`（更新 FoldDivider 导入路径）
- 新增依赖：`class-variance-authority`（约 3KB gzipped）
- 无 **BREAKING** 变更 — 所有导出保持向后兼容
- 所有现有测试需更新导入路径但断言不变
