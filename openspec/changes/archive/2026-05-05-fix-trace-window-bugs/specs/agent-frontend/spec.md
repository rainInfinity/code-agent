# agent-frontend Delta Specification

## ADDED Requirements

### Requirement: 应用入口路由 SHALL 根据窗口标识选择根组件

`main.tsx` 中的 `isTraceWindow()` 函数 SHALL 以 URL 查询参数 `window=trace` 为主判定依据，`getCurrentWebviewWindow().label` 为辅助判定，决定渲染 `<TraceApp />` 还是 `<App />`。

#### Scenario: Trace 窗口通过 URL 参数正确渲染

- **GIVEN** 当前 webview 的 URL 包含 `?window=trace`
- **WHEN** React 根组件挂载
- **THEN** 渲染 `<TraceApp />`（而非 `<App />`）
- **AND** 不加载主应用的 `Sidebar`、`TitleBar`（主窗口控件）、`ChatPanel` 等组件

#### Scenario: 主窗口正确渲染

- **GIVEN** 当前 webview 的 URL 不包含 `?window=trace` 且 `getCurrentWebviewWindow().label` 不等于 `'trace'`
- **WHEN** React 根组件挂载
- **THEN** 渲染 `<App />`（而非 `<TraceApp />`）

#### Scenario: IPC 不可用时的降级判定

- **GIVEN** `getCurrentWebviewWindow()` 抛出异常（如 IPC 未就绪）
- **WHEN** `isTraceWindow()` 执行
- **THEN** 捕获异常，回退到仅检查 URL 参数 `params.get('window') === 'trace'`
- **AND** 程序不崩溃，继续正常渲染
