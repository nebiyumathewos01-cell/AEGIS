#!/usr/bin/env python3
"""
AEGIS Agent — Log File Monitor
================================
Watches a log file and automatically sends new lines to your AEGIS dashboard.

Usage:
    python aegis-agent.py --api-key YOUR_KEY --server https://aegis-1-15r0.onrender.com \
        --log-file /var/log/auth.log --source auth

Requirements:
    pip install requests

Supported sources:
    auth, nmap, suricata, snort, firewall, apache, dns,
    windows_event, cisco, palo_alto, waf, zeek,
    aws_cloudtrail, endpoint_edr, netflow, syslog,
    smtp, osquery, generic
"""

import argparse
import logging
import os
import sys
import time

try:
    import requests
except ImportError:
    print("ERROR: 'requests' not installed. Run: pip install requests")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("aegis-agent")


def send_alert(server: str, api_key: str, raw_alert: str, source: str) -> dict:
    """Send a log line to AEGIS webhook."""
    url = f"{server.rstrip('/')}/api/webhook/alert"
    response = requests.post(
        url,
        headers={
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        },
        json={
            "raw_alert": raw_alert,
            "source": source,
            "auto_analyze": True,
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def test_connection(server: str, api_key: str) -> bool:
    """Verify API key is valid before starting."""
    url = f"{server.rstrip('/')}/api/webhook/test"
    try:
        response = requests.get(
            url,
            headers={"X-API-Key": api_key},
            timeout=10,
        )
        if response.status_code == 200:
            data = response.json()
            log.info("Connected to AEGIS — key: %s — owner: %s",
                     data.get("label"), data.get("owner"))
            return True
        log.error("Connection failed: %s", response.text)
        return False
    except Exception as e:
        log.error("Cannot reach AEGIS server: %s", e)
        return False


def watch_file(
    log_file: str,
    server: str,
    api_key: str,
    source: str,
    batch_size: int = 1,
    poll_interval: float = 1.0,
    min_line_length: int = 20,
):
    """
    Tail a log file and send new lines to AEGIS.
    Supports log rotation — reopens file if it shrinks.
    """
    if not os.path.exists(log_file):
        log.error("Log file not found: %s", log_file)
        sys.exit(1)

    log.info("Watching: %s (source=%s)", log_file, source)
    log.info("Sending to: %s", server)
    log.info("Press Ctrl+C to stop.")

    sent_count = 0
    error_count = 0
    batch_buffer = []

    with open(log_file, "r", encoding="utf-8", errors="replace") as f:
        # Start at end of file — only send NEW lines
        f.seek(0, 2)
        current_inode = os.fstat(f.fileno()).st_ino

        while True:
            try:
                line = f.readline()

                if not line:
                    # Check for log rotation
                    try:
                        new_inode = os.stat(log_file).st_ino
                        if new_inode != current_inode:
                            log.info("Log rotation detected — reopening file")
                            f = open(log_file, "r", encoding="utf-8", errors="replace")
                            current_inode = os.fstat(f.fileno()).st_ino
                    except OSError:
                        pass
                    time.sleep(poll_interval)
                    continue

                line = line.rstrip("\n").strip()
                if len(line) < min_line_length:
                    continue

                batch_buffer.append(line)

                if len(batch_buffer) >= batch_size:
                    raw = "\n".join(batch_buffer)
                    batch_buffer = []
                    try:
                        result = send_alert(server, api_key, raw, source)
                        sent_count += 1
                        log.info(
                            "Alert #%s sent — %s [%s] score=%s",
                            result.get("alert_id"),
                            result.get("alert_type", "?"),
                            result.get("risk_level", "?"),
                            result.get("risk_score", "?"),
                        )
                    except requests.HTTPError as e:
                        error_count += 1
                        log.warning("HTTP error sending alert: %s", e)
                        if e.response.status_code == 401:
                            log.error("Invalid API key — stopping agent")
                            sys.exit(1)
                    except Exception as e:
                        error_count += 1
                        log.warning("Error sending alert: %s", e)

            except KeyboardInterrupt:
                log.info("Stopped. Sent %d alerts, %d errors.", sent_count, error_count)
                sys.exit(0)


def watch_command(
    command: str,
    server: str,
    api_key: str,
    source: str,
    poll_interval: float = 5.0,
):
    """Run a shell command periodically and send its output to AEGIS."""
    import subprocess
    log.info("Running command every %.0fs: %s", poll_interval, command)

    while True:
        try:
            result = subprocess.run(
                command, shell=True, capture_output=True, text=True, timeout=30
            )
            output = (result.stdout + result.stderr).strip()
            if output and len(output) >= 20:
                try:
                    res = send_alert(server, api_key, output, source)
                    log.info("Alert #%s — %s [%s]",
                             res.get("alert_id"), res.get("alert_type"), res.get("risk_level"))
                except Exception as e:
                    log.warning("Send error: %s", e)
        except Exception as e:
            log.warning("Command error: %s", e)
        time.sleep(poll_interval)


def main():
    parser = argparse.ArgumentParser(
        description="AEGIS Agent — sends log alerts to your AEGIS dashboard",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Watch SSH auth log
  python aegis-agent.py --api-key aegis_xxx --server https://aegis-1-15r0.onrender.com \\
      --log-file /var/log/auth.log --source auth

  # Watch Suricata alerts
  python aegis-agent.py --api-key aegis_xxx --server https://aegis-1-15r0.onrender.com \\
      --log-file /var/log/suricata/fast.log --source suricata

  # Watch Apache access log
  python aegis-agent.py --api-key aegis_xxx --server https://aegis-1-15r0.onrender.com \\
      --log-file /var/log/apache2/access.log --source apache

  # Run a command periodically (e.g. netstat)
  python aegis-agent.py --api-key aegis_xxx --server https://aegis-1-15r0.onrender.com \\
      --command "netstat -an | grep ESTABLISHED" --source generic --interval 60
        """
    )
    parser.add_argument("--api-key",   required=True,  help="Your AEGIS API key")
    parser.add_argument("--server",    required=True,  help="AEGIS server URL")
    parser.add_argument("--source",    default="generic", help="Log source type")
    parser.add_argument("--log-file",  default=None,   help="Path to log file to watch")
    parser.add_argument("--command",   default=None,   help="Shell command to run periodically")
    parser.add_argument("--interval",  type=float, default=1.0, help="Poll interval in seconds")
    parser.add_argument("--batch",     type=int,   default=1,   help="Lines per alert (default: 1)")
    parser.add_argument("--test",      action="store_true",     help="Test connection and exit")

    args = parser.parse_args()

    # Test connection first
    if not test_connection(args.server, args.api_key):
        sys.exit(1)

    if args.test:
        print("Connection OK")
        sys.exit(0)

    if args.log_file:
        watch_file(
            log_file=args.log_file,
            server=args.server,
            api_key=args.api_key,
            source=args.source,
            batch_size=args.batch,
            poll_interval=args.interval,
        )
    elif args.command:
        watch_command(
            command=args.command,
            server=args.server,
            api_key=args.api_key,
            source=args.source,
            poll_interval=args.interval,
        )
    else:
        log.error("Provide --log-file or --command")
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
