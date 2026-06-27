# backend/app/routers/share_links.py
import hashlib
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.limiter import limiter
from app.models.audit_log import AuditAction, ActorType
from app.models.share_link import ShareLink
from app.models.user import User
from app.schemas.share_link import (
    ShareLinkCreate,
    ShareLinkCreated,
    ShareLinkEmailRequest,
    ShareLinkRead,
)
from app.security.dependencies import get_current_user, require_admin, verify_csrf
from app.security.tokens import create_share_token
from app.services import email_service
from app.services.audit_service import log_event
from app.services.email_service import mask_email, send_share_link_email

router = APIRouter(prefix="/api/share-links", tags=["share-links"])


@router.get("", response_model=list[ShareLinkRead], dependencies=[Depends(require_admin)])
def list_share_links(db: Session = Depends(get_db)):
    links = db.query(ShareLink).order_by(ShareLink.created_at.desc()).all()
    result = []
    for link in links:
        raw_token = create_share_token(link.id, link.expires_at)
        result.append(ShareLinkRead(
            id=link.id,
            label=link.label,
            allowed_sections=link.allowed_sections,
            expires_at=link.expires_at,
            revoked=link.revoked,
            created_at=link.created_at,
            token_url=f"/guest?token={raw_token}",
        ))
    return result


@router.post(
    "",
    response_model=ShareLinkCreated,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
def create_share_link(
    payload: ShareLinkCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    link_id = uuid.uuid4()
    raw_token = create_share_token(link_id, payload.expires_at)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    link = ShareLink(
        id=link_id,
        label=payload.label,
        token_hash=token_hash,
        allowed_sections=payload.allowed_sections,
        expires_at=payload.expires_at,
        created_by=current.id,
    )
    db.add(link)
    log_event(
        db,
        action=AuditAction.create,
        actor_type=ActorType.user,
        actor_user_id=current.id,
        detail=f"Created share link: {payload.label}",
    )
    db.commit()
    db.refresh(link)

    token_url = f"/guest?token={raw_token}"
    return ShareLinkCreated(
        id=link.id,
        label=link.label,
        allowed_sections=link.allowed_sections,
        expires_at=link.expires_at,
        revoked=link.revoked,
        created_at=link.created_at,
        token_url=token_url,
    )


@router.delete(
    "/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf)],
)
def revoke_share_link(
    link_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    link = db.get(ShareLink, link_id)
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found")
    link.revoked = True
    log_event(
        db,
        action=AuditAction.delete,
        actor_type=ActorType.user,
        actor_user_id=current.id,
        detail=f"Revoked share link: {link.label}",
    )
    db.commit()


@router.delete(
    "/{link_id}/permanent",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf)],
)
def delete_share_link(
    link_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    link = db.get(ShareLink, link_id)
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found")
    log_event(
        db,
        action=AuditAction.delete,
        actor_type=ActorType.user,
        actor_user_id=current.id,
        detail=f"Deleted share link: {link.label}",
    )
    db.delete(link)
    db.commit()


@router.post(
    "/{link_id}/email",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf)],
)
@limiter.limit("10/hour")
def email_share_link(
    request: Request,
    response: Response,
    link_id: uuid.UUID,
    payload: ShareLinkEmailRequest,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    link = db.get(ShareLink, link_id)
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found")

    now = datetime.now(timezone.utc)
    if link.revoked or link.expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot email an inactive link.",
        )

    raw_token = create_share_token(link.id, link.expires_at)
    link_url = f"{settings.app_base_url}/guest?token={raw_token}"
    expires_display = link.expires_at.strftime("%B %d, %Y %I:%M %p %Z").strip()

    try:
        send_share_link_email(
            sender=email_service.get_email_sender(),
            recipient=str(payload.recipient),
            link_url=link_url,
            expires_at_display=expires_display,
            message=payload.message,
        )
    except email_service.EmailSendError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't send the email. The link is still valid — you can copy it instead.",
        )

    log_event(
        db,
        action=AuditAction.share_link_emailed,
        actor_type=ActorType.user,
        actor_user_id=current.id,
        detail=f'Emailed "{link.label}" to {mask_email(str(payload.recipient))}',
    )
    db.commit()
