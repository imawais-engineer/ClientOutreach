"""HTML and whitespace cleanup ported from the W1 Normalize Jobs code node."""

from __future__ import annotations

import re

_ENTITIES = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&ndash;": "–",
    "&mdash;": "—",
    "&hellip;": "…",
    "&rsquo;": "’",
    "&lsquo;": "‘",
    "&rdquo;": "”",
    "&ldquo;": "“",
    "&bull;": "•",
    "&copy;": "©",
    "&reg;": "®",
    "&trade;": "™",
}

_ENTITY_RE = re.compile(
    r"&(?:nbsp|amp|lt|gt|quot|#39|apos|ndash|mdash|hellip|rsquo|lsquo|rdquo|ldquo|bull|copy|reg|trade);",
    re.I,
)


def normalize_description(html: str | None) -> str:
    """Turn listing HTML into plain text. Empty input stays empty."""
    if html is None:
        return ""
    text = str(html)
    if not text.strip():
        return ""
    text = (
        text.replace("\\r\\n", "\n")
        .replace("\\n", "\n")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
    )
    text = re.sub(r"<\s*br\s*/?\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<\s*/?\s*p\b[^>]*>", "\n", text, flags=re.I)
    text = re.sub(r"<\s*/?\s*div\b[^>]*>", "\n", text, flags=re.I)
    text = re.sub(r"<\s*/?\s*h[1-6]\b[^>]*>", "\n", text, flags=re.I)
    text = re.sub(r"<\s*li\b[^>]*>", "\n• ", text, flags=re.I)
    text = re.sub(r"<\s*/\s*li\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<\s*/?\s*(?:ul|ol)\b[^>]*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]*>", "", text)

    def _entity(match: re.Match[str]) -> str:
        return _ENTITIES.get(match.group(0).lower(), match.group(0))

    text = _ENTITY_RE.sub(_entity, text)
    text = re.sub(
        r"&#(\d+);",
        lambda m: _codepoint(int(m.group(1)), m.group(0)),
        text,
    )
    text = re.sub(
        r"&#x([0-9a-f]+);",
        lambda m: _codepoint(int(m.group(1), 16), m.group(0)),
        text,
        flags=re.I,
    )
    text = text.replace("\u00a0", " ")
    text = text.replace("\t", " ")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"^\s*•\s*$", "", text, flags=re.M)
    text = re.sub(r"[ \t]*•[ \t]*", "\n• ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _codepoint(value: int, fallback: str) -> str:
    try:
        return chr(value)
    except ValueError:
        return fallback


def collapse(value: str | None) -> str:
    return re.sub(r"\s+", " ", str(value or "")).replace("\u00a0", " ").strip()


def business_key(value: str) -> str:
    """Same slug the leads API derives when business_key is omitted."""
    text = value.lower().replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:120]
