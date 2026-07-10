from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from enum import Enum

class EventoStatus(str, Enum):
    ativa = "ativa"
    arquivada = "arquivada"
    finalizada = "finalizada"

class TipoGaleria(str, Enum):
    casamento = "casamento"
    festa_infantil = "festa_infantil"
    ensaio = "ensaio"
    evento_corporativo = "evento_corporativo"
    outros = "outros"

class EventoBase(BaseModel):
    id_cliente: str = Field(..., description="Firestore document ID of the associated client")
    titulo: str = Field(..., min_length=2, max_length=150, description="Title of the event")
    data: date = Field(..., description="Date of the photoshoot event")
    limite_fotos: Optional[int] = Field(None, ge=1, description="Maximum number of photos the client can select")
    permitir_extras: bool = Field(default=False, description="Whether the client can select more than the limit")
    selecao_livre: bool = Field(default=False, description="Whether there is no selection limit")
    valor_foto_extra: Optional[float] = Field(None, ge=0.0, description="Optional price per extra photo selected")
    tipo_galeria: TipoGaleria = Field(default=TipoGaleria.ensaio, description="Category of the gallery")
    
    # Regras de Download & Pagamento de Extras
    permitir_download: bool = Field(default=True, description="Whether the client is allowed to download selected photos")
    pagamento_extras_confirmado: bool = Field(default=False, description="Whether the admin has approved the payment for extra photos")
    
    # Regras de Acesso (Somente Link vs Login e Senha)
    acesso_restrito: bool = Field(default=False, description="Whether access requires email and password login")
    
    # Configurações de Marca D'água
    marca_dagua_ativa: bool = Field(default=True, description="Whether the watermark protection is enabled")
    marca_dagua_texto: str = Field(default="WILKSON FOTOGRAFIAS", description="The text of the watermark")
    marca_dagua_opacidade: int = Field(default=30, ge=10, le=100, description="Opacity percent of the watermark (10-100)")
    marca_dagua_miniaturas: bool = Field(default=True, description="Apply watermark to gallery thumbnails")
    marca_dagua_expandida: bool = Field(default=True, description="Apply watermark to expanded lightbox view")

class EventoCreate(EventoBase):
    pass

class EventoResponse(EventoBase):
    id: str = Field(..., description="Firestore document ID for the event")
    status: EventoStatus = Field(EventoStatus.ativa, description="Current status of the event")
    token: str = Field(..., description="Unique generated access token/slug for the client's page")

    class Config:
        from_attributes = True
        use_enum_values = True
