"""Frontend V1 Architecture & 57/57 API Contract Coverage Verification Suite.

Verifies:
1. 100% parity between FastAPI's live OpenAPI specification (57 operations) and
   `static/js/contracts/endpoints.js` (E01–E57), including exact trailing slashes.
2. 100% wiring of all 57 endpoint codes across `static/js/services/*.js` and UI screens.
3. 100% parity of all 19 Pydantic request schemas (92 fields) and `_NON_NULLABLE_FIELDS`
   in `static/js/contracts/serializers.js`.
4. 100% parity of domain enumerations in `static/js/contracts/enums.js` with `src/database/enums.py`.
5. Registration of all 18 logical screens (P01–P18) in `static/js/app.js`.
6. Anti-hallucination & architectural traps compliance (cross-tab mutex refresh, zero backdrop-filter,
   accessible static asset serving).
"""

from pathlib import Path
import re
from httpx import AsyncClient
import pytest

from src.database.enums import (
    InquiryServiceType,
    InquiryStatus,
    JobTitle,
    ProjectStatus,
    ProjectVisibility,
    TaskPriority,
    TaskStatus,
    TeamRole,
    TechnologyCategory,
    UserStatus,
)
from src.main import app
from src.modules.auth.schemas import LoginRequest, RefreshRequest
from src.modules.inquiry.schemas import CreateInquiryRequest, UpdateInquiryStatusRequest
from src.modules.project.schemas import CreateProjectRequest, UpdateProjectRequest
from src.modules.task.schemas import (
    CreateCommentRequest,
    CreateTaskRequest,
    MoveTaskRequest,
    UpdateTaskRequest,
)
from src.modules.team.schemas import CreateTeamRequest, UpdateTeamRequest
from src.modules.team_members.schemas import AddMemberRequest, UpdateMemberRoleRequest
from src.modules.technology.schemas import CreateTechnologyRequest, UpdateTechnologyRequest
from src.modules.user.schemas import (
    ChangePasswordRequest,
    CreateUserRequest,
    UpdateSchemaRequest,
)

STATIC_ROOT = Path("static")


def test_57_openapi_endpoints_exact_parity_with_frontend_registry() -> None:
    """Proves E01..E57 in endpoints.js match all 57 FastAPI OpenAPI operations and trailing slashes."""
    openapi_schema = app.openapi()
    backend_ops: set[tuple[str, str]] = set()
    for path, methods_dict in openapi_schema.get("paths", {}).items():
        if path.startswith("/api/v1/test-"):
            continue
        for method in methods_dict:
            if method.upper() in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
                backend_ops.add((method.upper(), path))

    assert len(backend_ops) == 57, f"Expected 57 backend operations, got {len(backend_ops)}"

    endpoints_js = (STATIC_ROOT / "js" / "contracts" / "endpoints.js").read_text(encoding="utf-8")
    pattern = re.compile(
        r"(E\d{2}):\s*\{\s*code:\s*'(E\d{2})',\s*method:\s*'([A-Z]+)',\s*path:\s*'([^']+)'"
    )
    matches = pattern.findall(endpoints_js)
    assert len(matches) == 57, f"Expected 57 E01..E57 definitions, found {len(matches)}"

    expected_codes = {f"E{i:02d}" for i in range(1, 58)}
    found_codes = {m[0] for m in matches}
    assert found_codes == expected_codes

    frontend_ops = {(m[2], m[3]) for m in matches}
    assert frontend_ops == backend_ops

    # Trap 2: Verify exact trailing slashes on the 3 required endpoints
    assert ("GET", "/api/v1/users/") in frontend_ops
    assert ("POST", "/api/v1/technologies/") in frontend_ops
    assert ("GET", "/api/v1/technologies/") in frontend_ops
    assert ("POST", "/api/v1/users") in frontend_ops
    assert ("GET", "/api/v1/technologies/search") in frontend_ops


