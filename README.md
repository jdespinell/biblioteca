# 📚 Biblioteca SaaS PWA

> Plataforma SaaS de gestión integral de bibliotecas personales con descubrimiento social, integración con Gemini AI y soporte multilenguaje (ES/EN/PT).

---

## 🏗️ Arquitectura

```
biblioteca/
├── backend/          # FastAPI + SQLAlchemy + PostgreSQL
├── frontend/         # Next.js 14 PWA + TailwindCSS + next-intl
├── nginx/            # Reverse proxy (rate limiting, security headers)
├── docker-compose.yml
└── docker-compose.prod.yml
```

### Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend API | Python 3.12, FastAPI 0.115, SQLAlchemy 2.0 |
| Base de Datos | PostgreSQL 16 |
| Migraciones | Alembic |
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Estilos | TailwindCSS 3, @tailwindcss/typography |
| PWA | @ducanh2912/next-pwa (Workbox) |
| i18n | next-intl (ES / EN / PT) |
| Editor Markdown | @uiw/react-md-editor + KaTeX + rehype-sanitize |
| Escáner ISBN | @zxing/library |
| IA | Google Gemini 1.5 Flash (reconocimiento de portadas) |
| Storage | MinIO (compatible S3) |
| Proxy | Nginx 1.25 |
| Contenedores | Docker + Docker Compose |

---

## 🚀 Inicio Rápido

### Prerrequisitos

- Docker Desktop ≥ 4.x
- Docker Compose ≥ 2.x

### 1. Clonar y configurar variables de entorno

```bash
git clone <repo-url> biblioteca
cd biblioteca

# Copiar y editar el archivo de entorno
cp .env.example .env
```

Edita `.env` y configura al menos:
- `SECRET_KEY` — cadena aleatoria de ≥32 caracteres
- `GEMINI_API_KEY` — tu clave de Google Gemini API
- Contraseñas de PostgreSQL y MinIO

### 2. Levantar los servicios

```bash
docker compose up --build -d
```

Esto levanta:
| Servicio | URL |
|---------|-----|
| **App completa** | http://localhost |
| Frontend Next.js | http://localhost:3000 |
| Backend FastAPI | http://localhost:8000 |
| API Docs (dev) | http://localhost:8000/api/docs |
| MinIO Console | http://localhost:9001 |

### 3. Ejecutar migraciones (primera vez)

```bash
docker compose exec backend alembic upgrade head
```

---

## 🔐 Seguridad

| Medida | Implementación |
|--------|---------------|
| **Auth** | JWT en cookies `HttpOnly + Secure + SameSite` |
| **RLS** | Validación `user_id` en cada endpoint |
| **Privacidad** | Notas privadas por defecto (`is_public=false`) |
| **XSS** | `rehype-sanitize` + `DOMPurify` en Markdown |
| **SQLi** | SQLAlchemy ORM exclusivamente (zero SQL raw) |
| **Rate Limiting** | Nginx (100/min general, 20/min auth, 10/min AI) |
| **CORS** | Solo orígenes configurados, `credentials: include` |
| **Files** | URLs firmadas temporales de MinIO (no pasan por backend) |
| **CSP** | `Content-Security-Policy` restrictivo en headers |

---

## 📊 Modelo de Datos

```
Users (1) ──────────── (N) UserBooks ──── (1) GlobalBooks
  │                           │
  │                   (1) Locations
  │
  └── (N) BookNotes ─── (1) GlobalBooks
  │         └── is_public: bool (default=false)
  │
  └── (N) Locations
```

### Tablas principales

| Tabla | Propósito |
|-------|-----------|
| `global_books` | Catálogo universal (unique por ISBN) |
| `user_books` | Relación user↔book: status, ubicación, rating, tags |
| `book_notes` | Notas Markdown con flag `is_public` |
| `locations` | Ubicaciones físicas/lógicas por usuario |
| `attachments` | Referencias a archivos en MinIO |
| `book_tags` | Etiquetas por UserBook |

---

## 🌐 i18n — Internacionalización

El frontend soporta tres idiomas nativamente:

| Locale | Idioma | URL |
|--------|--------|-----|
| `es` (default) | Español | `/es/...` |
| `en` | English | `/en/...` |
| `pt` | Português | `/pt/...` |

Los mensajes están en `frontend/src/i18n/messages/{locale}.json`.

---

## 🤖 Integración con Gemini AI

### Reconocimiento de portadas

```
Cliente (foto) → Base64 → POST /api/v1/ai/recognize-cover
    → Backend → Gemini 1.5 Flash Vision
    → { title, author, publisher, isbn, confidence }
```

### Lookup de ISBN

```
POST /api/v1/books/isbn/{isbn}
    → Busca en DB local primero
    → Si no existe: Open Library → Google Books (fallback)
    → Retorna metadatos normalizados
```

---

## 🧪 Tests

```bash
# Ejecutar tests del backend
docker compose exec backend pytest app/tests/ -v

# Con cobertura
docker compose exec backend pytest app/tests/ --cov=app --cov-report=term-missing
```

---

## 📱 PWA (Progressive Web App)

La app es instalable como aplicación nativa:
- **iOS**: Safari → Compartir → Agregar a pantalla de inicio
- **Android**: Chrome → menú ⋮ → Instalar app
- **Desktop**: Chrome/Edge → icono de instalación en la barra de direcciones

---

## 🐳 Comandos útiles

```bash
# Ver logs de un servicio
docker compose logs -f backend

# Acceder al shell del backend
docker compose exec backend bash

# Crear nueva migración de Alembic
docker compose exec backend alembic revision --autogenerate -m "descripcion"

# Reiniciar un servicio
docker compose restart frontend

# Producción (HTTPS)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 📁 Estructura del Backend

```
backend/app/
├── api/v1/           # Routers FastAPI
│   ├── auth.py       # Register, Login, Refresh, Logout, /me
│   ├── books.py      # GlobalBooks CRUD + ISBN lookup
│   ├── user_books.py # UserBooks CRUD + Stats + Attachments
│   ├── locations.py  # Locations CRUD
│   ├── notes.py      # BookNotes con privacidad
│   ├── social.py     # Feed público (is_public=true)
│   └── ai.py         # Gemini Vision + ISBN scan
├── core/
│   ├── config.py     # Settings (Pydantic BaseSettings)
│   ├── security.py   # JWT, bcrypt, HttpOnly cookies
│   └── dependencies.py # get_current_user, get_db
├── models/           # SQLAlchemy ORM models
├── schemas/          # Pydantic request/response schemas
├── services/
│   ├── isbn_service.py    # Open Library + Google Books
│   ├── gemini_service.py  # Gemini Vision API
│   └── storage_service.py # MinIO presigned URLs
└── tests/            # pytest tests
```

---

## Licencia

MIT — Libre para uso personal y comercial.
