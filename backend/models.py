from datetime import datetime, timezone
from typing import Annotated, List, Literal, Optional

from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: Optional[PyObjectId] = Field(default=None, validation_alias="_id")

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)

    def to_mongo(self) -> dict:
        data = self.model_dump(exclude={"id"})
        if self.id:
            data["_id"] = ObjectId(self.id)
        return data


class ProfileRecord(BaseDocument):
    name: str
    color: str = "#1B2A3A"
    created_at: str = Field(default_factory=now_iso)


class DocumentRecord(BaseDocument):
    file_name: str
    file_type: str
    scope: str
    profile_id: Optional[str] = None
    uploaded_by: Optional[str] = None
    tags: List[str] = []
    notes: str = ""
    status: Literal["processing", "ready", "error"] = "processing"
    error: Optional[str] = None
    chunk_count: int = 0
    units: int = 0
    ocr_used: bool = False
    text_chars: int = 0
    size: int = 0
    has_original: bool = False
    folder_id: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class FolderRecord(BaseDocument):
    name: str
    scope: str
    parent_id: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class FolderIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    library: Literal["common", "mine"]
    profile_id: Optional[str] = None
    parent_id: Optional[str] = None


class FolderUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    parent_id: Optional[str] = None
    move_to_root: bool = False


class MoveIn(BaseModel):
    folder_id: Optional[str] = None


class ChunkRecord(BaseDocument):
    doc_id: str
    scope: str
    file_name: str
    ref: str
    kind: Literal["doc", "note"] = "doc"
    idx: int = 0
    text: str
    embedding: List[float] = []


class ConversationRecord(BaseDocument):
    profile_id: str
    title: str
    message_count: int = 0
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class MessageRecord(BaseDocument):
    conversation_id: str
    role: Literal["user", "assistant"]
    content: str
    scope: Optional[str] = None
    web_search: bool = False
    found_in_docs: Optional[bool] = None
    template_name: Optional[str] = None
    doc_sources: list = []
    web_sources: list = []
    disclaimer: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class ProfileIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    color: str = "#1B2A3A"


TemplateCategory = Literal["Informe", "Protocolo terapia visual", "Plan entrenamiento deportivo", "Contactología", "Audiología", "Investigación", "Otro"]


class TemplateRecord(BaseDocument):
    name: str
    category: TemplateCategory = "Otro"
    body: str
    scope: str
    created_by: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class TemplateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: TemplateCategory = "Otro"
    body: str = Field(min_length=1)
    visibility: Literal["common", "mine"] = "common"
    profile_id: str


class TemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    category: Optional[TemplateCategory] = None
    body: Optional[str] = Field(default=None, min_length=1)
    visibility: Optional[Literal["common", "mine"]] = None
    profile_id: str


class FavoriteRecord(BaseDocument):
    kind: Literal["conversation", "message"]
    conversation_id: str
    message_id: Optional[str] = None
    title: str
    snippet: str = ""
    owner_profile_id: str
    saved_by: str
    saved_by_name: str
    saved_by_color: str = "#1B2A3A"
    created_at: str = Field(default_factory=now_iso)


class FavoriteIn(BaseModel):
    conversation_id: str
    message_id: Optional[str] = None
    profile_id: str


CheatFormat = Literal["Resumen", "Tabla", "Esquema", "Preguntas-respuesta", "Libre"]


class CheatsheetRecord(BaseDocument):
    title: str
    scope: str
    doc_ids: List[str]
    sources: List[str] = []
    tags: List[str] = []
    instructions: str
    format: CheatFormat = "Libre"
    content: str = ""
    status: Literal["generating", "ready", "error"] = "generating"
    error: Optional[str] = None
    created_by: str
    created_by_name: str
    library_doc_id: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class CheatsheetIn(BaseModel):
    doc_ids: List[str] = Field(min_length=1, max_length=10)
    instructions: str = Field(min_length=3)
    format: CheatFormat = "Libre"
    title: Optional[str] = None
    tags: List[str] = []
    library: Literal["common", "mine"] = "common"
    profile_id: str


class CheatsheetUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None


class CheatsheetRegen(BaseModel):
    instructions: str = Field(min_length=3)
    format: CheatFormat = "Libre"


class ConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    profile_id: str


class DocumentUpdate(BaseModel):
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    file_name: Optional[str] = None


Scope = Literal["mine", "common", "both"]


class SearchRequest(BaseModel):
    query: str
    scope: Scope = "both"
    profile_id: Optional[str] = None
    k: int = 8


class ChatRequest(BaseModel):
    question: str = Field(min_length=1)
    profile_id: str
    scope: Scope = "both"
    web_search: bool = False
    conversation_id: Optional[str] = None
    template_id: Optional[str] = None


class AccessIn(BaseModel):
    code: str


class AccessCodeChange(BaseModel):
    current_code: str
    new_code: str = Field(min_length=6)


class LLMSettingsIn(BaseModel):
    llm_backend: Optional[Literal["gemini", "ollama", "claude", "openai"]] = None
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None
    gemini_fallback_models: Optional[str] = None
    ollama_base_url: Optional[str] = None
    ollama_chat_model: Optional[str] = None
    ollama_vision_model: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    anthropic_model: Optional[str] = None
    openai_base_url: Optional[str] = None
    openai_api_key: Optional[str] = None
    openai_model: Optional[str] = None
