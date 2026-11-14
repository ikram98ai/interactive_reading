# Notes for agents

The process lives in skills (`.claude/skills/`); each book's differences live in `books/<slug>/book.json`.

- **build-chapter-page** — build or rebuild an interactive chapter page, `books/<slug>/chNN.html`.
- **write-video-script** — plan, scaffold and write a chapter's lesson and long-form scripts.
- **judge-video-script** — the truth check every script passes before narration. Run it as the `script-judge` agent
  (`.claude/agents/script-judge.md`), never in the context that wrote the script. `narrate.py` won't narrate a script
  without a passing, current verdict.
- **record-video** — narrate, record and QA a judged script into a finished video. All local.
- **publish-video** — upload to YouTube, or edit videos already up. Only when the user asks (`/publish-video`).

Always call a book by its real title (`book.json` `title`), never a made-up site name.

Never name another YouTube channel or course creator anywhere: narration, cards, titles, descriptions, code comments,
commit messages or repo docs. `narrate.py` lints for the names in `videos/never-say.txt` (local only).

Scripts never go to GitHub. `videos/` has its own git repo with no remote, so commit script changes there
(`git -C videos commit`). Never `git add -f` anything under `videos/` in the main repo, and never add a remote to the
`videos/` repo.
