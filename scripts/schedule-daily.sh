#!/bin/zsh
# Installs (or removes) a macOS launchd job that runs scripts/daily.sh every
# day at 06:00; a run missed while the Mac was asleep happens when it wakes.
#
#   ./scripts/schedule-daily.sh install
#   ./scripts/schedule-daily.sh uninstall
#
# macOS does not let background jobs read Desktop, Documents or Downloads, so
# keep the project somewhere else (e.g. ~/Projects) for the job to work.
set -eu
label="az.serfeli.daily-deals"
plist="$HOME/Library/LaunchAgents/$label.plist"
root="${0:A:h:h}"

case "${1:-}" in
  install)
    case "$root" in
      "$HOME/Desktop"*|"$HOME/Documents"*|"$HOME/Downloads"*)
        echo "The project is in $root, which macOS hides from background jobs. Move it (e.g. to ~/Projects) first." >&2
        exit 1 ;;
    esac
    cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>$root/scripts/daily.sh</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/tmp/$label.log</string>
  <key>StandardErrorPath</key><string>/tmp/$label.log</string>
</dict>
</plist>
PLIST
    launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$plist"
    echo "Scheduled: every day at 06:00. Logs: $root/logs/. Run now: launchctl kickstart gui/$(id -u)/$label" ;;
  uninstall)
    launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
    rm -f "$plist"
    echo "Removed." ;;
  *)
    echo "usage: $0 install|uninstall" >&2
    exit 2 ;;
esac
