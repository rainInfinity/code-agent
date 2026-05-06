## Context

当前前端采用 React 19 + TypeScript + styled-components v6 + Zustand v5 技术栈，代码按功能分目录（components/Chat/、components/Trace/、components/Layout/、components/common/）。随着功能迭代，部分文件膨胀、交叉引用、样式重复等问题逐渐显现。本次重构仅涉及代码组织层面，不改变任何功能行为。

## Goals / Non-Goals

**Goals:**
- 将 MessageList.tsx 中内联的 6 个子组件提取为独立文件，降低单文件复杂度
- 消除 FoldDivider 的跨目录交叉引用
- 按领域拆分类型定义，提升模块清晰度
- 引入 cva 统一管理样式变体，减少 styled-components 模板重复
- 按职责拆分 chatStore，提升可维护性
- 提取共享样式 mixins，消除 theme 访问重复代码
- 所有现有测试保持通过，导出 API 保持向后兼容

**Non-Goals:**
- 不改变任何功能行为或 UI 外观
- 不引入新的 CSS 方案（如 Tailwind、CSS Modules）
- 不重构 Trace/ 目录下的组件（仅修复 FoldDivider 导入路径）
- 不改变 IPC 通信层或 Rust 后端代码
- 不添加新功能

## Decisions

### 1. 组件提取策略：按文件边界而非 Compound Components

选择将子组件提取为独立文件（同一目录），而非立即使用 Compound Component 模式。原因：
- React.memo 覆盖了性能需求
- Compound Components 引入了额外 Context 开销
- 独立文件已足够解决可维护性问题
- 可以在后续按需引入 Compound 模式

**替代方案**：立即实施 Compound Components → 被否决，因为过度工程化当前阶段不必要。

### 2. cva vs 自定义变体方案

选择 `class-variance-authority` 而非自建变体工具。原因：
- 社区标准，3KB gzipped，零运行时
- 与 styled-components 配合使用（cva 生成 className，styled-components 负责基础样式）
- 自带 TypeScript 类型推导

**替代方案**：自建 `variants()` 工具函数 → 被否决，重复造轮子。

### 3. Store 拆分：保持组合导出

拆分 chatStore 但保持原 `useChatStore` 导出作为兼容层。新的子 store（conversationStore、messageStore）独立使用，但 chatStore 通过合并导出保持兼容。

### 4. 类型拆分：按领域而非按使用频率

选择 `message.ts`、`trace.ts`、`settings.ts`、`provider.ts` 的领域划分，而非 `common.ts` / `advanced.ts` 的使用频率划分。领域划分与功能模块一一对应，查找和维护更直观。

### 5. FoldDivider 迁移：common/ 而非 shared/

迁移至 `components/common/FoldDivider.tsx`，与现有 Flex.tsx、ApiConfigBanner.tsx 同级。`common/` 是现存约定，`shared/` 需要新建目录且增加认知负担。

### 6. 样式 Mixins：styled-components css 模板字面量

使用 styled-components 的 `css` helper 创建 mixins，而非普通函数。原因：
- `css` helper 是 styled-components 推荐的复用方式
- 保持在 styled-components 生态内
- 类型安全，可被 `styled()` 和 `css` 直接使用

## Risks / Trade-offs

- **导入路径变更** → 风险：可能遗漏某些导入更新。缓解：使用 TypeScript 编译器检查 + 全量测试运行
- **Store 拆分引入竞态** → 风险：拆分的 store 间同步可能出错。缓解：保持相同的 persist key 和 middleware 配置
- **cva 与 styled-components 混合使用增加样式定位难度** → 风险：样式分散在两处。缓解：约定 cva 仅用于变体（variant/size/tone），基础布局仍由 styled-components 管理
- **类型拆分可能导致循环引用** → 风险：领域类型文件间互相引用。缓解：保留 `types/index.ts` 作为统一导出桶，内部文件按依赖方向排列，必要时提取共享基础类型
