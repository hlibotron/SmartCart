import asyncio
from app.db.database import engine
from app.db.schema import ensure_schema


async def init_db():
    await ensure_schema(engine)


if __name__ == "__main__":
    asyncio.run(init_db())
