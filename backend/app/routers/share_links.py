# backend/app/routers/share_links.py
import hashlib
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditAction, ActorType
from app.models.share_link import ShareLink
from app.models.user import User
from app.schemas.share_link import ShareLinkCreate, ShareLinkCreated, ShareLinkRead
from app.security.dependencies import get_current_user, require_admin, verify_csrf
from app.security.tokens import create_share_token
from app.services.audit_service import log_event

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
