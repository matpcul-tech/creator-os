"""Upload one prepared video to YouTube (manual workflow). Inputs come from env, never from the shell.

VIDEO_URL, TITLE, DESCRIPTION, TAGS (comma separated), CATEGORY_ID, PRIVACY, plus the YT_* secrets.
Prints the video id and Shorts URL, and writes them to the job summary.
"""
import json, os, sys, urllib.request

def main():
    url = os.environ["VIDEO_URL"]
    path = "manual_upload.mp4"
    print("downloading", url)
    urllib.request.urlretrieve(url, path)
    size = os.path.getsize(path)
    if size < 100_000: sys.exit(f"downloaded file is too small ({size} bytes)")
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from run import upload  # same OAuth refresh and resumable upload as the autopilot
    title = os.environ["TITLE"].strip()[:100]
    desc = os.environ.get("DESCRIPTION", "").replace("\\n", "\n")[:4900]
    tags = [t.strip().lstrip("#") for t in os.environ.get("TAGS", "").split(",") if t.strip()]
    body = {"snippet": {"title": title, "description": desc, "tags": tags,
                        "categoryId": os.environ.get("CATEGORY_ID") or "1",
                        "defaultLanguage": "en", "defaultAudioLanguage": "en"},
            "status": {"privacyStatus": os.environ.get("PRIVACY") or "public", "selfDeclaredMadeForKids": False,
                       "containsSyntheticMedia": True, "embeddable": True, "license": "youtube"}}
    print(json.dumps(body, indent=2))
    vid = upload(path, body)
    line = f"Uploaded: https://youtube.com/shorts/{vid} (id {vid})"
    print(line)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        open(os.environ["GITHUB_STEP_SUMMARY"], "a").write(line + "\n")

if __name__ == "__main__":
    main()
