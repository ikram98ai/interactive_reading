---
name: publish-video
description: Upload a chapter's recorded videos (lessons and long-form) to YouTube through Studio's web UI, or edit ones already uploaded (titles, descriptions, thumbnails, schedule, playlists). Run only when the user asks for it.
disable-model-invocation: true
---

# Publish a chapter's videos

This is step 9 of a chapter's videos. A video reaches this skill recorded and passing QA (the `record-video` skill).
Uploading is public and hard to undo, so only the user starts it. Read `books/<slug>/book.json` first: its `videos`
block names the outputs, their playlists and title formats, the schedule and the site.

| #   | Step        | Command                                                                         | Gate                                                                           |
| --- | ----------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 9   | **Publish** | `node tools/video/studio_upload.js videos/<book> --plan`, then without `--plan` | Every video is up, titled, described, captioned, scheduled and in its playlist |

**Judged and checked only.** Publish only a video narrated from a script that passes `judgement.py check`, never one
narrated with `--skip-judgement`, and only once its QA has no FAIL.

## Before uploading

- **Check what's already up.** Each uploaded video has a `<video>.youtube.json` record beside it, and the `videos/` git
  history keeps the records of everything ever uploaded. If a video for the same lesson or chapter is already up, ask
  the user whether to replace it (only safe while it's still scheduled, not public) or leave it, before uploading.
- **Run `--plan` first** and show the user what it would upload, with titles and publish times.

## Publishing on YouTube

- **YouTube Studio's web UI only, never the API.** `tools/video/studio_upload.js` drives Studio with Playwright in a
  persistent, signed-in Chrome profile, and uploads, titles, describes, captions and schedules each lesson in one pass.
  `--plan` prints what it would do and stops. `--edit` updates lessons already up instead (thumbnail, publish time).
  `--titles` updates the title and description of every video already up, lessons and long-form. Progress is written
  to each video's `<video>.youtube.json`, so a rerun resumes. It reads every chapter's `youtube-meta.json` and the
  long-form records, so those files must be present.
- **Long-form videos aren't uploaded by `studio_upload.js`**: it uploads lessons, and only retitles a long-form video
  that's already up. A long-form upload is done in Studio by hand, or with a new uploader path; ask the user which.
- **Two outputs, two playlists** (CLRS): each chapter's long-form video goes to `videos.long_form.playlist`
  ("Introduction to Algorithms"), titled by `videos.long_form.title` ("Chapter 1: The Role of Algorithms in Computing |
  Introduction to Algorithms"). Lessons go to `videos.lessons.playlist` ("Introduction to Algorithms with Rust"), titled
  by `videos.lessons.title` ("1.3 How to Sort a Vec in Rust: … | Introduction to Algorithms with Rust"). Other books
  declare their own, or none. Studio allows 100 characters in a title.
- **Titles and descriptions** for lessons are written per lesson in `videos/<book>/chNN/youtube-meta.json`. Each
  description links the chapter's page (`videos.site`) and the chapter's long-form video. A long-form description opens
  with `videos.long_form.intro`; `studio_upload.js --titles` rewrites only that first line, keeping the page link and
  chapter timestamps below it, and refuses if the text it reads doesn't link that chapter's page. Every video gets its `.srt`
  captions, "not made for kids", and its first frame (the title card) as its thumbnail.
- **The schedule** (`videos.schedule`, in the channel's time zone, Asia/Karachi): each chapter goes out within one week,
  with related lessons grouped on the same day; the groups live in `videos/<book>/schedule.json`. A day's lessons go out
  `gap_hours` apart from `first` (18:00, 20:00, 22:00); a day with more lessons starts earlier, so the last is out at
  `last` (22:00). The long-form video goes out the day after the chapter's last lesson, at `first`. Scheduling is done on
  YouTube, not by holding files back locally.
- **Limits:** Studio allows about 70 uploads in a rolling 24 hours ("Daily upload limit reached" in the dialog). Stop
  and resume later; the records make it safe.
- **Records:** commit each new or changed `<video>.youtube.json` in the `videos/` repo (`git -C videos commit`).

## After publishing

YouTube can't replace a published video's file; a re-upload gets a new URL and loses views and comments. To fix a mistake
in a published video, cut a self-contained sentence in Studio's editor (Content → the video → Editor → Trim & cut; it
keeps the URL, but can't be undone, so keep the local MP4), and check its captions afterwards. Use a pinned comment and a
line in the description for anything a cut can't fix. A video still scheduled and not yet public can simply be replaced.
