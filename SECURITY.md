# Security Policy

## Zero Analytics & Privacy-First Commitment

**copiuum group**—a collective of multiple individuals dedicated to absolute privacy—has engineered this suite as a 100% decentralized, privacy-first environment. We believe that your music and your creative process are your own. 

### 1. Zero Analytics
We collect **zero** data. There are no tracking scripts, no heatmaps, and no user behavior analysis tools (e.g., Google Analytics, Mixpanel, Segment) in this application.

### 2. Zero Telemetry
There is no background telemetry. This application does not "ping" any server to report on its usage, performance, or health. All diagnostic data is stored **locally** on your machine in the application logs and is never transmitted.

### 3. Local-First Engineering
Every feature of the Material Studio—including audio ingestion, metadata extraction, and DSP mastering—runs **locally on your hardware**. 
- **YT-DLP**: Runs as a local native process.
- **FFMPEG**: Runs as a local native process.
- **V8 Engine**: All JavaScript logic executes inside your device's memory.

### 4. Network Air-Gap (CSP)
The application is protected by a strict **Content Security Policy (CSP)** that blocks all unauthorized external network connections. Even if a third-party library attempted to initiate a connection, it would be blocked at the browser-engine level.

### 5. Reporting a Vulnerability

If you discover a security vulnerability within this project, please open a GitHub Issue or contact the maintainers directly. We take security seriously and will respond to any reported issues with high priority.

---

**Last Updated:** April 2026  
**Status:** Total Privacy Verified
