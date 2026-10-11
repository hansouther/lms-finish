"""CBT flow on iPhone 14 emulation + desktop."""
import asyncio, os, json
from playwright.async_api import async_playwright

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

async def login(playwright, email, pw):
    req = await playwright.request.new_context()
    r = await req.post(f"{BASE}/api/auth/login", data=json.dumps({"email":email,"password":pw}), headers={"Content-Type":"application/json"})
    assert r.status==200, await r.text()
    return (await r.json())["access_token"]

async def run_cbt(playwright, vp, ua, is_mobile, label):
    print(f"\n=== CBT {label} {vp} ===")
    token = await login(playwright, "siswa@lms.id", "Siswa@12345")
    browser = await playwright.chromium.launch(headless=True)
    ctx = await browser.new_context(viewport=vp, user_agent=ua, is_mobile=is_mobile, has_touch=is_mobile)
    page = await ctx.new_page()
    page.on("console", lambda m: None)
    await page.add_init_script(f"window.localStorage.setItem('auth_access_token','{token}');")

    # 1) tryouts list
    await page.goto(BASE + "/student/tryouts", wait_until="domcontentloaded", timeout=40000)
    await page.wait_for_timeout(2500)
    sw = await page.evaluate("document.documentElement.scrollWidth")
    iw = await page.evaluate("window.innerWidth")
    print(f"  tryouts list sw={sw} iw={iw} overflow={sw-iw}")

    # 2) go to engine for to_3
    await page.goto(BASE + "/student/exam/to_3", wait_until="domcontentloaded", timeout=40000)
    await page.wait_for_timeout(3000)
    url = page.url
    print(f"  engine url: {url}")
    sw = await page.evaluate("document.documentElement.scrollWidth")
    iw = await page.evaluate("window.innerWidth")
    print(f"  engine sw={sw} iw={iw} overflow={sw-iw}")

    testids = await page.evaluate("""() => {
        const want = ['exam-fs-start','exam-start-button','m-prev-question','m-next-question','m-flag-question','m-open-palette','exam-font-plus','exam-font-minus','exam-timer','exam-submit'];
        const found = {};
        want.forEach(t => { found[t] = !!document.querySelector(`[data-testid=\"${t}\"]`); });
        return found;
    }""")
    print(f"  testids: {testids}")

    bodytext = await page.evaluate("document.body.innerText.slice(0,500)")
    print(f"  body(500): {bodytext!r}")

    # Try clicking fullscreen start button if present
    for sel in ['[data-testid="exam-fs-start"]', '[data-testid="exam-start-button"]']:
        if await page.locator(sel).count() > 0:
            try:
                await page.locator(sel).first.click(timeout=3000, force=True)
                print(f"  clicked {sel}")
                await page.wait_for_timeout(2000)
                break
            except Exception as e:
                print(f"  click {sel}: {e}")

    # After starting, check mobile nav
    testids2 = await page.evaluate("""() => {
        const want = ['m-prev-question','m-next-question','m-flag-question','m-open-palette','exam-timer','exam-submit','exam-font-plus'];
        const found = {};
        want.forEach(t => { found[t] = !!document.querySelector(`[data-testid=\"${t}\"]`); });
        return found;
    }""")
    print(f"  after-start testids: {testids2}")

    # If palette trigger present, try opening it
    if testids2.get("m-open-palette"):
        try:
            await page.locator('[data-testid="m-open-palette"]').click(timeout=3000, force=True)
            await page.wait_for_timeout(600)
            opened = await page.locator('[role="dialog"]').count()
            print(f"  palette sheet opened: {opened>0}")
        except Exception as e:
            print(f"  palette: {e}")

    sw = await page.evaluate("document.documentElement.scrollWidth")
    iw = await page.evaluate("window.innerWidth")
    print(f"  FINAL sw={sw} iw={iw} overflow={sw-iw}")

    await ctx.close()
    await browser.close()
    return {"label":label,"testids":testids,"after":testids2,"overflow":sw-iw}

async def main():
    results = []
    async with async_playwright() as p:
        results.append(await run_cbt(p,
            {"width":390,"height":844},
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
            True, "iphone14"))
        results.append(await run_cbt(p,
            {"width":1366,"height":768},
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            False, "desktop"))
    with open("/app/test_reports/cbt_mobile_results.json","w") as f:
        json.dump(results, f, indent=2, default=str)

if __name__=="__main__":
    asyncio.run(main())
