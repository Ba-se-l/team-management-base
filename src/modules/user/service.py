"""User domain service layer.

Contains all business logic for user profile management operations.
Each public function acts as an orchestrator that delegates data access
to ``UserRepository`` and applies domain rules.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID as ID

from src.exc import InvalidCredentialsException
from src.security import hash_password, verify_password
from src.database import UserStatus
from .models import User
from .schemas import UpdateSchemaRequest, ChangePasswordRequest
from .repository import UserRepository
from .exceptions import UserNotFoundException


async def _get_user(user_id: ID, session: AsyncSession) -> User:
    """Internal helper: fetches a user by ID or raises.

    Args:
        user_id: The UUID of the user to fetch.
        session: The active database session.

    Returns:
        The ``User`` ORM instance.

    Raises:
        UserNotFoundException: If no user with the given ID exists.
    """
    user_repo = UserRepository(session=session)
    user = await user_repo.get_by_id(id=user_id)

    if user is None:
        raise UserNotFoundException(identifier=str(user_id))

    return user


async def update_user(user_id: ID, schema: UpdateSchemaRequest, session: AsyncSession) -> User:
    """Updates a user's profile fields.

    Only fields explicitly provided in the request (non-``None``) are
    updated. Unset fields are excluded via ``exclude_unset=True``.

    Args:
        user_id: The UUID of the user to update.
        schema: The validated update request containing optional fields.
        session: The active database session.

    Returns:
        The updated ``User`` ORM instance.

    Raises:
        UserNotFoundException: If the user does not exist.
    """
    user_repo = UserRepository(session=session)

    # Step 1: Fetch the user or raise
    old_user = await _get_user(user_id=user_id, session=session)

    # Step 2: Build update dict from provided fields only
    update_data = schema.model_dump(exclude_unset=True)

    # Step 3: Apply the update via repository
    updated_user = await user_repo.update(orm_model=old_user, update_data=update_data)

    return updated_user


async def soft_delete_user(user_id: ID, session: AsyncSession) -> User:
    """Soft-deletes a user by deactivating their account.

    Sets ``is_active`` to ``False`` and ``status`` to ``OFFLINE``.
    The user record remains in the database for referential integrity.

    Args:
        user_id: The UUID of the user to deactivate.
        session: The active database session.

    Returns:
        The soft-deleted ``User`` ORM instance.

    Raises:
        UserNotFoundException: If the user does not exist.
    """
    user_repo = UserRepository(session=session)

    # Step 1: Fetch the user or raise
    user = await _get_user(user_id=user_id, session=session)

    # Step 2: Deactivate via update
    soft_deleted_user = await user_repo.update(
        orm_model=user,
        update_data={'is_active': False, 'status': UserStatus.OFFLINE},
    )

    return soft_deleted_user


async def list_users(skip: int, limit: int, session: AsyncSession) -> list[User]:
    """Lists all active users with pagination.

    Args:
        skip: Number of records to skip.
        limit: Maximum number of records to return.
        session: The active database session.

    Returns:
        A list of active ``User`` ORM instances.
    """
    user_repo = UserRepository(session=session)

    return await user_repo.get_active_users(skip=skip, limit=limit)


async def change_password(user_id: ID, schema: ChangePasswordRequest, session: AsyncSession) -> User:
    """Changes a user's password after verifying the old one.

    The old password is verified against the stored hash. If it matches,
    the new password is hashed and stored.

    Args:
        user_id: The UUID of the user changing their password.
        schema: The request containing ``old_password`` and ``new_password``.
        session: The active database session.

    Returns:
        The updated ``User`` ORM instance.

    Raises:
        UserNotFoundException: If the user does not exist.
        InvalidCredentialsException: If the old password does not match.
    """
    user_repo = UserRepository(session=session)

    # Step 1: Fetch the user or raise
    user = await _get_user(user_id=user_id, session=session)

    # Step 2: Verify the old password matches
    is_password_match = verify_password(
        plain_password=schema.old_password,
        hashed_password=user.hashed_password,
    )

    if not is_password_match:
        raise InvalidCredentialsException()

    # Step 3: Hash the new password
    hashed_password = hash_password(plain_password=schema.new_password)

    # Step 4: Update via repository
    updated_user = await user_repo.update(
        orm_model=user,
        update_data={'hashed_password': hashed_password},
    )

    return updated_user