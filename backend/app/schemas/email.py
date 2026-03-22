from pydantic import BaseModel, EmailStr


class EmailRequest(BaseModel):
    to: EmailStr
    cc: EmailStr | None = None
    message: str | None = None  # Optional custom message from sender


class EmailResponse(BaseModel):
    status: str  # "sent" | "preview"
    subject: str
    preview_html: str | None = None  # Returned when SMTP not configured
