"""
Mobile responsiveness test for Binara LMS.
Tests multiple device profiles for horizontal overflow and basic nav
across all four role dashboards + public pages + CBT flow.
"""
import asyncio
import os
import json
from playwright.async_api import async_playwright

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://web-config-studio.preview.emergentagent.com").rstrip("/")

DEVICES = [
    # name, viewport, UA, is_mobile, has_touch
    ("iphone_se",      {"width": 320, "height": 568}, "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1", True, True),
    ("iphone_14",      {"width": 390, "height": 844}, "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1", True, True),
    ("android_360",    {"width": 360, "height": 800}, "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36", True, True),
    ("huawei_360",     {"width": 360, "height": 780}, "Mozilla/5.0 (Linux; Android 10; HUAWEI P40) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 HuaweiBrowser/14.0.0", True, True),
    ("ipad_portrait",  {"width": 820, "height": 1180}, "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1", True, True),
    ("iphone_land",    {"width": 844, "height": 390}, "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1", True, True),
    ("desktop_1366",   {"width": 1366, "height": 768}, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", False, False),
    ("desktop_1920",   {"width": 1920, "height": 1080}, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", False, False),
]

PUBLIC_PATHS = ["/", "/login", "/register", "/kursus", "/berita", "/kalender"]

ROLE_PATHS = {
    "admin": [
        "/admin", "/admin/news", "/admin/calendar", "/admin/courses",
        "/admin/schedule", "/admin/classes", "/admin/tryouts",
        "/admin/broadcasts", "/admin/partnerships", "/admin/users",
        "/admin/analysis", "/admin/payments", "/admin/site-settings",
    ],
    "siswa": [
        "/student", "/student/learning", "/student/courses",
        "/student/tryouts", "/student/schedule", "/student/payments",
    ],
    "tentor": [
        "/tutor", "/tutor/bidding", "/tutor/calendar",
        "/tutor/classes", "/tutor/materials",
    ],
    "proktor": [
        "/proctor", "/proctor/monitoring", "/proctor/analytics",
        "/proctor/trainings", "/proctor/attendance", "/proctor/weakness", "/proctor/reports",
    ],
}

CREDS = {
    "admin":  ("admin@lms.id",  "Admin@12345"),
    "siswa":  ("siswa@lms.id",  "Siswa@12345"),
    "tentor": ("tutor@lms.id",  "Tutor@12345"),
    "proktor":("proktor@lms.id","Proktor@12345"),
}


async def api_login(playwright, email, password):
    req = await playwright.request.new_context()
    r = await req.post(f"{BASE}/api/auth/login", data=json.dumps({"email": email, "password": password}), headers={"Content-Type":"application/json"})
    if r.status != 200:
        print(f"  LOGIN FAIL {email}: {r.status} {await r.text()}")
        return None
    j = await r.json()
    return j.get("access_token")


async def check_overflow(page, label, results):
    try:
        data = await page.evaluate("""() => ({
            sw: document.documentElement.scrollWidth,
            iw: window.innerWidth,
            bw: document.body ? document.body.scrollWidth : 0,
            url: location.pathname
        })""")
        over = data["sw"] - data["iw"]
        ok = over <= 2
        status = "OK" if ok else f"OVERFLOW +{over}px"
        results.append({"label": label, "status": status, **data})
        if not ok:
            print(f"  [X] {label} -> {status} sw={data['sw']} iw={data['iw']}")
            # find culprit elements
            culprits = await page.evaluate("""(iw) => {
                const bad = [];
                document.querySelectorAll('body *').forEach(el => {
                    const r = el.getBoundingClientRect();
                    if (r.right > iw + 2 && r.width < 2000) {
                        const id = el.getAttribute('data-testid') || '';
                        const cls = (el.className && typeof el.className === 'string') ? el.className.slice(0,80) : '';
                        bad.push({tag: el.tagName, id, cls, right: Math.round(r.right), w: Math.round(r.width)});
                    }
                });
                return bad.slice(0, 5);
            }""", data["iw"])
            print(f"      culprits: {culprits}")
            results[-1]["culprits"] = culprits
        else:
            print(f"  [v] {label} sw={data['sw']} iw={data['iw']}")
    except Exception as e:
        print(f"  [!] check_overflow {label}: {e}")
        results.append({"label": label, "status": f"ERROR {e}"})


async def test_device(playwright, device, summary):
    name, vp, ua, is_mobile, has_touch = device
    print(f"\n===== DEVICE {name} {vp} =====")
    browser = await playwright.chromium.launch(headless=True)
    results = []

    # ---- public pages (no auth)
    ctx = await browser.new_context(viewport=vp, user_agent=ua, is_mobile=is_mobile, has_touch=has_touch)
    page = await ctx.new_page()
    for path in PUBLIC_PATHS:
        try:
            await page.goto(BASE + path, wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(800)
            await check_overflow(page, f"public {path}", results)
        except Exception as e:
            print(f"  [!] public {path}: {e}")
            results.append({"label": f"public {path}", "status": f"ERROR {e}"})
    await ctx.close()

    # ---- role dashboards
    for role, paths in ROLE_PATHS.items():
        email, pw = CREDS[role]
        token = await api_login(playwright, email, pw)
        if not token:
            results.append({"label": f"{role} login", "status": "LOGIN_FAIL"})
            continue
        ctx = await browser.new_context(viewport=vp, user_agent=ua, is_mobile=is_mobile, has_touch=has_touch)
        page = await ctx.new_page()
        # Seed localStorage BEFORE loading app
        await page.add_init_script(f"""
            window.localStorage.setItem('auth_access_token','{token}');
            window.localStorage.setItem('auth_refresh_token','{token}');
        """)
        # Navigate to first role path to initialize auth
        try:
            await page.goto(BASE + paths[0], wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(1200)
        except Exception as e:
            print(f"  [!] {role} init {paths[0]}: {e}")

        for path in paths:
            try:
                await page.goto(BASE + path, wait_until="domcontentloaded", timeout=20000)
                await page.wait_for_timeout(900)
                await check_overflow(page, f"{role} {path}", results)
            except Exception as e:
                print(f"  [!] {role} {path}: {e}")
                results.append({"label": f"{role} {path}", "status": f"ERROR {e}"})

        # Mobile hamburger check on first dashboard page
        if is_mobile and vp["width"] < 768:
            try:
                await page.goto(BASE + paths[0], wait_until="domcontentloaded", timeout=20000)
                await page.wait_for_timeout(900)
                # Common mobile menu triggers
                btn = page.locator('[data-testid="mobile-menu-button"], [data-testid="mobile-sidebar-trigger"], button[aria-label*="menu" i]').first
                if await btn.count() > 0:
                    await btn.click(timeout=3000)
                    await page.wait_for_timeout(500)
                    opened = await page.locator('[role="dialog"], [data-state="open"]').count()
                    results.append({"label": f"{role} hamburger", "status": "OK" if opened else "NOT_OPENED"})
                    print(f"  hamburger {role}: {'OK' if opened else 'NOT_OPENED'}")
                else:
                    results.append({"label": f"{role} hamburger", "status": "TRIGGER_NOT_FOUND"})
                    print(f"  hamburger {role}: trigger not found")
            except Exception as e:
                results.append({"label": f"{role} hamburger", "status": f"ERROR {e}"})

        await ctx.close()

    # ---- input font-size check (touch -> 16px, desktop -> 14px typical)
    try:
        ctx = await browser.new_context(viewport=vp, user_agent=ua, is_mobile=is_mobile, has_touch=has_touch)
        page = await ctx.new_page()
        await page.goto(BASE + "/login", wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(600)
        fs = await page.evaluate("""() => {
            const el = document.querySelector('input[type=email], input[name=email], input');
            if (!el) return null;
            return parseFloat(getComputedStyle(el).fontSize);
        }""")
        if is_mobile:
            ok = fs is not None and fs >= 16
            results.append({"label":"input font-size (touch>=16px)","status":"OK" if ok else f"FAIL {fs}"})
            print(f"  touch input font-size={fs} -> {'OK' if ok else 'FAIL'}")
        else:
            results.append({"label":"input font-size (desktop)","status":f"{fs}"})
            print(f"  desktop input font-size={fs}")
        await ctx.close()
    except Exception as e:
        print(f"  [!] font-size check: {e}")

    summary[name] = results
    await browser.close()


async def test_cbt_mobile(playwright, summary):
    print("\n===== CBT FLOW on iPhone 14 =====")
    vp = {"width": 390, "height": 844}
    ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
    token = await api_login(playwright, *CREDS["siswa"])
    if not token:
        summary["cbt"] = [{"status":"LOGIN_FAIL"}]
        return
    browser = await playwright.chromium.launch(headless=True)
    ctx = await browser.new_context(viewport=vp, user_agent=ua, is_mobile=True, has_touch=True)
    page = await ctx.new_page()
    await page.add_init_script(f"window.localStorage.setItem('auth_access_token','{token}');")
    results = []
    try:
        await page.goto(BASE + "/student/tryouts", wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(1500)
        await check_overflow(page, "cbt /student/tryouts", results)
        # Try to find "Mulai" / "Kerjakan" button for Latihan Soal Campuran
        found = await page.evaluate("""() => {
            const nodes = Array.from(document.querySelectorAll('*'));
            const target = nodes.find(n => (n.textContent||'').includes('Latihan Soal Campuran'));
            return target ? target.outerHTML.slice(0,200) : null;
        }""")
        results.append({"label":"tryout_card_found","status": "YES" if found else "NO"})
        print(f"  tryout card found: {bool(found)}")
        # Attempt navigation to engine via to_3
        await page.goto(BASE + "/student/exam/to_3", wait_until="domcontentloaded", timeout=25000)
        await page.wait_for_timeout(2500)
        url = page.url
        print(f"  engine url: {url}")
        # Look for mobile nav testids
        testids = await page.evaluate("""() => {
            const want = ['m-prev-question','m-next-question','m-flag-question','m-open-palette','exam-start-button','exam-fs-start'];
            const found = {};
            want.forEach(t => { found[t] = !!document.querySelector(`[data-testid=\"${t}\"]`); });
            return found;
        }""")
        results.append({"label":"exam_mobile_testids","status":"CHECK","data":testids})
        print(f"  exam testids: {testids}")
        await check_overflow(page, "cbt engine", results)
    except Exception as e:
        print(f"  [!] CBT err: {e}")
        results.append({"status": f"ERROR {e}"})
    summary["cbt_iphone"] = results
    await ctx.close()
    await browser.close()


async def main():
    summary = {}
    async with async_playwright() as p:
        for d in DEVICES:
            await test_device(p, d, summary)
        await test_cbt_mobile(p, summary)
    with open("/app/test_reports/mobile_responsive_results.json","w") as f:
        json.dump(summary, f, indent=2, default=str)
    # Print overall overflow counts
    print("\n===== SUMMARY =====")
    for dev, rows in summary.items():
        bad = [r for r in rows if isinstance(r, dict) and str(r.get("status","")).startswith("OVERFLOW")]
        print(f"{dev}: {len(bad)} overflow / {len(rows)} checks")
        for b in bad[:5]:
            print(f"   - {b['label']} +{b['sw']-b['iw']}px")

if __name__ == "__main__":
    asyncio.run(main())
