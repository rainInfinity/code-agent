# chat-ui-layout Specification

## ADDED Requirements

### Requirement: Settings shall show when an API key is already configured

The Settings UI SHALL communicate that an API key is configured when the backend reports an existing key, without displaying the plaintext key.

#### Scenario: Open settings with an existing backend API key

- **GIVEN** the backend settings response reports `hasApiKey` as true
- **WHEN** the user opens the Settings modal
- **THEN** the API Key area shows a configured state
- **AND** the plaintext API key is not rendered in the input or elsewhere in the frontend
- **AND** the empty input does not imply that no key is configured

#### Scenario: Save settings without entering a replacement key

- **GIVEN** an API key is already configured
- **AND** the API Key input is empty
- **WHEN** the user saves Settings
- **THEN** the existing backend API key is preserved
- **AND** the UI continues to treat the API key as configured

#### Scenario: Replace an existing API key

- **GIVEN** an API key is already configured
- **WHEN** the user enters a non-empty API key value and saves Settings
- **THEN** the new key replaces the previous configured key
- **AND** the UI continues to show an API key configured state after save

### Requirement: Chat message avatar placement shall reflect message role

The chat message list SHALL render assistant avatars on the left and user avatars on the right.

#### Scenario: Render an assistant message

- **GIVEN** a message with role `assistant`
- **WHEN** the message appears in the chat list
- **THEN** the assistant avatar is displayed to the left of the assistant message content
- **AND** the message content remains within the readable message column

#### Scenario: Render a user message

- **GIVEN** a message with role `user`
- **WHEN** the message appears in the chat list
- **THEN** the user avatar is displayed to the right of the user message content
- **AND** the message content remains within the readable message column

### Requirement: Streaming assistant messages shall keep a stable content shell

The chat message list SHALL keep the same message row and content shell structure while an assistant response transitions from empty streaming state to rendered Markdown content.

#### Scenario: Assistant response starts with no content

- **GIVEN** an assistant message has status `streaming`
- **AND** its content is empty
- **WHEN** the message is rendered
- **THEN** the message row, avatar, role label, and body shell are present
- **AND** the thinking indicator is rendered inside the same body shell that will later contain response content

#### Scenario: First streamed token arrives

- **GIVEN** an assistant message has status `streaming`
- **AND** the thinking indicator is visible inside the message body shell
- **WHEN** the first content delta is appended
- **THEN** the message body remains in the same layout shell
- **AND** the content renders without replacing the surrounding row or content structure
- **AND** the layout does not visibly jump due to switching between unrelated component trees

#### Scenario: Streaming response completes

- **GIVEN** an assistant message has streamed content
- **WHEN** the message status changes from `streaming` to `complete`
- **THEN** the rendered content remains in the same message row and body shell
- **AND** completion does not introduce a padding, border, alignment, or width change

### Requirement: Sidebar conversation row hover shall not change row dimensions

Sidebar conversation rows SHALL maintain stable height and spacing across default, hover, active, and active-hover states.

#### Scenario: Hover a conversation row with a delete action

- **GIVEN** a conversation row is visible in the sidebar
- **WHEN** the user hovers the row
- **THEN** the delete action becomes available
- **AND** the row height remains unchanged
- **AND** the title text and icon do not shift vertically
- **AND** horizontal spacing remains stable except for intentional visibility of the reserved action slot

#### Scenario: Move pointer away from a conversation row

- **GIVEN** a conversation row delete action is visible on hover
- **WHEN** the pointer leaves the row
- **THEN** the delete action becomes hidden or inactive
- **AND** the row height and reserved layout space remain unchanged

### Requirement: Shared flex primitives shall be available for common responsive styled-components layouts

The frontend SHALL provide reusable styled-components flex primitives for common responsive layout patterns.

#### Scenario: Build a horizontal layout with shared primitives

- **GIVEN** a component needs a horizontal flex layout
- **WHEN** it uses the shared row primitive
- **THEN** it can configure alignment, justification, gap, wrapping, and sizing through transient props
- **AND** those custom props are not forwarded to the DOM

#### Scenario: Build a vertical layout with shared primitives

- **GIVEN** a component needs a vertical flex layout
- **WHEN** it uses the shared column primitive
- **THEN** it can configure alignment, justification, gap, wrapping, and sizing through transient props
- **AND** those custom props are not forwarded to the DOM

#### Scenario: Preserve direct styled-components for component-specific styling

- **GIVEN** a component has visual styling specific to its state or identity
- **WHEN** it uses shared flex primitives
- **THEN** the component may still extend or compose those primitives with local styled-components CSS
- **AND** the shared primitives do not require unrelated visual restyling

### Requirement: Affected UI components shall adopt shared flex primitives where practical

The Settings modal, chat message list, and sidebar conversation rows SHALL use shared flex primitives for common layout concerns where doing so improves consistency without broad unrelated refactoring.

#### Scenario: Migrate affected components

- **GIVEN** the shared flex primitives exist
- **WHEN** the affected Settings, MessageList, and Sidebar layouts are updated
- **THEN** repeated generic flex declarations are replaced by shared primitives where practical
- **AND** component-specific dimensions, colors, borders, and state styles remain local to the component
- **AND** unrelated components are not rewritten solely for style consistency
