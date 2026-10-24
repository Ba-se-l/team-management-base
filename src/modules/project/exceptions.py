from src.exc import (
    NotFoundException,
    InactiveEntityException
)


class ProjectNotFoundException(NotFoundException):
    def __init__(self, identifier: str):
        super().__init__(entity="Project", identifier=identifier)

class ProjectInactiveException(InactiveEntityException):
    def __init__(self, identifier: str):
        super().__init__(entity="Project", identifier=identifier)