def test_all_57_endpoints_wired_in_services_and_pages() -> None:
    """Proves every E01..E57 is referenced in static/js/services/*.js and invoked by UI screens."""
    services_dir = STATIC_ROOT / "js" / "services"
    service_files = list(services_dir.glob("*.js"))
    assert len(service_files) == 11

    combined_services = "\n".join(f.read_text(encoding="utf-8") for f in service_files)
    session_js = (STATIC_ROOT / "js" / "core" / "session.js").read_text(encoding="utf-8")
    combined_runtime = combined_services + "\n" + session_js

    for i in range(1, 58):
        code = f"E{i:02d}"
        assert (
            f"ENDPOINTS.{code}" in combined_runtime or f"'{code}'" in combined_runtime
        ), f"Endpoint {code} is not wired in any service module!"

    # Verify all 11 services are imported and invoked across pages/*.js and app.js
    pages_dir = STATIC_ROOT / "js" / "pages"
    page_files = list(pages_dir.glob("*.js"))
    assert len(page_files) == 6
    combined_ui = (
        "\n".join(f.read_text(encoding="utf-8") for f in page_files)
        + "\n"
        + (STATIC_ROOT / "js" / "app.js").read_text(encoding="utf-8")
    )

    for service_name in (
        "healthService",
        "authService",
        "usersService",
        "teamsService",
        "membersService",
        "projectsService",
        "tasksService",
        "technologiesService",
        "showcaseService",
        "inquiriesService",
        "auditService",
    ):
        assert service_name in combined_ui, f"Service {service_name} is not used in UI pages!"


def test_19_request_schemas_and_92_fields_parity() -> None:
    """Proves serializers.js covers all 19 backend request schemas, all 92 fields, and _NON_NULLABLE_FIELDS."""
    backend_schemas = {
        "CreateUserRequest": CreateUserRequest,
        "LoginRequest": LoginRequest,
        "RefreshRequest": RefreshRequest,
        "UpdateSchemaRequest": UpdateSchemaRequest,
        "ChangePasswordRequest": ChangePasswordRequest,
        "CreateTeamRequest": CreateTeamRequest,
        "UpdateTeamRequest": UpdateTeamRequest,
        "AddMemberRequest": AddMemberRequest,
        "UpdateMemberRoleRequest": UpdateMemberRoleRequest,
        "CreateProjectRequest": CreateProjectRequest,
        "UpdateProjectRequest": UpdateProjectRequest,
        "CreateTaskRequest": CreateTaskRequest,
        "UpdateTaskRequest": UpdateTaskRequest,
        "MoveTaskRequest": MoveTaskRequest,
        "CreateCommentRequest": CreateCommentRequest,
        "CreateTechnologyRequest": CreateTechnologyRequest,
        "UpdateTechnologyRequest": UpdateTechnologyRequest,
        "CreateInquiryRequest": CreateInquiryRequest,
        "UpdateInquiryStatusRequest": UpdateInquiryStatusRequest,
    }
    assert len(backend_schemas) == 19

    total_backend_fields = sum(len(model.model_fields) for model in backend_schemas.values())
    assert total_backend_fields == 92

    serializers_js = (STATIC_ROOT / "js" / "contracts" / "serializers.js").read_text(
        encoding="utf-8"
    )

    for schema_name, model_cls in backend_schemas.items():
        pattern = re.compile(rf"{schema_name}:\s*\[([^\]]+)\]", re.DOTALL)
        match = pattern.search(serializers_js)
        assert match is not None, f"Missing {schema_name} in serializers.js REQUEST_SCHEMAS"
        js_fields = set(re.findall(r"'([a-zA-Z0-9_]+)'", match.group(1)))
        py_fields = set(model_cls.model_fields.keys())
        assert js_fields == py_fields, f"Field mismatch on {schema_name}: {js_fields ^ py_fields}"

        # Verify _NON_NULLABLE_FIELDS parity if defined on the Pydantic model
        non_nullable = getattr(model_cls, "_NON_NULLABLE_FIELDS", None)
        if non_nullable:
            nn_pattern = re.compile(
                rf"{schema_name}:\s*new Set\(\[([^\]]+)\]\)", re.DOTALL
            )
            nn_match = nn_pattern.search(serializers_js)
            assert nn_match is not None, f"Missing {schema_name} in SCHEMA_NON_NULLABLE_FIELDS"
            js_nn = set(re.findall(r"'([a-zA-Z0-9_]+)'", nn_match.group(1)))
            assert js_nn == set(non_nullable)


