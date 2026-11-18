#!/usr/bin/env python3
"""Generate real static product + category pages for Imran Games Officials.

Reads products.json (live Supabase export via ig.py list --json) and builds:
  products/<slug>.html   - one page per product (42)
  category/<slug>.html   - one page per category (11)
  styles.css             - the site's own stylesheet, extracted from index.html
Also updates sitemap.xml (real paths) and index.html (ItemList urls + footer links).
Re-run after any price/stock change: ig.py list --json > products.json && python3 build_pages.py
"""
import json, re, html, os
from collections import defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
SITE = "https://imrangamesofficials.vercel.app"
SHOP_NAME = "Imran Games Officials"
TODAY = "2026-11-18"

def esc(s):
    return html.escape(str(s), quote=True)

def fmt(n):
    return "Rs. %s" % format(int(n), ",")

def cat_slug(c):
    return c.lower().replace(" ", "-").replace("&", "and")

def cond_of(name):
    low = name.lower()
    if "pre-order" in low or "preorder" in low:
        return "Pre-order"
    if "used" in low:
        return "Used"
    return "New"

def avail_of(p):
    if cond_of(p["name"]) == "Pre-order":
        return "https://schema.org/PreOrder", "PreOrder"
    if p["stock"] <= 0:
        return "https://schema.org/OutOfStock", "OutOfStock"
    return "https://schema.org/InStock", "InStock"

def stock_line(p):
    if cond_of(p["name"]) == "Pre-order":
        return '<span class="stock in">● Pre-Order — reserve now</span>'
    if p["stock"] <= 0:
        return '<span class="stock" style="color:var(--red)">✖ Sold Out</span>'
    if p["stock"] <= 10:
        return '<span class="stock low">⚠ Only %d left</span>' % p["stock"]
    return '<span class="stock in">● In Stock</span>'

def badge(p):
    if p["stock"] <= 0 and cond_of(p["name"]) != "Pre-order":
        return '<span class="badge" style="background:#3A3F55">SOLD OUT</span>'
    if p.get("is_hot"):
        return '<span class="badge hot">🔥 Hot Selling</span>'
    if p.get("is_new"):
        return '<span class="badge" style="background:var(--blue);color:#04121C">🆕 NEW</span>'
    if cond_of(p["name"]) == "Used":
        return '<span class="badge" style="background:#5B4B8A">USED</span>'
    if p.get("was_price") and p["was_price"] > p["price"]:
        off = round((1 - p["price"] / p["was_price"]) * 100)
        return '<span class="badge">-%d%% OFF</span>' % off
    return ""

def wa_link(p):
    sub = p["price"]
    dele = 0 if sub >= 10000 else 350
    lines = ["New COD Order — Imran Games Officials", "",
             "- %s x 1 = %s" % (p["name"], fmt(sub)), "",
             "Subtotal: " + fmt(sub),
             "Delivery: " + ("FREE" if dele == 0 else fmt(dele)),
             "Total (Cash on Delivery): " + fmt(sub + dele), "",
             "My name: ", "Delivery address: "]
    from urllib.parse import quote
    return "https://wa.me/923322202220?text=" + quote("\n".join(lines))

def desc_of(p):
    cond = cond_of(p["name"])
    was = ""
    if p.get("was_price") and p["was_price"] > p["price"]:
        was = ", down from %s" % fmt(p["was_price"])
    if cond == "Pre-order":
        state = "available for pre-order"
    elif p["stock"] <= 0:
        state = "is currently sold out — message us on WhatsApp to ask about restock"
    else:
        state = "is in stock"
    d = ("%s (%s) %s at Imran Games Officials in Peshawar for %s%s. "
         "Cash on Delivery across Pakistan — delivery Rs. 350, free on orders above Rs. 10,000."
         % (p["name"], p["brand"], state, fmt(p["price"]), was))
    if p["slug"].startswith("1001-"):
        d += " GTA VI launches 19 November 2026 on PS5 and Xbox Series X|S."
    return d

