"""Item Response Theory (IRT) 3PL untuk bank soal & penilaian.

Model 3 Parameter Logistik (3PL) — standar penilaian masuk kampus (UTBK/SNBT)
dan ujian sekolah berbasis IRT:

    P(theta) = c + (1 - c) / (1 + exp(-a * (theta - b)))

Parameter butir:
- a (daya pembeda / discrimination)
- b (tingkat kesulitan / difficulty)      -> makin besar = makin sulit
- c (tebakan / pseudo-guessing)

Kalibrasi parameter dilakukan otomatis dari data respons peserta (classical
item analysis -> mapping ke metrik IRT). Estimasi kemampuan peserta (theta)
memakai metode EAP (Expected A Posteriori) dengan prior N(0,1) yang stabil
untuk pola jawaban ekstrem (semua benar / semua salah).
"""
import math
from statistics import NormalDist

_N = NormalDist()

# Grid theta untuk EAP & Test Information Function
THETA_GRID = [round(-4.0 + 0.1 * i, 2) for i in range(81)]  # -4.0 .. 4.0
_PRIOR = [_N.pdf(t) for t in THETA_GRID]

# Pemetaan label manual -> nilai b nominal (dipakai bila butir belum dikalibrasi)
LABEL_B = {"mudah": -1.0, "sedang": 0.0, "sulit": 1.0}
DIFFICULTY_LABELS = ("mudah", "sedang", "sulit")

# Target komposisi IRT yang disarankan untuk sebuah paket Try Out
TARGET_DISTRIBUTION = {"mudah": 0.30, "sedang": 0.40, "sulit": 0.30}


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def prob_correct(theta, a, b, c):
    """Probabilitas menjawab benar menurut model 3PL."""
    try:
        z = -a * (theta - b)
        z = _clamp(z, -35.0, 35.0)
        return c + (1.0 - c) / (1.0 + math.exp(z))
    except OverflowError:
        return c


def item_information(theta, a, b, c):
    """Informasi butir (Fisher information) pada kemampuan theta (3PL)."""
    p = prob_correct(theta, a, b, c)
    p = _clamp(p, 1e-6, 1 - 1e-6)
    q = 1.0 - p
    denom = (1.0 - c) ** 2 * p
    if denom <= 0:
        return 0.0
    return (a ** 2) * q * ((p - c) ** 2) / denom


def label_from_b(b):
    """Label kesulitan dari parameter b IRT."""
    if b is None:
        return "sedang"
    if b < -0.5:
        return "mudah"
    if b > 0.5:
        return "sulit"
    return "sedang"


def guessing_for(qtype, n_options):
    """Perkiraan tebakan (c) berdasar tipe & jumlah opsi."""
    if qtype in ("single", "multiple"):
        n = max(int(n_options or 4), 2)
        return round(min(1.0 / n, 0.35), 3)
    if qtype == "truefalse":
        return 0.5
    if qtype == "truefalse_multi":
        return round(0.5 ** max(int(n_options or 1), 1), 3)
    return 0.0  # essay


def b_from_pvalue(p):
    """Konversi proporsi benar (p-value klasik) -> tingkat kesulitan b."""
    p = _clamp(p, 0.02, 0.98)
    return _clamp(-_N.inv_cdf(p), -3.0, 3.0)


def a_from_point_biserial(r):
    """Konversi korelasi point-biserial -> daya pembeda a (metrik logistik)."""
    r = _clamp(r, -0.95, 0.95)
    denom = math.sqrt(max(1.0 - r * r, 1e-3))
    a = 1.702 * (r / denom)
    return round(_clamp(a, 0.2, 2.5), 3)


def item_params(q):
    """(a, b, c, calibrated) untuk sebuah dokumen soal.

    Gunakan parameter hasil kalibrasi bila ada; jika belum, pakai nilai nominal
    dari label manual admin (mudah/sedang/sulit) agar TIF & skor tetap jalan.
    """
    if q.get("irt_calibrated") and q.get("irt_b") is not None:
        return (
            float(q.get("irt_a") or 1.0),
            float(q.get("irt_b")),
            float(q.get("irt_c") or 0.0),
            True,
        )
    label = (q.get("difficulty_label") or "sedang").lower()
    if label not in LABEL_B:
        label = "sedang"
    b = LABEL_B[label]
    c = guessing_for(q.get("type"), len(q.get("options") or []))
    return (1.0, b, c, False)


