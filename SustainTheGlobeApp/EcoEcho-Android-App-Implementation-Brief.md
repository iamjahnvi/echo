# EcoEcho Android App --- Implementation Brief and Coding-Agent Prompt

## Purpose

Turn the current one-screen native Android prototype into a complete,
connected-feeling **EcoEcho** app flow. Use the six supplied reference
screens as inspiration for the information architecture and navigation,
but **do not copy their visual design**. Keep the existing
EcoEcho/SustainTheGlobe natural, editorial visual identity defined in
`SustainTheGlobe-Website-CODE.md`.

The current Android app is a Jetpack Compose project. Work in the
existing project; do not create a new app or rewrite it in React
Native/Flutter.

## Important constraints

-   Rename all visible app branding from **SustainTheGlobe** to
    **EcoEcho**: app title/header and any relevant Android app
    label/configuration.
-   **No sign-in, no sign-up, no login screen, and no authentication
    gate.** Launch directly into the main app.
-   Preserve the existing palette from
    `SustainTheGlobe-Website-CODE.md`. Do not introduce the bright
    green/pink/purple look from the reference images.
-   Do not copy the screenshots pixel-for-pixel. They describe the
    desired screen flow and feature ideas, not the visual styling.
-   Keep the current one-screen prototype as the starting point and
    expand it into a proper multi-screen app.
-   Keep the project native Android with Kotlin and Jetpack Compose.
-   Avoid adding dependencies unless truly necessary.
-   Do not claim backend integration exists if it does not. Keep state
    local for this implementation unless the repository already has a
    working backend/API integration. Make the data layer easy to connect
    later.
-   Preserve existing build configuration and unrelated files. Do not
    overwrite the website source or modify its design.
-   Keep UI readable on a small Android phone, scrollable where needed,
    and responsive to system insets.
-   Do not leave dead buttons: each visible action must navigate,
    select, submit, or show a useful message.

## Visual identity --- preserve exactly

Use the established muted natural palette from
`SustainTheGlobe-Website-CODE.md`:

-   Forest primary: `#244337`
-   Deep forest: `#1b3028`
-   Darkest forest: `#16261f`
-   Ivory page background: `#f5f3ea`
-   Cream secondary surface: `#efece1`
-   Mist subtle surface: `#d5dfd1`
-   Sage accent: `#a8b5a0`
-   Sand borders/dividers: `#e4e2d8`
-   Ink main text: `#1b201b`
-   Moss secondary text: `#4c574f`
-   Clay accents: `#f4e8db`, `#e9d5bd`, `#dcbd97`, `#cb9a63`, `#b67b4b`

Use editorial serif typography for major headings and a clear sans-serif
for body/UI text. Favor warm ivory backgrounds, deep forest primary
actions, restrained sage/mist surfaces, thin sand dividers, natural
imagery or simple nature-inspired iconography, and spacious layouts.
Keep contrast strong. Use rounded corners sparingly and consistently; do
not make every element a giant rounded card. Avoid gradients, neon
green, hot pink, purple, tiny text, and excessive card grids.

## Required screen flow

The app should launch straight into **Feed**. Add bottom navigation with
four destinations:

1.  **Feed**
2.  **My Tasks**
3.  **Leaderboard**
4.  **Profile**

The screen titled **Complete Task** opens from a task card and can have
a back arrow; it does not need to be a permanent bottom-nav item.

### 1. Feed

Purpose: browse community environmental actions and examples of
completed tasks.

Include: - Top app bar with EcoEcho branding/leaf mark. - Heading such
as "Feed" and short helper copy such as "Small actions. Shared
progress." - Optional simple filter chips such as Nearby / Community /
All, but do not add location permissions or location fields. - A
vertically scrolling list of activity posts. - Each post can show a task
photo, task title, short caption, points, and a heart/save action. -
Tapping a post opens its detail or the associated task completion
flow. - A clear route to My Tasks or a suitable "Explore tasks"
action. - Provide a polished empty state if there are no posts.

For the first version, use a small set of clearly labelled sample/demo
posts if no backend exists. Do not present demo data as real users'
verified activity.

### 2. My Tasks

Purpose: see and manage tasks assigned/available to the user.

Include: - Heading "My Tasks" and concise helper text. - Separate
sections for **Daily Tasks**, **Weekly Tasks**, and **Monthly Tasks**. -
Example tasks such as "Clean up litter", "Shop sustainably today", "Plan
a low-waste grocery list", and "Upgrade to LED bulbs". - Each task shows
its frequency, short description, and points. - A clear status for each
task: To do, Submitted, or Completed. - Tapping a task opens **Complete
Task**. - Completing/submitting a task must update its status in the
local app state so the change is reflected when returning to My Tasks. -
Avoid claiming points are officially awarded if there is no backend
validation.

### 3. Complete Task --- photo submission

This is a core feature.

Include: - Back arrow and task title. - Short instruction: "Add a photo
showing your action." - A large photo placeholder with an obvious **Add
photo** button. - Allow the user to choose a photo from the phone
gallery using the Android photo picker / Activity Result APIs, with
appropriate modern permission handling. Do not request broad storage
access unnecessarily. - Display the selected image preview with a
**Change photo** or **Remove photo** option. - Add an optional
caption/note field. - A **Submit task** button, disabled until a photo
is selected if the task requires proof. - On submit, validate the
selection, update local state to Submitted/Completed as appropriate, and
show a clear success confirmation. Return to My Tasks or provide a
button to do so. - Keep the chosen photo available in app state while
navigating during the session. Do not pretend it has uploaded to a
server; clearly keep the architecture ready for a future upload API. -
Handle cancellation, missing photo, and picker errors without crashing.

