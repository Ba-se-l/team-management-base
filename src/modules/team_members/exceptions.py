from src.exc import (
    NotFoundException,
    InactiveEntityException,
    AccessDeniedException
)


class TeamMemberNotFoundException(NotFoundException):
    def __init__(self, identifier: str):
        super().__init__(entity="TeamMember", identifier=identifier)

class TeamMemberInactiveException(InactiveEntityException):
    def __init__(self, identifier: str):
        super().__init__(entity="TeamMember", identifier=identifier)

class InsufficientRoleException(AccessDeniedException):
    def __init__(self, required_role: str):
        super().__init__(message=f"This action requires at least '{required_role}' role.")