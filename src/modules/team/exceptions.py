from src.exc import (
    NotFoundException,
    AlreadyExistsException,
    InactiveEntityException
)

class TeamNotFoundException(NotFoundException):
    def __init__(self, identifier: str):
        super().__init__(entity="Team", identifier=identifier)

class TeamAlreadyExistsException(AlreadyExistsException):
    def __init__(self, field: str, value: str):
        super().__init__(entity="Team", field=field, value=value)

class TeamInactiveException(InactiveEntityException):
    def __init__(self, identifier: str):
        super().__init__(entity="Team", identifier=identifier)