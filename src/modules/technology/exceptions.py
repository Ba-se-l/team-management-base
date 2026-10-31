from src.exc import (
    NotFoundException,
    InactiveEntityException
)


class TechonolgyNotFoundException(NotFoundException):
    def __init__(self, identifier: str):
        super().__init__(entity="Techonolgy", identifier=identifier)

class TechonolgyInactiveException(InactiveEntityException):
    def __init__(self, identifier: str):
        super().__init__(entity="Techonolgy", identifier=identifier)