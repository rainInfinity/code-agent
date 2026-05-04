# sidebar-mode-workdir Specification

## ADDED Requirements

### Requirement: Sidebar shall have work mode segmented control

主界面侧边栏顶部 SHALL 包含一个两段分段控件，用于在对话模式和编程模式之间切换。

#### Scenario: Display mode toggle

- **WHEN** 侧边栏可见
- **THEN** 顶部显示分段控件，包含"对话"和"编程"两个选项
- **AND** 当前激活的模式对应的分段高亮
- **AND** 控件样式与应用主题一致

#### Scenario: Switch from chat mode to code mode

- **WHEN** 用户点击"编程"分段
- **THEN** `settingsStore.agentMode` 更新为 `'code'`
- **AND** 侧边栏中显示模式标识和项目目录选择器
- **AND** 会话列表过滤为当前选中项目目录下的会话
- **AND** 若无可用项目目录，显示提示"请先添加项目目录"

#### Scenario: Switch from code mode to chat mode

- **WHEN** 用户点击"对话"分段
- **THEN** `settingsStore.agentMode` 更新为 `'chat'`
- **AND** 侧边栏隐藏项目目录选择器和模式标识
- **AND** 会话列表显示全部会话

### Requirement: Code mode shall show work directory selector

编程模式下，侧边栏 SHALL 在分段控件下方显示项目目录下拉选择器和浏览添加按钮。

#### Scenario: Display work directory selector in code mode

- **WHEN** 当前处于编程模式
- **AND** 至少有一个已添加的工作目录
- **THEN** 侧边栏显示项目目录下拉选择器
- **AND** 下拉框列出所有已添加的工作目录（显示名称）
- **AND** 下拉框旁显示浏览添加按钮

#### Scenario: No work directories in code mode

- **WHEN** 当前处于编程模式
- **AND** 没有任何已添加的工作目录
- **THEN** 侧边栏显示项目目录选择区域
- **AND** 显示"请先添加项目目录"提示
- **AND** 显示浏览添加按钮
- **AND** "新建聊天"按钮禁用

#### Scenario: Select a different work directory

- **WHEN** 用户在项目目录下拉中选择另一个目录
- **THEN** 会话列表更新为该目录下的会话
- **AND** 若当前活跃会话不属于新目录，自动选中该目录下的第一个会话（或清空选中）

### Requirement: Browse and add work directory from sidebar

编程模式下，用户 SHALL 能够通过侧边栏的浏览按钮添加新的项目目录。

#### Scenario: Browse for a directory

- **WHEN** 用户点击侧边栏中的浏览按钮
- **THEN** 调用系统原生目录选择对话框
- **AND** 用户选择一个目录后，该目录添加到工作目录列表
- **AND** 新目录自动选中为当前工作目录
- **AND** 下拉框更新包含新目录

#### Scenario: Cancel directory browse

- **WHEN** 用户在系统目录选择对话框中取消
- **THEN** 工作目录列表不变
- **AND** 当前选中的目录不变

#### Scenario: Add duplicate directory

- **WHEN** 用户浏览选择了一个已在列表中的目录路径
- **THEN** 不重复添加
- **AND** 该目录自动选中
- **AND** 不显示错误提示

### Requirement: Mode switch shall persist

工作模式选择 SHALL 持久化保存，应用重启后恢复上一次的模式。

#### Scenario: Mode persists across app restart

- **WHEN** 用户选择编程模式后关闭应用
- **AND** 再次打开应用
- **THEN** 侧边栏显示编程模式为激活状态
- **AND** 显示项目目录选择器
- **AND** 若有已添加的工作目录，会话列表按目录过滤

### Requirement: Chat mode shall not show code mode UI

对话模式下，侧边栏 SHALL NOT 显示任何编程模式特有的 UI 元素。

#### Scenario: Chat mode sidebar

- **WHEN** 当前处于对话模式
- **THEN** 侧边栏不显示编码模式标识
- **AND** 侧边栏不显示项目目录选择器
- **AND** 侧边栏不显示"请先添加项目目录"提示
- **AND** "新建聊天"按钮在对话模式下始终可用

### Requirement: Mode switch shall confirm when streaming

当流式响应正在进行时切换工作模式，系统 SHALL 弹出确认对话框，提示用户切换模式将中断当前响应。

#### Scenario: Switch mode while streaming

- **WHEN** 用户点击分段控件切换工作模式
- **AND** 当前有流式响应正在进行中（`chatStore.isStreaming === true`）
- **THEN** 弹出确认对话框："切换模式将中断当前响应，确定要切换吗？"
- **AND** 用户点击取消则保持当前模式不变，响应继续
- **AND** 用户点击确认则中断流式响应并切换模式

#### Scenario: Switch mode while idle

- **WHEN** 用户点击分段控件切换工作模式
- **AND** 当前没有进行中的流式响应
- **THEN** 直接切换模式，不弹出确认对话框

### Requirement: Work directory shall only be added via browse dialog

项目目录 SHALL 仅通过系统原生目录选择器添加，不提供手动输入路径的方式。

#### Scenario: Add directory via browse button

- **WHEN** 用户点击侧边栏中的浏览按钮
- **THEN** 调用系统原生目录选择对话框
- **AND** 用户选择一个目录后，该目录添加到工作目录列表
- **AND** 侧边栏中不包含任何文本输入框用于输入路径