### 4. Leaderboard

Purpose: show community contribution rankings.

Include: - Heading "Leaderboard" and short description. - Simple filter
chips such as Weekly / All-time. - A restrained top-three treatment and
a readable ranked list below. - Each row can show avatar initials/icon,
display name, points, and completed task count. - Use clearly labelled
demo data until a real API is connected. Do not imply the list is live
or verified. - Keep colors consistent with the palette; no bright neon
styling.

### 5. Profile

Purpose: show a user's contribution summary without requiring an
account.

Include: - A simple illustrated avatar or initials; no account
sign-in. - Display name such as "EcoEcho Member" with a way to edit the
display name locally if feasible. - Summary metrics: total points, tasks
completed/submitted, and community contributions. - A "My activity" or
recent submissions section, including task photo thumbnails where
available. - Simple settings/help/about entry if useful. - Do not show
followers, authentication details, email address, or account-management
flows that require sign-in. - Explain locally that progress is stored on
this device if persistence is implemented; otherwise avoid promising
that it survives app restarts.

## Navigation and state behavior

-   Bottom navigation switches between Feed, My Tasks, Leaderboard, and
    Profile.
-   Selecting a task opens Complete Task.
-   Back navigation returns to the prior screen without unexpectedly
    resetting other state.
-   Selecting a photo shows its preview.
-   Submitting a task updates the task state and recent activity
    consistently across screens.
-   Like/save buttons visibly toggle state.
-   Filter chips visibly change the selected filter or filtered content.
-   Use a small, understandable state/data model rather than one huge
    composable.
-   Prefer separate composables/files for major screens and shared UI
    where that improves clarity, but do not over-engineer.
-   If persistence is straightforward with existing project setup, use
    local persistence; otherwise keep state in a simple repository/view
    model and explicitly document the limitation.

## Suggested model shape

Adapt to existing code rather than duplicating models unnecessarily.

-   `EcoTask`: id, title, description, frequency, points, status,
    optional photo URI, optional caption.
-   `FeedPost`: id, task title, caption, points, optional image
    reference, like state, demo flag.
-   `MemberSummary`: display name, total points, completed/submitted
    counts.
-   Task status should be explicit, for example `TODO`, `SUBMITTED`,
    `COMPLETED`.

Use sample content only where necessary, and mark it as sample/demo
content in code or UI. Do not award or calculate authoritative points on
the client as though a server confirmed them.

## Accessibility and quality

-   Use semantic labels/content descriptions for icon-only buttons.
-   Ensure touch targets are comfortably tappable.
-   Keep body text readable and maintain sufficient contrast.
-   Respect system font scaling and reduced-motion preferences where
    applicable.
-   Avoid horizontal overflow and clipped text on the Samsung Galaxy M06
    5G.
-   Add loading/empty/error states where they make sense.
-   Keep the source understandable for a student developer.

## Build and verification

After implementation: 1. Build using the project's existing Gradle
wrapper: `.\gradlew.bat :app:assembleDebug --console=plain` 2. Fix all
actual compile errors. Do not assume Android Studio red squiggles are
harmless without checking the build output. 3. Test navigation across
all four bottom tabs. 4. Test selecting a photo from the gallery,
previewing it, removing/changing it, and submitting a task. 5. Test that
task status and activity summaries update together. 6. Verify no
sign-in/sign-up screen appears. 7. Verify visible branding says EcoEcho.
8. Summarize what was implemented, which files changed, what is still
demo/local-only, and the build result.

------------------------------------------------------------------------

# Copy-paste prompt for the coding agent

You are working inside my existing native Android Studio project
`SustainTheGlobeApp` using Kotlin and Jetpack Compose. Read
`SustainTheGlobe-Website-CODE.md` first and follow its existing natural
palette and visual language exactly. Also use the six reference
screenshots I supplied only as inspiration for the app's flow: Feed, My
Tasks, Complete Task with photo upload, Leaderboard, and Profile. Do not
copy their styling or make the app look neon green/pink/purple.

Implement the full EcoEcho app flow in the existing project. Rename
visible branding from SustainTheGlobe to EcoEcho. There must be NO
sign-in, NO sign-up, and NO login screen; launch directly into Feed. Add
bottom navigation for Feed, My Tasks, Leaderboard, and Profile. Tapping
a task must open a Complete Task screen with an Add photo control that
opens the phone's photo picker, displays a selected image preview,
allows changing/removing the image, accepts an optional caption, and
submits the task only after a photo is selected. On submission, update
the task status and local recent-activity/profile summaries
consistently. Include sensible empty/error states. Use local/demo data
only if no working API exists, and do not pretend demo data or task
submissions have been verified by a backend.

Preserve the exact colors from the MD reference: forest primary
`#244337`, deep forest `#1b3028`, ivory `#f5f3ea`, cream `#efece1`, mist
`#d5dfd1`, sage `#a8b5a0`, sand `#e4e2d8`, ink `#1b201b`, moss
`#4c574f`, with the existing clay accents. Use editorial serif headings,
readable sans-serif UI text, warm backgrounds, restrained rounded
surfaces, strong contrast, and spacious layouts. Do not add unrelated
features, location permission, authentication, or unnecessary
dependencies. Keep the implementation beginner-readable and split major
screens into sensible composables/files without overengineering.

First inspect the current project and report a short plan, then
implement the complete flow. Preserve unrelated files and build
configuration. Afterward run
`.\gradlew.bat :app:assembleDebug --console=plain`, fix compile errors,
and report the build result and the exact files changed. Clearly state
which features are still local-only and not connected to a backend. Do
not stop after writing a plan; complete the implementation.
