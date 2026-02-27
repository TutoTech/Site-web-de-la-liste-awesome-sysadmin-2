#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import re
import time
import hashlib
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional

import requests

INPUT_MD = Path("awesome-sysadmin.md")
OUTPUT_JSON = Path("data.json")

# ---- Traduction (LibreTranslate) ----
# Lance LibreTranslate en local (voir plus bas), puis utilise cette URL :
LIBRETRANSLATE_URL = "http://localhost:5000/translate"
TRANSLATE_ENABLED = True

# Anti-spam / perf
SLEEP_BETWEEN_CALLS_SEC = 0.05
CACHE_FILE = Path(".translate_cache.json")


def slugify(text: str) -> str:
    s = text.lower()
    s = re.sub(r"[àáâãäå]", "a", s)
    s = re.sub(r"[ç]", "c", s)
    s = re.sub(r"[èéêë]", "e", s)
    s = re.sub(r"[ìíîï]", "i", s)
    s = re.sub(r"[ñ]", "n", s)
    s = re.sub(r"[òóôõö]", "o", s)
    s = re.sub(r"[ùúûü]", "u", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "x"


def stable_id(*parts: str) -> str:
    raw = "||".join(parts).encode("utf-8")
    return hashlib.sha1(raw).hexdigest()[:12]


def load_cache() -> Dict[str, str]:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_cache(cache: Dict[str, str]) -> None:
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def translate_en_to_fr(text: str, cache: Dict[str, str]) -> str:
    """
    Traduction via LibreTranslate.
    Cache local pour éviter de retraduire les mêmes phrases.
    """
    clean = (text or "").strip()
    if not clean or clean == "—":
        return clean

    key = hashlib.sha1(clean.encode("utf-8")).hexdigest()
    if key in cache:
        return cache[key]

    if not TRANSLATE_ENABLED:
        return clean  # fallback : pas de traduction

    payload = {
        "q": clean,
        "source": "en",
        "target": "fr",
        "format": "text"
    }

    r = requests.post(LIBRETRANSLATE_URL, json=payload, timeout=60)
    r.raise_for_status()
    out = r.json().get("translatedText", "").strip() or clean

    cache[key] = out
    time.sleep(SLEEP_BETWEEN_CALLS_SEC)
    return out


def classify_tags(tags: List[str]) -> Tuple[List[str], List[str]]:
    """
    Heuristique: sépare licenses / langs à partir des backticks.
    """
    licenses = []
    langs = []

    lic_re = re.compile(r"(gpl|lgpl|agpl|apache|mit|bsd|mpl|isc|cc-|epl|cddl|unlicense|proprietary)", re.I)
    lang_re = re.compile(r"(python|go|golang|rust|java|javascript|typescript|c\+\+|c#|c\b|php|ruby|perl|lua|haskell|kotlin|scala|shell|powershell|docker|node\.js|\.net|groovy|elixir|erlang|swift)", re.I)

    for t in tags:
        tt = t.strip()
        if not tt:
            continue
        if lic_re.search(tt):
            licenses.append(tt)
        elif lang_re.search(tt):
            langs.append(tt)

    # dédoublonnage en conservant l'ordre
    def dedupe(xs):
        seen = set()
        out = []
        for x in xs:
            if x not in seen:
                out.append(x)
                seen.add(x)
        return out

    return dedupe(licenses), dedupe(langs)


def parse_markdown(md: str) -> Dict[str, Any]:
    """
    Parse l'awesome list :
    - ## => catégorie
    - ### => sous-catégorie
    - - [Name](url) - desc ... ([Source Code](...)) `License` `Lang`
    Exclut les entrées de TOC (liens vers #...).
    """
    lines = md.splitlines()

    data = {
        "title": "",
        "description": "",
        "categories": []
    }

    # Titre (# ...)
    for ln in lines:
        m = re.match(r"^#\s+(.+?)\s*$", ln)
        if m:
            data["title"] = m.group(1).strip()
            break

    # Description : première ligne non vide après le titre/badges
    seen_title = False
    for ln in lines:
        if not seen_title:
            if ln.startswith("# "):
                seen_title = True
            continue
        if not ln.strip():
            continue
        # ignore badges
        if ln.strip().startswith("[![](") or ln.strip().startswith("[!["):
            continue
        data["description"] = ln.strip()
        break

    categories: List[Dict[str, Any]] = []
    current_cat: Optional[Dict[str, Any]] = None
    current_sub: Optional[Dict[str, Any]] = None

    def ensure_cat(title: str) -> Dict[str, Any]:
        nonlocal current_cat
        cat = {
            "id": slugify(title),
            "title": title,
            "subcategories": []
        }
        categories.append(cat)
        current_cat = cat
        return cat

    def ensure_sub(cat: Dict[str, Any], title: str) -> Dict[str, Any]:
        nonlocal current_sub
        sub = {
            "id": slugify(cat["title"] + "-" + title),
            "title": title,
            "items": []
        }
        cat["subcategories"].append(sub)
        current_sub = sub
        return sub

    for ln in lines:
        m = re.match(r"^##\s+(.+?)\s*$", ln)
        if m:
            current_cat = ensure_cat(m.group(1).strip())
            current_sub = None
            continue

        m = re.match(r"^###\s+(.+?)\s*$", ln)
        if m and current_cat:
            current_sub = ensure_sub(current_cat, m.group(1).strip())
            continue

        if not current_cat:
            continue

        # Item tool
        if re.match(r"^\s*[-*+]\s+\[", ln):
            main = re.match(r"^\s*[-*+]\s+\[([^\]]+)\]\(([^)]+)\)\s*(?:[-–—:]\s*)?(.*)$", ln)
            if not main:
                continue

            name = main.group(1).strip()
            url = main.group(2).strip()
            rest = (main.group(3) or "").strip()

            # skip TOC anchors or local links
            if url.startswith("#") or url.startswith("./") or url.startswith("/") or url.startswith("mailto:"):
                continue

            # tags from `...`
            tags = re.findall(r"`([^`]+)`", rest)
            licenses, langs = classify_tags(tags)

            # all secondary markdown links in rest
            # capture: [Label](URL)
            sec_links = re.findall(r"\[([^\]]+)\]\(([^)]+)\)", rest)
            links: Dict[str, str] = {}
            for label, lurl in sec_links:
                label = label.strip()
                lurl = lurl.strip()
                if not lurl or lurl == url:
                    continue
                links[label] = lurl

            # ensure Demo link is included if present (already via links dict)
            # We'll keep every label as-is: "Source Code", "Demo", etc.

            # description: remove markdown links and inline tags
            desc = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", "", rest)
            desc = re.sub(r"`[^`]+`", "", desc)
            desc = re.sub(r"\s{2,}", " ", desc).strip() or "—"

            item = {
                "id": stable_id(current_cat["title"], current_sub["title"] if current_sub else "Général", name, url),
                "name": name,
                "url": url,
                "description_en": desc,
                "description_fr": "",  # rempli ensuite
                "links": links,         # inclut Demo/Source Code/etc si présents
                "licenses": licenses,
                "langs": langs,
            }

            if current_sub is None:
                current_sub = ensure_sub(current_cat, "Général")

            current_sub["items"].append(item)

    data["categories"] = categories
    return data


def main():
    if not INPUT_MD.exists():
        raise SystemExit(f"Fichier introuvable : {INPUT_MD.resolve()}")

    md = INPUT_MD.read_text(encoding="utf-8")
    data = parse_markdown(md)

    # Flatten to translate everything (sans oublier un outil)
    cache = load_cache()

    total = 0
    for cat in data["categories"]:
        for sub in cat["subcategories"]:
            for item in sub["items"]:
                total += 1
                item["description_fr"] = translate_en_to_fr(item["description_en"], cache)

    save_cache(cache)

    OUTPUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK: {total} outils exportés -> {OUTPUT_JSON}")


if __name__ == "__main__":
    main()