@pytest.mark.parametrize(
    ("enum_name", "enum_cls"),
    [
        ("UserStatus", UserStatus),
        ("TeamRole", TeamRole),
        ("ProjectStatus", ProjectStatus),
        ("ProjectVisibility", ProjectVisibility),
        ("TaskStatus", TaskStatus),
        ("TaskPriority", TaskPriority),
        ("JobTitle", JobTitle),
        ("TechnologyCategory", TechnologyCategory),
        ("InquiryServiceType", InquiryServiceType),
        ("InquiryStatus", InquiryStatus),
    ],
    ids=[
        "UserStatus",
        "TeamRole",
        "ProjectStatus",
        "ProjectVisibility",
        "TaskStatus",
        "TaskPriority",
        "JobTitle",
        "TechnologyCategory",
        "InquiryServiceType",
        "InquiryStatus",
    ],
)
def test_enum_values_parity_between_backend_and_frontend(enum_name: str, enum_cls: type) -> None:
    """Proves every enum in static/js/contracts/enums.js matches src/database/enums.py."""
    enums_js = (STATIC_ROOT / "js" / "contracts" / "enums.js").read_text(encoding="utf-8")
    block_pattern = re.compile(
        rf"export const {enum_name} = Object\.freeze\(\{{([^}}]+)\}}\);", re.DOTALL
    )
    match = block_pattern.search(enums_js)
    assert match is not None, f"Missing enum {enum_name} in enums.js"
    js_values = set(re.findall(r":\s*'([^']+)'", match.group(1)))
    py_values = {member.value for member in enum_cls}
    assert js_values == py_values


def test_18_logical_screens_and_architectural_traps_guardrails() -> None:
    """Proves P01..P18 routes, cross-tab session mutex, ABAC capabilities, and zero backdrop-filter."""
    app_js = (STATIC_ROOT / "js" / "app.js").read_text(encoding="utf-8")
    screen_codes = set(re.findall(r"code:\s*'(P\d{2})'", app_js))
    expected_screens = {f"P{i:02d}" for i in range(1, 19)}
    assert screen_codes == expected_screens

    # Trap 1: Cross-tab session synchronization & mutex lock
    session_js = (STATIC_ROOT / "js" / "core" / "session.js").read_text(encoding="utf-8")
    assert "BroadcastChannel" in session_js
    assert "navigator.locks" in session_js
    assert "inFlightRefreshPromise" in session_js

    # Trap 6: ABAC & Project visibility capabilities
    capabilities_js = (STATIC_ROOT / "js" / "core" / "capabilities.js").read_text(encoding="utf-8")
    assert "assignee_to_id === null" in capabilities_js
    assert "creator_id" in capabilities_js
    assert "PENDING_REVIEW" in capabilities_js

    # High-Contrast Light Design System: Zero backdrop-filter across all CSS files
    css_files = list((STATIC_ROOT / "css").glob("*.css"))
    assert len(css_files) >= 5
    for css_file in css_files:
        content = css_file.read_text(encoding="utf-8")
        cleaned = re.sub(r"/\*.*?\*/", "", content, flags=re.DOTALL)
        assert "backdrop-filter" not in cleaned, f"Forbidden backdrop-filter found in {css_file}"


async def test_static_spa_assets_served_correctly(client: AsyncClient) -> None:
    """Proves FastAPI static mount serves index.html and modular ES/CSS files with 200 OK."""
    for asset_path in (
        "/",
        "/css/tokens.css",
        "/css/layout.css",
        "/css/components.css",
        "/js/app.js",
        "/js/contracts/endpoints.js",
        "/js/contracts/serializers.js",
        "/js/core/session.js",
        "/js/core/capabilities.js",
    ):
        res = await client.get(asset_path)
        assert res.status_code == 200, f"Asset {asset_path} returned {res.status_code}"

