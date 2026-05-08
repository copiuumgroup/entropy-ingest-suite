# Security Policy

## Zero Analytics & Privacy-First Commitment

**copiuum group**—a collective of multiple individuals dedicated to absolute privacy—has engineered this suite as a 100% decentralized, privacy-first environment. We believe that your music and your creative process are your own. 

### 1. Zero Analytics
We collect **zero** data. There are no tracking scripts, no heatmaps, and no user behavior analysis tools in this application.

### 2. Zero Telemetry
There is no background telemetry. This application does not "ping" any server to report on its usage, performance, or health. All diagnostic data is stored **locally** on your machine and is never transmitted.

### 3. Native Go Security
The application is now a **native Go binary**. This significantly reduces the attack surface compared to web-based environments:
- **No Browser Engine**: No V8, Chromium, or Node.js overhead or vulnerabilities.
- **Memory Safety**: Go provides built-in memory safety and bounds checking.
- **No Remote JS Execution**: Zero risk of Cross-Site Scripting (XSS) or remote code injection through browser-based interfaces.

### 4. Local-First Engineering
Every feature—including audio ingestion, metadata extraction, and post-processing—runs **locally on your hardware**:
- **YT-DLP**: Runs as a local native process.
- **ARIA2C**: Handles downloads via secure local protocols.
- **FFMPEG**: Handles audio conversion locally.

### 5. Reporting a Vulnerability

If you discover a security vulnerability within this project, please open a GitHub Issue. We take security seriously and will respond to any reported issues with high priority.

---

**Last Updated:** May 2026  
**Status:** Go-Native Privacy Verified
