import xml.dom.minidom
import sys

files = [
    '/Volumes/무제/MacMini/Developer/.worktrees/yavn-story-arc/public/game-list/erase/assets/items/harin_slide_girl.svg',
    '/Volumes/무제/MacMini/Developer/.worktrees/yavn-story-arc/public/game-list/erase/assets/items/closed_eye_cut_bride.svg',
    '/Volumes/무제/MacMini/Developer/.worktrees/yavn-story-arc/public/game-list/erase/assets/items/ring_engraved.svg'
]

for f in files:
    try:
        xml.dom.minidom.parse(f)
        print(f"{f}: ok")
    except Exception as e:
        print(f"{f}: ERROR - {e}")
        sys.exit(1)

print("All files valid!")