# ---------- load ----------
products = json.load(open(os.path.join(BASE, "products.json")))
if isinstance(products, dict):
    products = products.get("products", [])
products.sort(key=lambda p: p["slug"])
cats = defaultdict(list)
for p in products:
    cats[p["category"]].append(p)

index_html = open(os.path.join(BASE, "index.html")).read()

# ---------- shared stylesheet ----------
m = re.search(r"<style[^>]*>(.*?)</style>", index_html, re.S)
assert m, "no <style> in index.html"
css = m.group(1)
open(os.path.join(BASE, "styles.css"), "w").write(css)
print("styles.css:", len(css), "bytes")

# ---------- shared header / footer (absolute links) ----------
header = """<header>
 <div class="wrap nav">
  <a class="logo" href="/"><img src="/logo-small.png" alt="Imran Games Officials logo" width="1088" height="585" decoding="async"/><span class="logotext"><b><span class="w1">IMRAN</span> <span class="w2">GAMES</span></b><small>Official Game Shop in Peshawar</small></span></a>
  <nav class="links"><a href="/">Home</a><a href="/#shop">Shop</a><a href="/#games">Games</a><a href="/#deals">Hot Deals</a><a href="/#discounts">Discounts</a><a href="/#reviews">Reviews</a><a href="/#faq">FAQs</a><a href="/#contact">Contact Us</a></nav>
  <div class="navright"><a class="addbtn blue" style="text-decoration:none" href="/#shop">🛒 Shop Now</a></div>
 </div>
</header>"""

fm = re.search(r"<footer.*?</footer>", index_html, re.S)
assert fm, "no footer in index.html"
footer = fm.group(0)
footer = footer.replace('href="#top"', 'href="/"')
footer = footer.replace('<a href="#shop">Consoles</a>', '<a href="/category/consoles">Consoles</a>')
footer = footer.replace('<a href="#shop">Controllers</a>', '<a href="/category/controllers">Controllers</a>')
footer = footer.replace('<a href="#shop">PS4 Games</a>', '<a href="/category/ps4-games">PS4 Games</a>')
footer = footer.replace('<a href="#shop">Accessories</a>', '<a href="/category/ps5-games">PS5 Games</a>')
footer = footer.replace('href="#deals"', 'href="/#deals"')
footer = footer.replace('href="#shop"', 'href="/#shop"')
footer = footer.replace('href="#faq"', 'href="/#faq"')
footer = footer.replace('href="#reviews"', 'href="/#reviews"')
footer = footer.replace('href="#contact"', 'href="/#contact"')
footer = footer.replace('src="logo.png"', 'src="/logo-small.png"')
# add a category browse row at the end of the footer contact column is complex; append a slim bar after </footer>
footer += """
<div style="background:#070912;border-top:1px solid #1b1f33;padding:18px 0"><div class="wrap" style="display:flex;flex-wrap:wrap;gap:10px 22px;justify-content:center">
""" + "".join(
    '<a href="/category/%s" style="color:#9aa3c0;font-size:13px">%s</a>' % (cat_slug(c), esc(c))
    for c in sorted(cats)
) + """
</div></div>"""

