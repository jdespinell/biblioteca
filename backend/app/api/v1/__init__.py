from fastapi import APIRouter

from app.api.v1 import auth, books, user_books, locations, notes, social, ai, admin

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(books.router)
api_router.include_router(user_books.router)
api_router.include_router(locations.router)
api_router.include_router(notes.router)
api_router.include_router(social.router)
api_router.include_router(ai.router)
api_router.include_router(admin.router)
