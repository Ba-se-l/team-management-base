"""Single source of truth for telemetry, identifier, and database column width limits."""

AUDIT_USER_ID_MAX: int = 128
"""Maximum character length for audit actor identifiers."""

AUDIT_REQUEST_ID_MAX: int = 64
"""Maximum character length for distributed correlation request IDs."""

AUDIT_IP_MAX: int = 45
"""Maximum character length for IP addresses (supports IPv6 notation)."""

AUDIT_USER_AGENT_MAX: int = 255
"""Maximum character length for HTTP User-Agent strings."""
