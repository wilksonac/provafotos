from pydantic import BaseModel, Field
from typing import Optional

class ClienteBase(BaseModel):
    nome: str = Field(..., min_length=2, max_length=100, description="Full name of the client")
    email: str = Field(..., description="Email address of the client")
    telefone: str = Field(..., description="Contact telephone number")
    senha: Optional[str] = Field(None, description="Password for client login")

class ClienteCreate(ClienteBase):
    pass

class ClienteResponse(ClienteBase):
    id: str = Field(..., description="Firestore document ID for the client")

    class Config:
        from_attributes = True
