# Platform Compatibility Matrix

> **⚠️ BETA STATUS**: We're actively testing on all platforms. Please report issues!

## Tested Platforms

| Platform | Docker Version | Status | Known Issues | Workaround |
|----------|---------------|--------|--------------|------------|
| **Linux** | | | | |
| Ubuntu 22.04/24.04 | 24.0+ | ✅ Stable | None | - |
| Debian 11/12 | 24.0+ | ✅ Stable | None | - |
| RHEL/Rocky/Alma 8/9 | 24.0+ | ✅ Stable | SELinux contexts | `--privileged` flag |
| Arch Linux | Latest | ✅ Stable | None | - |
| **macOS** | | | | |
| macOS 13 Ventura | Desktop 4.20+ | ⚠️ Beta | Client IP shows Docker VM IP | Use X-Forwarded-For |
| macOS 14 Sonoma | Desktop 4.25+ | ⚠️ Beta | sed syntax differences | Script uses portable syntax |
| **Windows** | | | | |
| Windows 11 + WSL2 | Desktop 4.20+ | ⚠️ Beta | Path mounting issues | Use WSL2 paths |
| Windows Server 2022 | Native | 🔧 Testing | Network bridge config | In progress |
| **SBCs** | | | | |
| Raspberry Pi 4/5 | 24.0+ | ⚠️ Beta | ARM compatibility | Use ARM images |
| Jetson Nano | 20.10+ | 🔧 Testing | NVIDIA runtime | Testing in progress |
| **NAS Systems** | | | | |
| Synology DSM 7 | 20.10+ | ⚠️ Beta | Limited Docker features | Use compatibility mode |
| QNAP QTS 5 | 20.10+ | 🔧 Testing | Container Station quirks | Testing in progress |
| TrueNAS Scale | Built-in | ✅ Stable | None | Use Apps/Docker |
| Unraid | 20.10+ | ✅ Stable | None | Community template available |
| **Virtualization** | | | | |
| Proxmox VE 8 (LXC) | N/A | ✅ Stable | Needs privileged container | Enable nesting |
| Proxmox VE 8 (VM) | 24.0+ | ✅ Stable | None | - |
| VMware ESXi | 24.0+ | ✅ Stable | None | - |
| Hyper-V | 20.10+ | ⚠️ Beta | Network configuration | Use NAT mode |

## Browser Compatibility

| Browser | Version | Status | Known Issues |
|---------|---------|--------|--------------|
| Chrome/Chromium | 90+ | ✅ Fully Supported | None |
| Firefox | 90+ | ✅ Fully Supported | Custom scrollbar styling |
| Safari | 15+ | ⚠️ Supported | Backdrop filters need -webkit prefix |
| Edge | 90+ | ✅ Fully Supported | None |
| Mobile Safari (iOS) | 15+ | ✅ Fully Supported | None |
| Chrome Mobile | Latest | ✅ Fully Supported | None |

## Known Platform-Specific Issues

### macOS Docker Desktop
- **Issue**: External client IPs show as Docker VM IP (192.168.65.x)
- **Workaround**: Application uses X-Forwarded-For headers
- **Fix**: Planned in v1.2.0

### Windows WSL2
- **Issue**: File paths need WSL2 format (/mnt/c/ instead of C:\)
- **Workaround**: Installer auto-detects and converts paths
- **Fix**: Implemented in v1.1.3

### BSD sed vs GNU sed
- **Issue**: Different syntax for in-place editing
- **Workaround**: Scripts detect sed version and use appropriate syntax
- **Fix**: Implemented in v1.1.2

## Testing Your Platform

Run our platform test script:
```bash
./scripts/test-platforms.sh
```

This will check:
- Docker installation and version
- Network configuration
- sed/awk compatibility
- File permissions
- Backup/restore paths

## Reporting Issues

Please include:
1. Platform and version (`uname -a`)
2. Docker version (`docker --version`)
3. Test script output
4. Error messages from logs

Report at: [GitHub Issues](https://github.com/alflewerken/web-appliance-dashboard/issues)

## Contributing

Help us test on your platform! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
