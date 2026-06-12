# PomoTasks (光阴簿)

A zero-dependency personal productivity tool combining task management, Pomodoro timer, weekly calendar, and statistics — all in a single HTML file. Open and use. No install, no signup, no internet required.

## Features

### Task Management
- Nested parent/child tasks with drag-and-drop reorder and merge
- Progress tracking to 0.1% precision with live progress bars
- Categories: Important / Routine / Flexible (color-coded)
- DDL deadlines with auto status: overdue, today, tomorrow, upcoming
- Estimated effort in minutes, auto-rated (🟢 Light / 🟡 Medium / 🔴 Heavy)
- Actual time spent accumulated automatically from completed Pomodoros
- Sub-task weights auto-calculated from estimated minutes

### Pomodoro Timer
- Configurable work/break durations
- Wall-clock based timing — no drift when tab is backgrounded
- Pause / resume / early complete / suspend for later
- Post-session progress prompt, auto-updates task percentage

### Weekly Calendar
- 7-column week view with hourly timeline
- Time-block tasks and DDL markers (0 min = deadline pin)
- Overlapping tasks automatically split side-by-side
- Real-time "now" line indicator
- Inline editing: name, time, duration, category, notes

### Statistics
- Pomodoro count & focus time (today / week / month / custom range)
- Activity heatmap (7 days × 18 hours)
- Drill-down tree: month → week → day → hour
- Completion hall of fame

### System
- Data stored in browser localStorage
- Optional desktop JSON file (survives cache clear)
- Operation log exportable as Markdown
- JSON backup / restore

## Usage

Open `index.html` in any browser. All data stays local, nothing is uploaded anywhere.

## Tech

- Vanilla HTML / CSS / JavaScript
- Zero dependencies, no framework, no build step
- File System Access API (optional desktop storage)
- Web Audio API (completion chime)
- Notification API (scheduled task reminders)

## Project Structure

```
pomotasks/
├── index.html          # Main page: timer + task list
├── calendar.html       # Weekly calendar view
├── stats.html          # Statistics dashboard
├── done.html           # Hall of fame
├── style.css           # Shared styles
├── data.js             # Data layer: CRUD + storage
└── app.js              # UI layer: rendering + timer + interactions
```

## License

MIT