def page_shell(title, meta_desc, canonical, og_image, jsonld, body):
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>%s</title>
<meta name="description" content="%s"/>
<link rel="canonical" href="%s"/>
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1"/>
<meta property="og:type" content="product"/>
<meta property="og:site_name" content="Imran Games Officials"/>
<meta property="og:title" content="%s"/>
<meta property="og:description" content="%s"/>
<meta property="og:url" content="%s"/>
<meta property="og:image" content="%s"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="%s"/>
<meta name="twitter:description" content="%s"/>
<meta name="twitter:image" content="%s"/>
<link rel="stylesheet" href="/styles.css"/>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap"/>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" media="print" onload="this.media='all'"/>
<script type="application/ld+json">%s</script>
</head>
<body>
%s
%s
%s
<script>
function swapImg(el){var m=document.getElementById('mainImg');m.src=el.dataset.full;m.alt=el.alt;document.querySelectorAll('.thumb').forEach(function(t){t.style.borderColor='#232842'});el.style.borderColor='var(--pink)'}
</script>
</body>
</html>""" % (esc(title), esc(meta_desc), esc(canonical), esc(title), esc(meta_desc),
               esc(canonical), esc(og_image), esc(title), esc(meta_desc), esc(og_image),
               jsonld, header, body, footer)

# ---------- product pages ----------
os.makedirs(os.path.join(BASE, "products"), exist_ok=True)
for p in products:
    slug = p["slug"]
    url = "%s/products/%s" % (SITE, slug)
    imgs = p.get("image_urls") or []
    main = imgs[0] if imgs else SITE + "/logo.png"
    avail_url, avail_short = avail_of(p)
    cond = cond_of(p["name"])
    cond_url = "https://schema.org/UsedCondition" if cond == "Used" else "https://schema.org/NewCondition"
    price_html = '<span class="pricetag">🏷️ <b>%s</b></span>' % fmt(p["price"])
    if p.get("was_price") and p["was_price"] > p["price"]:
        off = round((1 - p["price"] / p["was_price"]) * 100)
        price_html += ' <s>%s</s> <span class="badge">-%d%% OFF</span>' % (fmt(p["was_price"]), off)
    thumbs = "".join(
        '<img class="thumb" data-full="%s" src="%s" alt="%s" loading="lazy" decoding="async" onclick="swapImg(this)" style="width:76px;height:76px;object-fit:cover;border-radius:10px;border:2px solid %s;cursor:pointer"/>' % (
            esc(u), esc(u), esc(p["name"]), "#EC008C" if i == 0 else "#232842")
        for i, u in enumerate(imgs))
    if p["stock"] <= 0 and cond != "Pre-order":
        cta = '<a class="addbtn" style="background:#3A3F55;text-decoration:none;display:inline-block" href="%s" target="_blank" rel="noopener">🔔 Sold Out — Ask on WhatsApp</a>' % wa_link(p)
    else:
        cta = '<a class="addbtn blue" style="text-decoration:none;display:inline-block" href="%s" target="_blank" rel="noopener">🛒 Order on WhatsApp — %s</a>' % (wa_link(p), fmt(p["price"]))
    rel = [q for q in cats[p["category"]] if q["slug"] != slug][:4]
    rel_html = ""
    if rel:
        rel_html = '<h2 style="margin:34px 0 14px">More in %s</h2><div class="grid">' % esc(p["category"])
        for q in rel:
            qimg = (q.get("image_urls") or [SITE + "/logo.png"])[0]
            rel_html += ('<a class="card" href="/products/%s" style="text-decoration:none">'
                         '<img src="%s" alt="%s" loading="lazy" decoding="async" style="width:100%%;aspect-ratio:4/3;object-fit:cover;border-radius:12px"/>'
                         '<h3 style="margin:10px 0 4px">%s</h3><p><b>%s</b></p></a>' % (
                             esc(q["slug"]), esc(qimg), esc(q["name"]), esc(q["name"]), fmt(q["price"])))
        rel_html += "</div>"
    ld = {
        "@context": "https://schema.org", "@type": "Product",
        "name": p["name"], "image": imgs, "description": desc_of(p),
        "sku": "IG-" + slug.split("-")[0], "brand": {"@type": "Brand", "name": p["brand"]},
        "category": p["category"], "url": url,
        "offers": {"@type": "Offer", "url": url, "priceCurrency": "PKR", "price": p["price"],
                   "availability": avail_url, "itemCondition": cond_url,
                   "seller": {"@type": "Store", "name": SHOP_NAME, "url": SITE}},
    }
    crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": p["category"], "item": "%s/category/%s" % (SITE, cat_slug(p["category"]))},
        {"@type": "ListItem", "position": 3, "name": p["name"], "item": url}]}
    body = """