def effective_label(q):
    """Label kesulitan efektif: hasil kalibrasi > label manual > 'sedang'."""
    if q.get("irt_calibrated") and q.get("irt_b") is not None:
        return label_from_b(q.get("irt_b"))
    return (q.get("difficulty_label") or "sedang").lower()


# ---------------------------------------------------------------------------
# Kalibrasi parameter butir dari data attempt
# ---------------------------------------------------------------------------
def calibrate(questions, attempts):
    """Hitung parameter IRT tiap butir dari attempt tersubmit.

    Return dict {question_id: {irt_a, irt_b, irt_c, p_value, point_biserial,
    response_count, irt_calibrated, irt_difficulty_label}}.
    Butir dengan responden < 5 tidak dikalibrasi (data belum cukup).
    """
    qmap = {q["id"]: q for q in questions}

    # total skor mentah (jumlah benar) per attempt + respons per butir
    totals = []           # total benar per attempt
    per_item = {}         # qid -> list[(correct(0/1), total_index)]
    for a in attempts:
        pq = a.get("per_question") or []
        correct_flags = {p.get("question_id"): (1 if p.get("correct") else 0)
                         for p in pq if p.get("question_id")}
        total = sum(correct_flags.values())
        idx = len(totals)
        totals.append(total)
        for qid, flag in correct_flags.items():
            per_item.setdefault(qid, []).append((flag, idx))

    results = {}
    MIN_RESP = 5
    for qid, rows in per_item.items():
        q = qmap.get(qid)
        if not q:
            continue
        n = len(rows)
        corrects = [r[0] for r in rows]
        p_value = sum(corrects) / n if n else 0.0

        if n < MIN_RESP:
            results[qid] = {"response_count": n, "p_value": round(p_value, 3),
                            "irt_calibrated": False}
            continue

        # point-biserial: total skor pembanding (koreksi: kurangi butir ini)
        tot_sub = [totals[r[1]] - r[0] for r in rows]
        mean_tot = sum(tot_sub) / n
        var = sum((t - mean_tot) ** 2 for t in tot_sub) / n
        sd = math.sqrt(var) if var > 0 else 0.0
        ones = [tot_sub[i] for i in range(n) if corrects[i] == 1]
        zeros = [tot_sub[i] for i in range(n) if corrects[i] == 0]
        if sd > 0 and ones and zeros:
            m1 = sum(ones) / len(ones)
            m0 = sum(zeros) / len(zeros)
            p = len(ones) / n
            r_pb = (m1 - m0) / sd * math.sqrt(p * (1 - p))
        else:
            r_pb = 0.3  # default moderat

        a = a_from_point_biserial(r_pb)
        c = guessing_for(q.get("type"), len(q.get("options") or []))
        # koreksi p-value untuk tebakan sebelum mapping ke b
        p_adj = (p_value - c) / (1 - c) if (1 - c) > 0 else p_value
        b = b_from_pvalue(p_adj)
        results[qid] = {
            "irt_a": a,
            "irt_b": round(b, 3),
            "irt_c": c,
            "p_value": round(p_value, 3),
            "point_biserial": round(r_pb, 3),
            "response_count": n,
            "irt_calibrated": True,
            "irt_difficulty_label": label_from_b(b),
        }
    return results


# ---------------------------------------------------------------------------
# Estimasi kemampuan peserta (theta) — EAP
# ---------------------------------------------------------------------------
def estimate_theta(items):
    """items: list of (a, b, c, response 0/1). Return (theta, se)."""
    items = [it for it in items if it is not None]
    if not items:
        return None, None
    posterior = list(_PRIOR)
    for gi, theta in enumerate(THETA_GRID):
        ll = 0.0
        for (a, b, c, resp) in items:
            p = _clamp(prob_correct(theta, a, b, c), 1e-6, 1 - 1e-6)
            ll += math.log(p) if resp == 1 else math.log(1 - p)
        posterior[gi] *= math.exp(_clamp(ll, -700, 700))
    s = sum(posterior)
    if s <= 0:
        return 0.0, None
    posterior = [w / s for w in posterior]
    theta = sum(t * w for t, w in zip(THETA_GRID, posterior))
    var = sum(((t - theta) ** 2) * w for t, w in zip(THETA_GRID, posterior))
    return round(theta, 3), round(math.sqrt(max(var, 0)), 3)


