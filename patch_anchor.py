import sys

p = "blender/export_all.py"
s = open(p).read()

if "def anchor_match" in s:
    print("already patched")
    sys.exit(0)

func = r'''
def anchor_match(areas, districts, AT, DT, log):
    def fin(T):
        return T[np.isfinite(T).all(axis=(1, 2))]

    def wcen(T):
        T = fin(T)
        if not len(T):
            return np.array([np.nan, np.nan])
        a = 0.5 * np.abs((T[:, 1, 0] - T[:, 0, 0]) * (T[:, 2, 1] - T[:, 0, 1])
                         - (T[:, 2, 0] - T[:, 0, 0]) * (T[:, 1, 1] - T[:, 0, 1]))
        c = T.mean(1)
        if a.sum() <= 0:
            return c.mean(0)
        return (c * a[:, None]).sum(0) / a.sum()

    key = lambda t: re.sub(r"[^a-z]", "", t.lower())
    alias = {"coxsbazar": "coxbazar", "comillaadarsha": "comilla", "comillasadardakshin": "comilla"}
    dkey = {key(d["dist"]): i for i, d in enumerate(districts)}
    anchors = []
    for ai, a in enumerate(areas):
        m = re.match(r"^(.*?)[ _]Sadar", a["name"])
        if not m:
            continue
        k = key(m.group(1))
        k = alias.get(k, k)
        if k in dkey:
            anchors.append((ai, dkey[k]))
    src = np.array([wcen(AT[ai]) for ai, _ in anchors])
    dst = np.array([wcen(DT[di]) for _, di in anchors])
    good = np.isfinite(src).all(1) & np.isfinite(dst).all(1)
    log("  anchors (Sadar areas): %d usable of %d" % (good.sum(), len(anchors)))
    for _ in range(4):
        X = np.hstack([src[good], np.ones((good.sum(), 1))])
        M = np.linalg.lstsq(X, dst[good], rcond=None)[0]
        res = np.linalg.norm(np.hstack([src, np.ones((len(src), 1))]) @ M - dst, axis=1)
        thr = max(3 * np.median(res[good]), 1e-9)
        good = good & (res <= thr)
    span = np.ptp(dst[good], axis=0).max()
    log("  anchor fit: %d inliers, median residual %.4f of map span %.4f" % (good.sum(), np.median(res[good]), span))
    Qp, Ql = [], []
    for di, T in enumerate(DT):
        T = fin(T)
        c = T.mean(1) if len(T) else np.zeros((0, 2))
        Qp.append(c)
        Ql.append(np.full(len(c), di))
    Qp = np.vstack(Qp).astype(np.float64)
    Ql = np.concatenate(Ql)
    q2 = (Qp * Qp).sum(1)
    assign, purity = [], []
    anchor_map = dict(anchors)
    for ai, T in enumerate(AT):
        T = fin(T)
        if ai in anchor_map:
            assign.append(anchor_map[ai])
            purity.append(1.0)
            continue
        if not len(T):
            assign.append(0)
            purity.append(0.0)
            continue
        c = T.mean(1)
        c = c[np.linspace(0, len(c) - 1, min(len(c), 60)).astype(int)]
        w = np.hstack([c, np.ones((len(c), 1))]) @ M
        d = (w * w).sum(1)[:, None] + q2[None, :] - 2 * w @ Qp.T
        lab = Ql[d.argmin(1)]
        cnt = np.bincount(lab, minlength=len(DT))
        assign.append(int(cnt.argmax()))
        purity.append(cnt.max() / len(lab))
    return assign, purity

'''

marker = 'say("Aligning the area map with the district map...")'
assert marker in s, "marker not found"
s = s.replace(marker, func + marker, 1)

old = "assign, purity = match_areas("
assert old in s, "match_areas call not found"
s = s.replace(old, "assign, purity = anchor_match(areas, districts, ", 1)

# the call must pass triangle lists as AT, DT then log
open(p, "w").write(s)
print("patched")
