## Why

当前设置弹窗为单列滚动布局，随设置项增多将难以导航；窗口初始化时存在尺寸闪烁问题；工作模式切换和项目目录管理分散在设置与侧边栏两处，操作路径不一致。此变更一次性解决这三个用户体验问题。

## What Changes

- 修复窗口初始化闪烁：窗口创建时隐藏，恢复保存的尺寸后再显示，消除从默认尺寸跳变到保存尺寸的视觉闪烁
- 设置 UI 重构为侧边栏导航布局：左侧为分类导航（通用、API 配置），右侧为对应设置内容。API 配置和模型配置合并为一个分类，弹窗固定高度，无标题栏，侧边栏高度占满
- 工作模式切换从设置弹窗移至主界面侧边栏顶部，以分段控件形式提供对话/编程一键切换
- 项目目录管理从设置弹窗完全移至侧边栏：编程模式下在侧边栏直接浏览添加目录、下拉选择当前项目
- **BREAKING**：设置弹窗不再包含工作模式切换和工作目录管理，相关 UI 和数据流移至主界面侧边栏

## Capabilities

### New Capabilities

- `settings-sidebar-layout`: 设置弹窗的侧边栏导航布局，包含分类导航和按分类展示的设置内容
- `sidebar-mode-workdir`: 侧边栏中的工作模式切换和项目目录管理，支持分段控件切换对话/编程模式，编程模式下浏览添加和选择项目目录
- `window-init-optimization`: 窗口初始化优化，避免从默认尺寸到保存尺寸的视觉跳变

### Modified Capabilities

<!-- 现有 spec 的行为要求不变，仅实现方式变化 -->

## Impact

- `src-tauri/tauri.conf.json`: 窗口配置添加 `visible: false`
- `src-tauri/src/lib.rs`: `setup()` 中恢复窗口状态后调用 `show()`
- `src/components/common/SettingsModal.tsx`: 重构为侧边栏布局，移除工作模式和工作目录相关代码
- `src/components/Layout/Sidebar.tsx`: 添加模式切换控件、目录添加功能
- `src/i18n/zh-CN.ts`: 新增设置分类、模式切换、目录管理相关文案
- `src/stores/settingsStore.ts`: 状态逻辑基本不变，`workingDirectories` 和 `agentMode` 仍在此管理