# ---------------------------------------------------------------------------
# Skala skor IRT (dipilih per Try Out oleh admin)
# ---------------------------------------------------------------------------
SCALE_PRESETS = {
    "snbt": {
        "key": "snbt", "label": "SNBT (0–1000)", "short": "SNBT",
        "min": 0, "max": 1000, "mean": 500, "sd": 100, "show_irt": True,
        "desc": "Skala UTBK-SNBT: rata-rata 500, simpangan 100, rentang 0–1000.",
    },
    "tka": {
        "key": "tka", "label": "TKA SMA (200–700)", "short": "TKA",
        "min": 200, "max": 700, "mean": 450, "sd": 83, "show_irt": True,
        "desc": "Skala Tes Kemampuan Akademik SMA: rentang 200–700 (rata-rata 450).",
    },
    "raw": {
        "key": "raw", "label": "SD/SMP — Nilai Asli (1–100)", "short": "Nilai Asli",
        "min": 1, "max": 100, "mean": 50, "sd": 17, "show_irt": False,
        "desc": "Untuk SD/SMP hanya nilai asli (% benar) yang ditampilkan; skor IRT & θ disembunyikan.",
    },
    "custom": {
        "key": "custom", "label": "Kustom", "short": "Kustom",
        "min": 0, "max": 1000, "mean": 500, "sd": 100, "show_irt": True,
        "desc": "Tentukan sendiri nilai minimum, maksimum, rata-rata, dan simpangan baku.",
    },
}
DEFAULT_SCALE = "snbt"


def validate_custom_scale(custom):
    """Normalisasi & validasi skala kustom {min,max,mean,sd}. Return (dict, error)."""
    try:
        mn = float(custom.get("min"))
        mx = float(custom.get("max"))
    except Exception:
        return None, "Nilai minimum/maksimum skala kustom wajib angka"
    if mx <= mn:
        return None, "Nilai maksimum harus lebih besar dari minimum"
    mean = custom.get("mean")
    sd = custom.get("sd")
    try:
        mean = float(mean) if mean not in (None, "") else (mn + mx) / 2
        sd = float(sd) if sd not in (None, "") else (mx - mn) / 6
    except Exception:
        return None, "Rata-rata/simpangan baku skala kustom wajib angka"
    if not (mn <= mean <= mx):
        return None, "Rata-rata harus berada di antara minimum dan maksimum"
    if sd <= 0:
        return None, "Simpangan baku harus lebih besar dari 0"
    return {"min": mn, "max": mx, "mean": mean, "sd": sd}, None


def resolve_scale(tryout):
    """Skala efektif sebuah Try Out (preset atau kustom)."""
    key = (tryout or {}).get("irt_scale") or DEFAULT_SCALE
    if key not in SCALE_PRESETS:
        key = DEFAULT_SCALE
    scale = dict(SCALE_PRESETS[key])
    if key == "custom":
        custom, err = validate_custom_scale((tryout or {}).get("irt_scale_custom") or {})
        if custom:
            scale.update(custom)
            scale["label"] = f"Kustom ({int(custom['min'])}–{int(custom['max'])})"
    return scale


def scaled_score(theta, scale=None):
    """Petakan theta -> skor skala IRT sesuai skala Try Out (default SNBT 0–1000)."""
    if theta is None:
        return None
    s = scale or SCALE_PRESETS[DEFAULT_SCALE]
    if not s.get("show_irt", True):
        return None
    return int(round(_clamp(s["mean"] + theta * s["sd"], s["min"], s["max"])))


def score_attempt(questions, per_question, scale=None):
    """Hitung theta & skor IRT untuk satu attempt dari per_question hasil grading."""
    s = scale or SCALE_PRESETS[DEFAULT_SCALE]
    if not s.get("show_irt", True):
        return {"theta": None, "theta_se": None, "irt_scaled": None, "irt_raw": None,
                "irt_scale": s["key"], "irt_scale_label": s["label"]}
    qmap = {q["id"]: q for q in questions}
    items = []
    for pq in (per_question or []):
        q = qmap.get(pq.get("question_id"))
        if not q:
            continue
        a, b, c, _cal = item_params(q)
        resp = 1 if pq.get("correct") else 0
        items.append((a, b, c, resp))
    theta, se = estimate_theta(items)
    raw = scaled_score(theta, s)
    return {"theta": theta, "theta_se": se, "irt_scaled": raw, "irt_raw": raw,
            "irt_scale": s["key"], "irt_scale_label": s["label"]}


