from src.exc import (
    NotFoundException,
    InactiveEntityException
)


class TaskNotFoundException(NotFoundException):
    def __init__(self, identifier: str):
        super().__init__(entity="Task", identifier=identifier)

class TaskInactiveException(InactiveEntityException):
    def __init__(self, identifier: str):
        super().__init__(entity="Task", identifier=identifier)