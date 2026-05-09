import asyncio
from app.db.database import engine, Base
from fastapi import FastAPI
from app.db import models

app = FastAPI()


@app.get("/")
def root():
    return {"status": "ok"}

