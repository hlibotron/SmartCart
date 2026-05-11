from fastapi import APIRouter, UploadFile, File

router = APIRouter()

@router.post("/receipts/process")
async def process_receipt(file: UploadFile = File(...)):
    image_bytes = await file.read()

    return {
        "ok": True,
        "filename": file.filename
    }