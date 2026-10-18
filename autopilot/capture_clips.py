"""How the gameplay clips in autopilot/clips were captured (run on a box, not in CI).

python capture_clips.py hive ch2 40   # Hive Infiltration chapter two, 40 input steps
python capture_clips.py tell main 40  # Dystopia: The Waking
Records a 720x1280 headless Chromium session with Playwright while sending move, look and fire inputs.
Cut 4 to 8 second pieces with:
ffmpeg -ss START -t 8 -i page.webm -an -vf fps=30,scale=720:1280 -c:v libx264 -crf 27 -pix_fmt yuv420p clips/NAME.mp4
then list them under "clips" in library.json.
"""
import asyncio, sys, os, random
from playwright.async_api import async_playwright
URLS={"hive":"https://matpcul-tech.github.io/Dystopiabook1/","tell":"https://matpcul-tech.github.io/Dystopia/"}
async def main(k,mode,secs):
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"),args=["--autoplay-policy=no-user-gesture-required","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        ctx=await b.new_context(viewport={"width":720,"height":1280},record_video_dir=f"vid2_{k}_{mode}",record_video_size={"width":720,"height":1280})
        pg=await ctx.new_page(); r=random.Random(mode)
        await pg.goto(URLS[k],wait_until="networkidle",timeout=90000); await pg.wait_for_timeout(1500)
        if mode in ("ch2","ch3"):
            await pg.click("text=CHAPTER TWO" if mode=="ch2" else "text=CHAPTER THREE"); await pg.wait_for_timeout(1500)
        await pg.click("#startBtn")
        for _ in range(6):
            await pg.wait_for_timeout(1500)
            try: await pg.click("#skipBtn",timeout=500)
            except Exception: pass
        await pg.mouse.click(360,640)
        for t in range(secs):
            if t%6==0: await pg.screenshot(path=f"raw/{k}_{mode}_{t:03d}.png")
            await pg.keyboard.down("w")
            if r.random()<0.3: await pg.keyboard.down(r.choice("ad"))
            await pg.mouse.move(360+r.randint(-250,250),640+r.randint(-80,80),steps=8)
            if r.random()<0.5: await pg.mouse.click(360,640)
            if r.random()<0.3: await pg.keyboard.press("e")
            await pg.wait_for_timeout(700)
            for key in "ad": await pg.keyboard.up(key)
        await ctx.close(); await b.close()
asyncio.run(main(sys.argv[1],sys.argv[2],int(sys.argv[3])))
