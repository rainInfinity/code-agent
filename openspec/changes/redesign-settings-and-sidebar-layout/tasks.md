## 1. 窗口初始化闪烁修复

- [x] 1.1 在 `src-tauri/tauri.conf.json` 的窗口配置中添加 `"visible": false`
- [x] 1.2 在 `src-tauri/src/lib.rs` 的 `setup_window_state()` 末尾，恢复窗口状态后调用 `window.show().ok()`
- [ ] 1.3 构建验证：`cargo build` 确保编译通过，启动应用确认窗口无尺寸闪烁

## 2. 目录选择器依赖添加

- [x] 2.1 在 `src-tauri/Cargo.toml` 中添加 `tauri-plugin-dialog = "2"` 依赖
- [x] 2.2 运行 `npm install @tauri-apps/plugin-dialog` 安装前端包
- [x] 2.3 在 `src-tauri/capabilities/default.json` 中添加 `dialog:allow-open` 权限
- [x] 2.4 在 `src-tauri/src/lib.rs` 的 `tauri::Builder` 中添加 `.plugin(tauri_plugin_dialog::init())`

## 3. i18n 文案扩展

- [x] 3.1 在 `src/i18n/zh-CN.ts` 的 `settings` 对象中添加设置分类相关字段：
  - `sidebar`: 设置侧边栏分类标题（`{ general: '通用', api: 'API 配置' }`）
- [x] 3.2 在 `messages` 对象中添加 `modeToggle` 字段：`{ chat: '对话', code: '编程' }`
- [x] 3.3 在 `messages` 对象中添加 `workDir` 字段扩展：`{ browse: '浏览', addHint: '请先添加项目目录' }`
- [x] 3.4 在 `messages` 对象中添加 `modeToggle` 扩展：`{ confirmSwitchWhenStreaming: '切换模式将中断当前响应，确定要切换吗？' }`

## 4. 设置弹窗重构为侧边栏布局

- [x] 4.1 在 `SettingsModal.tsx` 中新增状态 `activeSection: 'general' | 'api'`，并添加左侧分类导航 UI（仅两个分类）
- [x] 4.2 创建 `GeneralSection`：包含主题切换（深色/浅色按钮）
- [x] 4.3 创建 `ApiSection`：将提供商选择、API Key、端点、模型下拉、刷新按钮合并在此 section
- [x] 4.4 调整弹窗宽度 660px，固定高度 480px，移除顶部标题栏（标题 + 关闭按钮）
- [x] 4.5 关闭按钮移至底部 footer，与取消/保存按钮同排
- [x] 4.6 侧边栏导航高度占满弹窗内容区（顶部无标题栏间隙）
- [x] 4.7 移除工作模式切换（`ModeToggleGroup`）和工作目录管理（`WorkDirInputRow`、`WorkDirList`）相关代码
- [x] 4.8 移除不再需要的 import（`FaComments`、`FaCode`、`FaFolder`、`FaFolderOpen`、`FaTrashCan` 等设置中不再使用的图标）

## 5. 侧边栏模式切换和工作目录

- [x] 5.1 在 `Sidebar.tsx` 顶部添加分段控件 `ModeSegmentedControl`，读取/写入 `settingsStore.agentMode`
- [x] 5.2 实现模式切换确认逻辑：当 `chatStore.isStreaming` 为 true 时切换模式，弹出 `window.confirm()` 确认对话框
- [x] 5.3 增强现有 `WorkDirSelector` 区域：添加浏览按钮，点击调用 `@tauri-apps/plugin-dialog` 的 `open()` 选择目录（纯浏览，无手动输入）
- [x] 5.4 实现目录浏览后通过 `settingsStore.addWorkingDirectory()` 添加到列表，并自动选中
- [x] 5.5 调整 `WorkDirSelector` 逻辑：无工作目录时显示提示和浏览按钮，"新建聊天"按钮禁用
- [x] 5.6 对话模式下隐藏 `ModeIndicator`、`WorkDirSelector` 和 `NoWorkDirHint`

## 6. 验证和清理

- [ ] 6.1 运行 `npm run tauri dev` 验证窗口启动无闪烁
- [ ] 6.2 验证设置弹窗两个分类导航切换正常，弹窗固定高度 480px，无标题栏，侧边栏全高，保存后所有设置生效
- [ ] 6.3 验证侧边栏分段控件切换对话/编程模式正常，侧边栏内容随之变化
- [ ] 6.4 验证编程模式下浏览添加项目目录、下拉选择、会话过滤均正常
- [ ] 6.5 验证工作模式在刷新/重启后正确恢复
- [ ] 6.6 验证流式响应进行中切换模式时弹出确认对话框，取消后保持当前状态，确认后中断并切换
