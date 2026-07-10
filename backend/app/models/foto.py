from pydantic import BaseModel, Field

class FotoBase(BaseModel):
    url_storage: str = Field(..., description="Firebase Storage direct URL or file path reference")
    selecionada: bool = Field(default=False, description="Whether the client has selected this photo")

class FotoCreate(BaseModel):
    id_evento: str = Field(..., description="Firestore document ID of the associated event")
    url_storage: str = Field(..., description="Firebase Storage direct URL or file path reference")

class FotoResponse(FotoBase):
    id: str = Field(..., description="Firestore document ID for the photo")
    id_evento: str = Field(..., description="Firestore document ID of the associated event")

    class Config:
        from_attributes = True