<main><div class="wrap">
 <p style="color:#9aa3c0;font-size:13px;margin:18px 0 6px"><a href="/">Home</a> &nbsp;/&nbsp; <a href="/category/%s">%s</a> &nbsp;/&nbsp; %s</p>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:26px" class="pwrap">
  <div>
   <div style="aspect-ratio:4/3;background:#0e1120;border-radius:16px;overflow:hidden"><img id="mainImg" src="%s" alt="%s" fetchpriority="high" decoding="async" style="width:100%%;height:100%%;object-fit:contain"/></div>
   <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">%s</div>
  </div>
  <div>
   <p>%s</p>
   <h1 style="margin:6px 0 10px">%s</h1>
   <p style="font-size:26px;margin:6px 0">%s</p>
   <p>%s</p>
   <p style="color:#9aa3c0">Brand: <b style="color:#fff">%s</b> &nbsp;•&nbsp; Category: <b style="color:#fff">%s</b> &nbsp;•&nbsp; Condition: <b style="color:#fff">%s</b></p>
   <p style="margin:16px 0">%s</p>
   <p style="color:#9aa3c0;font-size:14px">Cash on Delivery across Pakistan — delivery Rs. 350, free on orders above Rs. 10,000. Delivery in 2–4 working days.</p>
   <p style="color:#9aa3c0;font-size:13px">Prices checked %s — please confirm on WhatsApp before ordering.</p>
  </div>
 </div>
 <div style="margin-top:26px"><h2>About this item</h2><p style="max-width:760px">%s</p></div>
 %s
 <p style="margin-top:26px"><a href="/#shop">← Back to all products</a> &nbsp;•&nbsp; <a href="/category/%s">More %s</a></p>
</div></main>
""" % (cat_slug(p["category"]), esc(p["category"]), esc(p["name"]),
       esc(main), esc(p["name"]), thumbs, badge(p), esc(p["name"]), price_html,
       stock_line(p), esc(p["brand"]), esc(p["category"]), cond, cta, TODAY,
       esc(desc_of(p)), rel_html, cat_slug(p["category"]), esc(p["category"]))
    title = "%s — %s | %s" % (p["name"], fmt(p["price"]), SHOP_NAME)
    meta = desc_of(p)[:155]
    jsonld = json.dumps([ld, crumb], ensure_ascii=False, separators=(",", ":"))
    out = page_shell(title, meta, url, main, jsonld, body)
    open(os.path.join(BASE, "products", slug + ".html"), "w").write(out)
print("product pages:", len(products))

# ---------- category pages ----------
os.makedirs(os.path.join(BASE, "category"), exist_ok=True)
for cat, items in sorted(cats.items()):
    cslug = cat_slug(cat)
    url = "%s/category/%s" % (SITE, cslug)
    items_sorted = sorted(items, key=lambda q: (q["stock"] <= 0, q["name"]))
    cards = ""
    for q in items_sorted:
        qimg = (q.get("image_urls") or [SITE + "/logo.png"])[0]
        cards += ('<a class="card" href="/products/%s" style="text-decoration:none">'
                  '<img src="%s" alt="%s" loading="lazy" decoding="async" style="width:100%%;aspect-ratio:4/3;object-fit:cover;border-radius:12px"/>'
                  '<h3 style="margin:10px 0 4px">%s</h3><p><b>%s</b>%s</p><p>%s</p></a>' % (
                      esc(q["slug"]), esc(qimg), esc(q["name"]), esc(q["name"]), fmt(q["price"]),
                      (' <s style="color:#9aa3c0">%s</s>' % fmt(q["was_price"])) if q.get("was_price") and q["was_price"] > q["price"] else "",
                      stock_line(q)))
    ld = {"@context": "https://schema.org", "@type": "ItemList", "name": cat + " — " + SHOP_NAME,
          "url": url, "numberOfItems": len(items),
          "itemListElement": [{"@type": "ListItem", "position": i + 1,
                               "url": "%s/products/%s" % (SITE, q["slug"]), "name": q["name"]}
                              for i, q in enumerate(items_sorted)]}
    crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": cat, "item": url}]}
    body = """
