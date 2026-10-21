/**
 * Optional ADMIN_IP_ALLOWLIST: comma-separated IPv4/IPv6 addresses or IPv4 CIDR ranges
 * (e.g. "203.0.113.7, 198.51.100.0/24"). When set, staff powers only work from these addresses.
 */
export function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = n * 256 + Number(p);
  }
  return n;
}

export function ipAllowed(ip: string, allowlist: string[]): boolean {
  if (!allowlist.length) return true;
  const normalized = ip.replace(/^::ffff:/, "");
  return allowlist.some((entry) => {
    if (!entry.includes("/")) return entry === normalized;
    const [base, bitsRaw] = entry.split("/");
    const bits = Number(bitsRaw);
    const a = ipv4ToInt(normalized);
    const b = ipv4ToInt(base);
    if (a === null || b === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return ((a & mask) >>> 0) === ((b & mask) >>> 0);
  });
}
