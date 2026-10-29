#!/usr/bin/env python3
"""Compile and run every Rust listing on a chapter page, and check it prints what the page says it prints.

  python3 tools/rustcheck.py books/algo/ch01.html            all listings
  python3 tools/rustcheck.py books/algo/ch01.html rs-s4      just one (by block id)

A listing is a <script type="text/x-rust" id="rs-…"> block; the page shows its real output from the block
<script type="text/x-rust-out" id="rs-…-out">. Each listing must build with `rustc --edition 2021` without
warnings, run in under 10 s, and print exactly that output. Listings are kept readable in a narrow panel: no
line over 80 characters, no run of more than two // lines, and no comment longer than 90 characters. Needs rustc on PATH. Exit 1 on any problem."""
import html, pathlib, re, subprocess, sys, tempfile

BLOCK = re.compile(r'<script type="text/x-rust(-out)?" id="([^"]+)">\n?(.*?)</script>', re.S)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    page = pathlib.Path(sys.argv[1]).read_text()
    only = set(sys.argv[2:])
    progs, outs = {}, {}
    for m in BLOCK.finditer(page):
        (outs if m.group(1) else progs)[m.group(2)] = m.group(3).rstrip()
    bad = 0
    with tempfile.TemporaryDirectory() as tmp:
        for pid, code in progs.items():
            if only and pid not in only:
                continue
            problems = []
            run = 0
            for line in code.split("\n"):
                c = line.strip()
                run = run + 1 if c.startswith("//") else 0
                if run == 3:
                    problems.append(f"more than two comment lines in a row near: {c[:50]}")
                if len(line) > 80:
                    problems.append(f"line over 80 characters ({len(line)}): {line.strip()[:50]}…")
                k = line.find("//")
                if k >= 0 and len(line) - k > 90 and '"' not in line[:k]:
                    problems.append(f"comment longer than 90 characters: {line.strip()[:60]}…")
            src = pathlib.Path(tmp, pid.replace("-", "_") + ".rs")
            exe = src.with_suffix("")
            src.write_text(code + "\n")
            build = subprocess.run(["rustc", "--edition", "2021", "-o", str(exe), str(src)], capture_output=True, text=True)
            if build.returncode != 0:
                problems.append("does not compile:\n" + build.stderr.strip())
            else:
                if "warning" in build.stderr:
                    problems.append("compiler warnings:\n" + build.stderr.strip())
                try:
                    r = subprocess.run([str(exe)], capture_output=True, text=True, timeout=10)
                    got = r.stdout.rstrip()
                    if r.returncode != 0:
                        problems.append(f"exits with {r.returncode}:\n{r.stderr.strip()}")
                    want = outs.get(pid + "-out")
                    if want is None:
                        problems.append(f"no #{pid}-out block; it prints:\n{got}")
                    elif html.unescape(want) != got:
                        problems.append(f"prints something else than #{pid}-out.\n--- page says:\n{want}\n--- program prints:\n{got}")
                except subprocess.TimeoutExpired:
                    problems.append("still running after 10 s")
            print(("ok   " if not problems else "FAIL ") + pid + f"  ({len(code.splitlines())} lines)")
            for p in problems:
                print("     " + p.replace("\n", "\n     "))
            bad += bool(problems)
    print(f"{len(progs) if not only else len(only)} listing(s), {bad} with problems")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
