"""Print the paper's numbers and LaTeX table rows straight from results/extended.json."""

import json
import sys
from pathlib import Path

R = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else "research/evidence_gating/results/extended.json").read_text())
E = R["experiments"]


def ms(s, k, pct=False):
    m, sd = s[k]["mean"], s[k]["sd"]
    return f"{100*m:.1f} $\\pm$ {100*sd:.1f}" if pct else f"{m:.3f} $\\pm$ {sd:.3f}"


def p(v):
    return "$<$0.001" if v < 0.001 else f"{v:.3f}"


main = E["main"]["rate=0.15"]
s = main["summary"]
print("% Main table (20 seeds)")
print("% meta", {k: round(v, 3) for k, v in main["meta"].items()})
for name in ["Random", "Popularity", "Content-only", "V1 (all logs)", "V3 ungated", "V3 gated, no shrinkage", "V3 evidence-gated"]:
    print(f"{name} & {ms(s[name],'ndcg10')} & {ms(s[name],'p5')} & {ms(s[name],'mrr')} & {ms(s[name],'manip10',True)} & {ms(s[name],'new10',True)} & {s[name]['gini']['mean']:.3f} \\\\")
print("% per attack (percent)")
for name in ["Random", "Popularity", "Content-only", "V1 (all logs)", "V3 ungated", "V3 gated, no shrinkage", "V3 evidence-gated"]:
    print(f"{name} & " + " & ".join(f"{100*s[name][k+'10']['mean']:.1f}" for k in ("stuffer", "inflator", "colluder")) + " \\\\")

for exp in ("main", "mature"):
    key = next(iter(E[exp]))
    print(f"% Tests: {exp} ({E[exp][key]['n_seeds']} seeds), V3 gated minus other")
    for t in E[exp][key]["tests"]:
        scale = 100 if t["metric"] in ("manip10", "new10") else 1
        print(f"{t['vs']:24} {t['metric']:8} diff {scale*t['diff']:+.3f} CI [{scale*t['ci95'][0]:+.3f},{scale*t['ci95'][1]:+.3f}] "
              f"t_holm {p(t['t_p_holm'])} wil_holm {p(t['wilcoxon_p_holm'])} W/L {t['wins']}/{t['losses']}")

ms_ = E["mature"]["history=4"]["summary"]
print("% Mature (history x4)")
for name in ["Content-only", "V1 (all logs)", "V3 ungated", "V3 gated, no shrinkage", "V3 evidence-gated"]:
    print(f"{name} & {ms(ms_[name],'ndcg10')} & {ms(ms_[name],'p5')} & {ms(ms_[name],'mrr')} & {ms(ms_[name],'manip10',True)} & {ms(ms_[name],'new10',True)} \\\\")

for exp in ("confirm", "collusion", "history"):
    print(f"% Sweep: {exp}")
    for setting, entry in E[exp].items():
        row = ", ".join(f"{n}: NDCG {v['ndcg10']['mean']:.3f} P5 {v['p5']['mean']:.3f} M {100*v['manip10']['mean']:.1f} C {100*v['colluder10']['mean']:.1f} N {100*v['new10']['mean']:.1f}"
                        for n, v in entry["summary"].items())
        print(f"{setting} (confirmed {entry['meta']['confirmed_share']:.2f}): {row}")
