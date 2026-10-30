import urllib.request
import re
import json

url = "https://next-study-pw.ai.studio/assets/index-BpyZwWE0.js"
print("Fetching:", url)
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
content = urllib.request.urlopen(req).read().decode('utf-8', errors='ignore')
print(f"Loaded {len(content)} bytes")

with open("/tmp/bundle.js", "w") as f:
    f.write(content)

# Search URLs
urls = set(re.findall(r'https?://[^\s"\'`<>]+', content))
print("URLs found:")
for u in sorted(urls):
    if "w3.org" not in u and "react" not in u:
        print("  ", u)

# Search for API endpoints
apis = set(re.findall(r'["\'](/api/[^"\']+)["\']', content))
print("API endpoints found:")
for a in sorted(apis):
    print("  ", a)

# Search for localStorage keys
local_keys = set(re.findall(r'localStorage\.(?:getItem|setItem)\(["\']([^"\']+)["\']', content))
print("LocalStorage keys:", local_keys)
