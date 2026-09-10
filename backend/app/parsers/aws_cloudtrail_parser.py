"""Parser for AWS CloudTrail JSON logs."""
from __future__ import annotations
import json
import re
from datetime import datetime
from app.parsers.base import ParsedAlert

HIGH_RISK_EVENTS = {
    "ConsoleLogin", "DeleteTrail", "StopLogging", "DeleteBucket",
    "PutBucketPolicy", "CreateUser", "AttachUserPolicy",
    "AttachRolePolicy", "CreateAccessKey", "DeleteAccessKey",
    "AuthorizeSecurityGroupIngress", "CreateVpc",
}

SUSPICIOUS_PATTERNS = [
    (["ConsoleLogin"], "console_login"),
    (["CreateUser", "AttachUserPolicy", "CreateAccessKey"], "privilege_escalation"),
    (["DeleteTrail", "StopLogging", "DisableRule"], "defense_evasion"),
    (["DescribeInstances", "ListBuckets", "ListUsers", "DescribeVpcs"], "cloud_enumeration"),
    (["PutBucketPolicy", "GetObject", "ListObjects"], "data_access"),
    (["RunInstances", "CreateFunction", "CreateRole"], "resource_creation"),
]


def parse_aws_cloudtrail(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="aws_cloudtrail")

    records = []
    try:
        data = json.loads(raw)
        if isinstance(data, dict) and "Records" in data:
            records = data["Records"]
        elif isinstance(data, list):
            records = data
        else:
            records = [data]
    except (json.JSONDecodeError, ValueError):
        # Try line-by-line
        for line in raw.strip().splitlines():
            try:
                records.append(json.loads(line))
            except (json.JSONDecodeError, ValueError):
                pass

    if not records:
        parsed.alert_type = "cloudtrail_event"
        return parsed

    event_names = [r.get("eventName", "") for r in records]
    primary = records[0]

    # Source IP
    src_ip = primary.get("sourceIPAddress", "")
    if re.match(r"\d+\.\d+\.\d+\.\d+", src_ip):
        parsed.source_ip = src_ip

    # User identity
    user_identity = primary.get("userIdentity", {})
    parsed.username = (user_identity.get("userName")
                       or user_identity.get("sessionContext", {})
                                     .get("sessionIssuer", {})
                                     .get("userName"))

    # Timestamp
    ts = primary.get("eventTime", "")
    if ts:
        try:
            parsed.timestamp = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except ValueError:
            pass

    # Alert type
    alert_type = "cloudtrail_event"
    failed = [r for r in records if r.get("errorCode")]
    if len(failed) >= 5:
        alert_type = "cloud_api_abuse"
    else:
        for event_list, atype in SUSPICIOUS_PATTERNS:
            if any(e in event_names for e in event_list):
                alert_type = atype
                break
    parsed.alert_type = alert_type

    high_risk = [e for e in event_names if e in HIGH_RISK_EVENTS]
    parsed.attempt_count = len(records)

    parsed.extra = {
        "event_names": event_names[:10],
        "high_risk_events": high_risk,
        "failed_calls": len(failed),
        "aws_region": primary.get("awsRegion"),
        "user_agent": primary.get("userAgent", "")[:100],
    }
    return parsed
