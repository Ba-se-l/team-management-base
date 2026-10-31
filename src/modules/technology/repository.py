from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import BaseRepository
from src.modules.technology.models import Technology



class TechnologyRepository(BaseRepository[Technology]):
    def __init__(self, session: AsyncSession):
        super().__init__(class_=Technology, session=session)

    async def get_by_name(self, name : str) -> Technology | None:
        """Retrives a techonolgy by it's uniqe name"""
        return await self.get_one_by_attribute(name=name)

    async def get_by_slug(self, slug: str) -> Technology | None:
        """Retrieves a technology by its unique normalized slug."""
        return await self.get_one_by_attribute(slug=slug)
    

    async def check_if_exist(self, name: str) -> bool:
        """Checks if a techonolgy exist by it's uniqe name"""
        return await self.get_by_name(name=name) is not None
    
    async def search_by_name(self, query: str, skip : int = 0, limit: int = 20) -> list[Technology]:
        """Seaches techonolgies by partial name match (case-insensitive)"""
        stmt = (
            select(Technology)
            .where(Technology.name.ilike(f"%{query}%"))
            .offset(skip)
            .limit(limit)
        ) 

        result = await self.session.execute(stmt)

        return list(result.scalars().all())
    
      
