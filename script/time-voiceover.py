"""Time VOICEOVER.md. Counts NARRATION blockquote blocks only.

A blockquote in this file is either narration or a note to the reader. The
previous two counts both got this wrong in different ways — one swallowed the
continuation lines of warning notes, one swallowed a whole note block inside
Scene B — so classification is explicit here rather than heuristic.
"""
import re, sys
NOTE = re.compile(r'^(⚠️|\*\*Optional|\*\*Say "we wrote|The caveat is not|Dokett returns facts)')
txt = open('docs/VOICEOVER.md').read()
txt = txt[txt.index('# PART ONE'):txt.index('## Timing')]
scene, cur, out = 'PART ONE', [], []
def flush():
    if cur: out.append((scene, ' '.join(x for x in cur if x)))
for line in txt.split('\n'):
    st = line.strip()
    if st.startswith('#'):
        flush(); cur.clear(); scene = st.lstrip('# ').strip(); continue
    if st.startswith('>'): cur.append(st[1:].strip())
    else: flush(); cur.clear()
flush()
tot_s = 0.0
for sc, body in out:
    if NOTE.match(body) or body.startswith('*['): continue
    beats = body.count('//')
    words = len(re.sub(r'[*_`\[\]]|\*\[spoken[^\]]*\]\*', '', body.replace('//', '')).split())
    secs = words / 150 * 60 + beats
    tot_s += secs
    print(f'  {sc[:44]:<46} {words:>4}w {beats}b   {int(secs//60)}:{int(secs%60):02d}')
print(f'\n  {"TOTAL":<46} {"":>9}   {int(tot_s//60)}:{int(tot_s%60):02d}    headroom {180-tot_s:.0f}s')
