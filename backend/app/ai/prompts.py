"""AI prompt templates — supports English, Amharic, and Afaan Oromoo."""

SYSTEM_PROMPT = """You are a cybersecurity analyst assistant embedded in AEGIS
(Alert Evaluation & Guided Investigation System), a Security Operations Center (SOC) tool.

STRICT RULES:
1. Only reference evidence explicitly provided in the structured data.
2. Clearly distinguish between CONFIRMED evidence, LIKELY interpretation, and RECOMMENDATION.
3. Never fabricate IP addresses, usernames, timestamps, or attack details not in the data.
4. Keep technical terms (IP addresses, port numbers, protocol names, CVE IDs) in English/Latin always.
5. Respond ONLY with the valid JSON format requested.
6. If evidence is limited, say so explicitly rather than speculating.
"""

# ── Language configurations ───────────────────────────────────────────────────

LANGUAGES = {
    "en": {
        "name": "English",
        "native": "English",
        "instruction": "Write all explanatory text in English.",
        "labels": {
            "summary":              "Summary",
            "threat_interpretation":"Threat Interpretation",
            "evidence":             "Confirmed Evidence",
            "risk_explanation":     "Risk Explanation",
            "recommendations":      "Recommended Investigation Steps",
            "note_technical":       "Note: IP addresses, port numbers, and technical identifiers remain in English.",
        }
    },
    "am": {
        "name": "Amharic",
        "native": "አማርኛ",
        "instruction": (
            "Write all explanatory text in Amharic (አማርኛ). "
            "Keep all IP addresses, port numbers, protocol names (SSH, TCP, HTTP, etc.), "
            "and technical identifiers exactly as-is in English/Latin. "
            "Do NOT translate IP addresses or port numbers."
        ),
        "labels": {
            "summary":              "ማጠቃለያ",
            "threat_interpretation":"የስጋት ትርጉም",
            "evidence":             "የተረጋገጠ ማስረጃ",
            "risk_explanation":     "የስጋት ደረጃ ማብራሪያ",
            "recommendations":      "የምርመራ እርምጃዎች",
            "note_technical":       "ማሳሰቢያ: የ IP አድራሻዎች፣ የወደብ ቁጥሮች እና ቴክኒካዊ ቃላቶች በእንግሊዝኛ ይቆያሉ።",
        }
    },
    "om": {
        "name": "Afaan Oromoo",
        "native": "Afaan Oromoo",
        "instruction": (
            "Write all explanatory text in Afaan Oromoo. "
            "Keep all IP addresses, port numbers, protocol names (SSH, TCP, HTTP, etc.), "
            "and technical identifiers exactly as-is in English/Latin. "
            "Do NOT translate IP addresses or port numbers."
        ),
        "labels": {
            "summary":              "Cuunfaa",
            "threat_interpretation":"Ibsa Sodaa",
            "evidence":             "Ragaa Mirkanaa'e",
            "risk_explanation":     "Ibsa Sadarkaa Balaa",
            "recommendations":      "Tarkaanfii Qorannoo",
            "note_technical":       "Yaadannoo: Teessoo IP, lakkoofsa buufata fi jechootni teknikal Afaan Ingliffaatiin ni hafu.",
        }
    },
}

DEFAULT_LANGUAGE = "en"


def get_analysis_prompt(evidence_json: str, risk_score: int, risk_level: str,
                        risk_factors_text: str, language: str = "en",
                        env_context: str = "") -> str:
    lang = LANGUAGES.get(language, LANGUAGES["en"])
    lang_instruction = lang["instruction"]
    labels = lang["labels"]

    env_section = ""
    if env_context and env_context != "No environment profile configured":
        env_section = f"""
## User's Environment Profile
{env_context}

Use this environment context to make recommendations SPECIFICALLY tailored to their stack.
For example, if they use Nginx — give Nginx-specific commands.
If they use AWS — give AWS CLI commands.
"""

    return f"""Analyze the following security alert evidence and produce a structured explanation.

## Structured Evidence
```json
{evidence_json}
```

## Risk Assessment
- Risk Score: {risk_score}/100
- Risk Level: {risk_level}
- Risk Factors: {risk_factors_text}
{env_section}
## Language Instruction
{lang_instruction}

## Required Output
Respond ONLY with a valid JSON object in this exact format:
```json
{{
  "{labels['summary']}": "1-2 sentence plain-language summary of what happened",
  "{labels['threat_interpretation']}": "2-3 sentences explaining the likely security meaning. Label as interpretation.",
  "{labels['evidence']}": "Bullet list of confirmed evidence facts, each line starting with '• '",
  "{labels['risk_explanation']}": "1-2 sentences explaining why this risk score makes sense",
  "{labels['recommendations']}": [
    "Step 1: specific action",
    "Step 2: specific action",
    "Step 3: specific action",
    "Step 4: specific action",
    "Step 5: specific action"
  ],
  "language": "{language}",
  "technical_note": "{labels['note_technical']}"
}}
```

Base your response strictly on the evidence provided.
{lang_instruction}
"""