<main><div class="wrap">
 <p style="color:#9aa3c0;font-size:13px;margin:18px 0 6px"><a href="/">Home</a> &nbsp;/&nbsp; %s</p>
 <h1 style="margin:6px 0 4px">%s</h1>
 <p style="color:#9aa3c0">%d products — honest PKR prices, Cash on Delivery across Pakistan.</p>
 <div class="grid">%s</div>
 <p style="margin-top:26px"><a href="/#shop">← Back to all products</a></p>
</div></main>
""" % (esc(cat), esc(cat), len(items), cards)
    title = "%s — Buy %s in Peshawar | %s" % (cat, cat, SHOP_NAME)
    meta = "Buy %s at %s, Peshawar — %d products at honest PKR prices with Cash on Delivery across Pakistan." % (cat, SHOP_NAME, len(items))
    out = page_shell(title, meta[:155], url, SITE + "/logo.png",
                     json.dumps([ld, crumb], ensure_ascii=False, separators=(",", ":")), body)
    open(os.path.join(BASE, "category", cslug + ".html"), "w").write(out)
print("category pages:", len(cats))

# ---------- sitemap.xml (real paths; keep homepage images) ----------
sm_old = open(os.path.join(BASE, "sitemap.xml")).read()
img_block = ""
m = re.search(r"(<image:image>.*?</url>)", sm_old, re.S)
home_imgs = re.findall(r"<image:image>.*?</image:image>", sm_old, re.S)
img_block = "".join(home_imgs)
entries = []
entries.append(("https://imrangamesofficials.vercel.app/", "1.0", "daily"))
for cat in sorted(cats):
    entries.append(("%s/category/%s" % (SITE, cat_slug(cat)), "0.8", "weekly"))
for p in products:
    entries.append(("%s/products/%s" % (SITE, p["slug"]), "0.7", "weekly"))
out = ['<?xml version="1.0" encoding="UTF-8"?>',
       '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">']
for loc, pri, freq in entries:
    out.append(" <url><loc>%s</loc><lastmod>%s</lastmod><changefreq>%s</changefreq><priority>%s</priority>%s</url>"
               % (loc, TODAY, freq, pri, img_block if loc == SITE + "/" else ""))
out.append("</urlset>")
open(os.path.join(BASE, "sitemap.xml"), "w").write("\n".join(out))
print("sitemap urls:", len(entries), "homepage images kept:", len(home_imgs))

# ---------- index.html: ItemList urls -> real pages; footer shop links -> categories ----------
n1 = index_html.count('"url":"https://imrangamesofficials.vercel.app/#product/')
index_html = index_html.replace('"url":"https://imrangamesofficials.vercel.app/#product/',
                                '"url":"https://imrangamesofficials.vercel.app/products/')
n2 = index_html.count('<a href="#shop">Consoles</a>')
index_html = index_html.replace('<a href="#shop">Consoles</a>', '<a href="/category/consoles">Consoles</a>')
index_html = index_html.replace('<a href="#shop">Controllers</a>', '<a href="/category/controllers">Controllers</a>')
index_html = index_html.replace('<a href="#shop">PS4 Games</a>', '<a href="/category/ps4-games">PS4 Games</a>')
index_html = index_html.replace('<a href="#shop">Accessories</a>', '<a href="/category/ps5-games">PS5 Games</a>')
open(os.path.join(BASE, "index.html"), "w").write(index_html)
print("index.html: ItemList urls updated:", n1, "| footer links updated:", n2)
print("DONE")