# ---------------------------------------------------------------------------
# Blueprint / rekomendasi komposisi soal untuk pembuatan Try Out
# ---------------------------------------------------------------------------
def build_blueprint(questions):
    total = len(questions)
    comp = {"mudah": 0, "sedang": 0, "sulit": 0}
    calibrated = 0
    for q in questions:
        comp[effective_label(q)] = comp.get(effective_label(q), 0) + 1
        if q.get("irt_calibrated"):
            calibrated += 1

    target_counts = {k: round(total * v) for k, v in TARGET_DISTRIBUTION.items()}
    gaps = {}
    recommendations = []
    label_id = {"mudah": "Mudah", "sedang": "Sedang", "sulit": "Sulit"}
    for lvl in DIFFICULTY_LABELS:
        diff = target_counts[lvl] - comp[lvl]
        gaps[lvl] = diff
        if total == 0:
            continue
        if diff > 0:
            recommendations.append(
                f"Tambahkan {diff} soal tingkat {label_id[lvl]} untuk mencapai komposisi ideal "
                f"({int(TARGET_DISTRIBUTION[lvl]*100)}%)."
            )
        elif diff < 0:
            recommendations.append(
                f"Soal tingkat {label_id[lvl]} berlebih {abs(diff)} dari target "
                f"({int(TARGET_DISTRIBUTION[lvl]*100)}%); pertimbangkan mengganti dengan tingkat lain."
            )

    if total == 0:
        recommendations = ["Belum ada soal. Mulai tambahkan soal lalu tandai tingkat kesulitannya (Mudah/Sedang/Sulit)."]
    elif not gaps_any(gaps):
        recommendations.append("Komposisi tingkat kesulitan sudah ideal (±30% Mudah, 40% Sedang, 30% Sulit).")

    if total and calibrated < total:
        recommendations.append(
            f"{total - calibrated} soal belum terkalibrasi IRT dari data jawaban. "
            "Jalankan Kalibrasi IRT setelah ada hasil pengerjaan peserta untuk parameter yang akurat."
        )

    # Test Information Function (gabungan informasi semua butir pada tiap theta)
    tif = []
    peak = {"theta": 0.0, "info": 0.0}
    for theta in THETA_GRID:
        if round(theta * 10) % 5 != 0:  # sampel tiap 0.5 untuk grafik ringkas
            continue
        info = 0.0
        for q in questions:
            a, b, c, _cal = item_params(q)
            info += item_information(theta, a, b, c)
        tif.append({"theta": theta, "information": round(info, 3)})
        if info > peak["info"]:
            peak = {"theta": theta, "info": round(info, 3)}

    return {
        "total": total,
        "composition": comp,
        "composition_pct": {k: (round(v / total * 100) if total else 0) for k, v in comp.items()},
        "target_distribution": TARGET_DISTRIBUTION,
        "target_counts": target_counts,
        "gaps": gaps,
        "calibrated_count": calibrated,
        "uncalibrated_count": total - calibrated,
        "tif": tif,
        "tif_peak": peak,
        "recommendations": recommendations,
    }


def gaps_any(gaps):
    return any(abs(v) > 0 for v in gaps.values())


# ---------------------------------------------------------------------------
# Penyelarasan skor IRT dengan nilai asli (monoton, 0 = min skala, 100 = maks)
# ---------------------------------------------------------------------------
def align_scores(rows, scale):
    """rows: [(attempt_id, percentage, raw_irt)]. Return {attempt_id: aligned_irt}."""
    lo, hi = float(scale["min"]), float(scale["max"])
    groups = {}
    for aid, pct, raw in rows:
        if raw is None:
            continue
        groups.setdefault(round(float(pct or 0), 2), []).append((aid, float(raw)))
    keys = sorted(groups)
    if not keys:
        return {}

    def pin(p, v):
        return hi if p >= 100 else lo if p <= 0 else v

    blocks = []  # pool adjacent violators: [sum, weight, [group keys]]
    for p in keys:
        vals = [pin(p, v) for _, v in groups[p]]
        blocks.append([sum(vals), len(vals), [p]])
        while len(blocks) > 1 and blocks[-2][0] / blocks[-2][1] > blocks[-1][0] / blocks[-1][1]:
            s, w, g = blocks.pop()
            blocks[-1][0] += s
            blocks[-1][1] += w
            blocks[-1][2] += g
    level = {p: s / w for s, w, g in blocks for p in g}
    out = {}
    for i, p in enumerate(keys):
        lower = lo if i == 0 else (level[keys[i - 1]] + level[p]) / 2
        upper = hi if i == len(keys) - 1 else (level[p] + level[keys[i + 1]]) / 2
        for aid, raw in groups[p]:
            v = pin(p, min(max(raw, lower), upper))
            out[aid] = int(round(_clamp(v, lo, hi)))
    return out
