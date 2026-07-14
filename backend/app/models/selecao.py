from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class SelecaoBase(BaseModel):
    id_evento: str = Field(..., description="Firestore document ID of the associated event")
    id_cliente: str = Field(..., description="Firestore document ID of the associated client")
    fotos_selecionadas: List[str] = Field(default_factory=list, description="List of selected photo IDs")
    status: str = Field(default="em_progresso", description="Selection status (em_progresso or finalizada)")
    data_finalizacao: Optional[datetime] = Field(None, description="Datetime when selection was finalized")
    limite_fotos: Optional[int] = Field(None, description="Custom selection limit for this client (overrides event-level limit)")

class SelecaoCreate(SelecaoBase):
    pass

class SelecaoResponse(SelecaoBase):
    id: str = Field(..., description="Firestore document ID (id_evento_id_cliente)")

    class Config:
        from_attributes = True
