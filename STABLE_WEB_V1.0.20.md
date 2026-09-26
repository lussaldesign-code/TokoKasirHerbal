# TokoKasirHerbal — Stable Web Backup

## Stable version
**Version: 1.0.20**

This marker identifies the web state verified as stable after the latest layout/settings fixes.

### Protected areas
- Login Admin/Kasir preserved.
- Product add/edit flow preserved.
- Secure product RPC flow preserved.
- Web sidebar layout fixed.
- Pengaturan opens Manajemen Akun.
- Report tab is isolated from Pengaturan.
- Printer selection UI preserved.

### Rollback point
Stable commit: `d2ee60f615f310c4031d506ebcc82b0b75adc1d1`

A dedicated backup branch named `backup/stable-web-v1.0.20` is created from this commit. Use that branch as the reference if a future web update causes an error.
