from typing import Generic, TypeVar, Optional, Any
from pydantic import BaseModel

T = TypeVar("T")

class ResponseModel(BaseModel, Generic[T]):
    status: str = "success"
    message: Optional[str] = None
    data: Optional[T] = None
    
class ErrorResponseModel(BaseModel):
    status: str = "error"
    message: str
    details: Optional[Any] = None
